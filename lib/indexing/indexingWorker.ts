import { sql } from '@/lib/db/pg';
import {
  getGoogleQuotaRemaining,
  submitToGoogleIndexing,
  submitToIndexNow,
  calculateBackoff,
} from './indexingEngine';

export interface QueueProcessingResult {
  success: boolean;
  totalPulled: number;
  googleDispatchedCount: number;
  googleSuccessCount: number;
  indexNowDispatchedCount: number;
  indexNowSuccessCount: number;
  completedCount: number;
  retryCount: number;
  failedCount: number;
  durationMs: number;
  message?: string;
}

// Concurrency mutex flag for worker
let isWorkerRunning = false;

/**
 * Process pending indexing tasks from `indexing_queue`
 */
export async function processIndexingQueue(batchSize: number = 50): Promise<QueueProcessingResult> {
  if (isWorkerRunning) {
    console.log('[IndexingWorker] Worker is already running, skipping execution cycle.');
    return {
      success: true,
      totalPulled: 0,
      googleDispatchedCount: 0,
      googleSuccessCount: 0,
      indexNowDispatchedCount: 0,
      indexNowSuccessCount: 0,
      completedCount: 0,
      retryCount: 0,
      failedCount: 0,
      durationMs: 0,
      message: 'Worker is busy',
    };
  }

  isWorkerRunning = true;
  const startTime = Date.now();

  try {
    // 1. Atomically claim pending items (priority asc, next_attempt_at, created_at) so concurrent workers never double-process.
    //    Stale 'processing' claims (> 10 min) are recovered.
    const claimed = await sql`
      UPDATE indexing_queue SET status = 'processing', updated_at = NOW()
      WHERE id IN (
        SELECT id FROM indexing_queue
        WHERE (status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= NOW()))
           OR (status = 'processing' AND updated_at < NOW() - INTERVAL '10 minutes')
        ORDER BY priority ASC, next_attempt_at ASC NULLS FIRST, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${batchSize}
      )
      RETURNING *`;
    const queueItems = claimed
      .map((r) => ({ id: r.id as number, url: r.url as string, type: r.type as string | null, attempts: Number(r.attempts || 0), priority: Number(r.priority), nextAttemptAt: r.next_attempt_at as Date | null, createdAt: r.created_at as Date }))
      .sort((a, b) => a.priority - b.priority || (a.nextAttemptAt?.getTime() ?? 0) - (b.nextAttemptAt?.getTime() ?? 0) || a.createdAt.getTime() - b.createdAt.getTime());

    if (queueItems.length === 0) {
      isWorkerRunning = false;
      return {
        success: true,
        totalPulled: 0,
        googleDispatchedCount: 0,
        googleSuccessCount: 0,
        indexNowDispatchedCount: 0,
        indexNowSuccessCount: 0,
        completedCount: 0,
        retryCount: 0,
        failedCount: 0,
        durationMs: Date.now() - startTime,
        message: 'No pending items in indexing queue',
      };
    }

    console.log(`[IndexingWorker] Pulled ${queueItems.length} pending items from indexing_queue.`);

    // 2. Check Google quota
    const quotaInfo = await getGoogleQuotaRemaining();
    const availableGoogleQuota = quotaInfo.remaining;
    console.log(`[IndexingWorker] Google Indexing API daily quota remaining: ${availableGoogleQuota}/${quotaInfo.limit}`);

    let googleDispatchedCount = 0;
    let googleSuccessCount = 0;
    let indexNowDispatchedCount = 0;
    let indexNowSuccessCount = 0;
    let completedCount = 0;
    let retryCount = 0;
    let failedCount = 0;

    // 3. Batch submit to IndexNow (IndexNow supports bulk submissions without strict daily cap)
    const updateUrls = queueItems
      .filter(item => item.url && item.url.startsWith('https://nhadat.city/'))
      .map(item => item.url);

    if (updateUrls.length > 0) {
      indexNowDispatchedCount = updateUrls.length;
      console.log(`[IndexingWorker] Broadcasting ${updateUrls.length} URLs to IndexNow engines...`);
      const indexNowRes = await submitToIndexNow(updateUrls);
      if (indexNowRes.success) {
        indexNowSuccessCount = updateUrls.length;
      }
    }

    // 4. Process Google Indexing submissions one by one for items within quota
    const googleItems = queueItems.slice(0, availableGoogleQuota);
    const quotaExceededItems = queueItems.slice(availableGoogleQuota);

    // If quota is exceeded for remaining items, defer them to tomorrow's reset
    if (quotaExceededItems.length > 0) {
      const tomorrowReset = new Date(quotaInfo.resetAt);
      console.log(`[IndexingWorker] Google daily quota saturated. Deferring ${quotaExceededItems.length} items to ${tomorrowReset.toISOString()}`);
      for (const item of quotaExceededItems) {
        await sql`
          UPDATE indexing_queue SET status = 'pending', next_attempt_at = ${tomorrowReset}, updated_at = NOW(),
            extra = extra || ${sql.json({ lastError: 'Google daily quota limit (200/day) reached, deferred to next reset' })}
          WHERE id = ${item.id}`;
      }
    }

    for (let i = 0; i < googleItems.length; i++) {
      const item = googleItems[i];
      googleDispatchedCount++;

      // Dispatch to Google Indexing API
      const result = await submitToGoogleIndexing(item.url, item.type === 'URL_DELETED' ? 'URL_DELETED' : 'URL_UPDATED');

      if (result.success) {
        googleSuccessCount++;
        completedCount++;
        await sql`
          UPDATE indexing_queue SET status = 'completed', google_submitted_at = NOW(), updated_at = NOW(),
            extra = extra || ${sql.json({ lastHttpStatus: result.httpStatus ?? null })}
          WHERE id = ${item.id}`;
      } else {
        const nextAttempts = (item.attempts || 0) + 1;
        if (nextAttempts >= 5) {
          failedCount++;
          await sql`
            UPDATE indexing_queue SET status = 'failed', attempts = ${nextAttempts}, updated_at = NOW(),
              extra = extra || ${sql.json({ lastError: result.error || `HTTP ${result.httpStatus}`, lastHttpStatus: result.httpStatus ?? null })}
            WHERE id = ${item.id}`;
        } else {
          retryCount++;
          const delaySec = calculateBackoff(nextAttempts);
          const nextAttemptAt = new Date(Date.now() + delaySec * 1000);
          await sql`
            UPDATE indexing_queue SET status = 'pending', attempts = ${nextAttempts}, next_attempt_at = ${nextAttemptAt}, updated_at = NOW(),
              extra = extra || ${sql.json({ lastError: result.error || `HTTP ${result.httpStatus}`, lastHttpStatus: result.httpStatus ?? null })}
            WHERE id = ${item.id}`;
        }
      }

      // 150ms pacing delay between Google Indexing API requests
      if (i < googleItems.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(
      `[IndexingWorker] Batch complete (${durationMs}ms): ${googleSuccessCount}/${googleDispatchedCount} Google OK, ` +
      `${indexNowSuccessCount}/${indexNowDispatchedCount} IndexNow OK, ` +
      `${completedCount} completed, ${retryCount} retrying, ${failedCount} failed.`
    );

    return {
      success: true,
      totalPulled: queueItems.length,
      googleDispatchedCount,
      googleSuccessCount,
      indexNowDispatchedCount,
      indexNowSuccessCount,
      completedCount,
      retryCount,
      failedCount,
      durationMs,
    };
  } catch (err: any) {
    console.error('[IndexingWorker Error] Unhandled exception during queue processing:', err?.message || err);
    return {
      success: false,
      totalPulled: 0,
      googleDispatchedCount: 0,
      googleSuccessCount: 0,
      indexNowDispatchedCount: 0,
      indexNowSuccessCount: 0,
      completedCount: 0,
      retryCount: 0,
      failedCount: 0,
      durationMs: Date.now() - startTime,
      message: err?.message || String(err),
    };
  } finally {
    isWorkerRunning = false;
  }
}
