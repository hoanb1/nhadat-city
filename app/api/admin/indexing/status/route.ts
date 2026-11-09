import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { LOG_SUCCESS } from '@/lib/db/repo/adminIndexing';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { getGoogleQuotaRemaining } from '@/lib/indexing/indexingEngine';
import { processIndexingQueue } from '@/lib/indexing/indexingWorker';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const googleQuota = await getGoogleQuotaRemaining();

    // Query queue statistics (status is stored upper/lower case depending on writer -> compare lower())
    const [q] = await sql`
      SELECT
        count(*) FILTER (WHERE lower(status) = 'pending')::int    AS pending,
        count(*) FILTER (WHERE lower(status) = 'processing')::int AS processing,
        count(*) FILTER (WHERE lower(status) = 'completed')::int  AS completed,
        count(*) FILTER (WHERE lower(status) = 'failed')::int     AS failed,
        count(*)::int                                             AS total
      FROM indexing_queue`;
    const pendingCount: number = q.pending;
    const processingCount: number = q.processing;
    const completedCount: number = q.completed;
    const failedCount: number = q.failed;
    const totalQueueCount: number = q.total;

    // Query 24h telemetry statistics
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [t] = await sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE ${LOG_SUCCESS()} IS TRUE)::int AS ok,
        count(*) FILTER (WHERE ${LOG_SUCCESS()} IS NOT TRUE)::int AS fail
      FROM indexing_logs WHERE created_at >= ${oneDayAgo}`;
    const total24hLogs: number = t.total;
    const success24hLogs: number = t.ok;
    const fail24hLogs: number = t.fail;

    const successRate = total24hLogs > 0
      ? `${((success24hLogs / total24hLogs) * 100).toFixed(1)}%`
      : '100.0%';

    return NextResponse.json({
      success: true,
      data: {
        googleQuota,
        queue: {
          pending: pendingCount,
          processing: processingCount,
          completed: completedCount,
          failed: failedCount,
          total: totalQueueCount,
        },
        telemetry24h: {
          totalLogs: total24hLogs,
          successCount: success24hLogs,
          failCount: fail24hLogs,
          successRate,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[AdminIndexing:Status Error]', error?.message || error);
    return NextResponse.json({ success: false, message: error?.message || 'Lỗi server' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Number(body.batchSize) || 50;

    // Trigger processing of queue
    const result = await processIndexingQueue(batchSize);

    return NextResponse.json({
      success: true,
      message: 'Đã kích hoạt xử lý hàng đợi indexing',
      result,
    });
  } catch (error: any) {
    console.error('[AdminIndexing:Trigger Error]', error?.message || error);
    return NextResponse.json({ success: false, message: error?.message || 'Lỗi server' }, { status: 500 });
  }
}
