#!/usr/bin/env node
/**
 * scripts/indexing-cron-runner.js
 * Automated Instant Indexing Engine & Queue Processor for PM2 / Cron
 * Specification: Milestone 4 (M4), GEMINI.md, PROJECT.md
 *
 * Usage:
 *   node scripts/indexing-cron-runner.js --once
 *   node scripts/indexing-cron-runner.js --batch-size 50
 *   node scripts/indexing-cron-runner.js --interval 300
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const store = require('./lib/pgStore');
const jwt = require('jsonwebtoken');

const projectRoot = path.resolve(__dirname, '..');
const PID_LOCK_FILE = path.join(projectRoot, '.indexing-runner.lock');

// ─── LOAD ENVIRONMENT VARIABLES ───────────────────────────────────────────────
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch (err) {
    console.warn(`[IndexingCronRunner Warning] Failed to load env file ${filePath}:`, err.message);
  }
}

loadEnvFile(path.join(projectRoot, '.env.local'));
loadEnvFile(path.join(projectRoot, '.env'));

const DOMAIN = process.env.DOMAIN || 'nhadat.city';
const BASE_URL = `https://${DOMAIN}`;
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '';
const INDEXNOW_KEY_LOCATION = `${BASE_URL}/indexnow-key.txt`;
const GOOGLE_DAILY_QUOTA = 200;

const INDEXNOW_ENDPOINTS = [
  'https://www.bing.com/indexnow',
  'https://api.indexnow.org/indexnow',
  'https://yandex.com/indexnow',
];

// CLI Arguments
const args = process.argv.slice(2);
const onceMode = args.includes('--once') || !args.some(a => a.startsWith('--interval'));
const dryRun = args.includes('--dry-run');
let batchSize = 50;
let intervalSec = 0;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--batch-size' && args[i + 1]) {
    batchSize = parseInt(args[i + 1], 10) || 50;
  }
  if (args[i] === '--interval' && args[i + 1]) {
    intervalSec = parseInt(args[i + 1], 10) || 0;
  }
}

// ─── PROCESS MUTEX / LOCK FILE ────────────────────────────────────────────────
function acquireLock() {
  if (fs.existsSync(PID_LOCK_FILE)) {
    try {
      const pid = parseInt(fs.readFileSync(PID_LOCK_FILE, 'utf8').trim(), 10);
      if (pid && !isNaN(pid)) {
        // Check if process is still alive
        try {
          process.kill(pid, 0);
          console.warn(`[IndexingCronRunner Warning] Another runner process (PID: ${pid}) is currently active. Exiting.`);
          return false;
        } catch (e) {
          // Process not found, stale lock
          console.log(`[IndexingCronRunner] Removing stale lock file from inactive PID ${pid}.`);
        }
      }
    } catch (e) {
      // Ignore read error
    }
  }
  fs.writeFileSync(PID_LOCK_FILE, String(process.pid), 'utf8');
  return true;
}

function releaseLock() {
  try {
    if (fs.existsSync(PID_LOCK_FILE)) {
      fs.unlinkSync(PID_LOCK_FILE);
    }
  } catch (err) {
    // Ignore error
  }
}

function registerLockCleanup() {
  process.on('exit', releaseLock);
  process.on('SIGINT', () => { releaseLock(); process.exit(0); });
  process.on('SIGTERM', () => { releaseLock(); process.exit(0); });
}

// ─── GOOGLE SERVICE ACCOUNT & AUTH ───────────────────────────────────────────
let cachedGoogleToken = null;
let googleTokenExpiresAt = 0;

function getGoogleServiceAccount() {
  const keyPath = path.join(projectRoot, 'google-service-account.json');
  if (fs.existsSync(keyPath)) {
    return JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  }
  return null;
}

async function getGoogleAccessToken(sa) {
  const nowSec = Math.floor(Date.now() / 1000);
  if (cachedGoogleToken && googleTokenExpiresAt > nowSec + 60) {
    return cachedGoogleToken;
  }

  const iat = nowSec;
  const exp = iat + 3600;
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp,
  };

  const token = jwt.sign(payload, sa.private_key, { algorithm: 'RS256' });

  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: token,
    }).toString();

    const req = https.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 10000,
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const data = JSON.parse(body);
            cachedGoogleToken = data.access_token;
            googleTokenExpiresAt = nowSec + (data.expires_in || 3600);
            resolve(cachedGoogleToken);
          } catch (e) {
            reject(new Error('Failed to parse Google OAuth response: ' + body));
          }
        } else {
          reject(new Error(`Google OAuth failed with status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Google OAuth request timeout')); });
    req.write(postData);
    req.end();
  });
}

function submitUrlToGoogle(url, type, accessToken) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const postData = JSON.stringify({ url, type });

    const req = https.request('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 10000,
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        const durationMs = Date.now() - startTime;
        let parsed = null;
        try { parsed = JSON.parse(body); } catch (e) {}
        if (res.statusCode === 200) {
          resolve({ success: true, status: 200, data: parsed, durationMs });
        } else {
          resolve({ success: false, status: res.statusCode, error: body, data: parsed, durationMs });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, status: 500, error: err.message, durationMs: Date.now() - startTime });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, status: 504, error: 'Request timeout', durationMs: Date.now() - startTime });
    });

    req.write(postData);
    req.end();
  });
}

function submitBatchToIndexNow(urls) {
  return Promise.all(INDEXNOW_ENDPOINTS.map((endpoint) => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const body = JSON.stringify({
        host: DOMAIN,
        key: INDEXNOW_KEY,
        keyLocation: INDEXNOW_KEY_LOCATION,
        urlList: urls,
      });

      const u = new URL(endpoint);
      const req = https.request({
        hostname: u.hostname,
        path: u.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 15000,
      }, (res) => {
        let respData = '';
        res.on('data', c => respData += c);
        res.on('end', () => {
          const durationMs = Date.now() - startTime;
          const ok = res.statusCode === 200 || res.statusCode === 202;
          resolve({ endpoint, success: ok, status: res.statusCode, durationMs });
        });
      });

      req.on('error', (err) => {
        resolve({ endpoint, success: false, status: 500, error: err.message, durationMs: Date.now() - startTime });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({ endpoint, success: false, status: 504, error: 'Timeout', durationMs: Date.now() - startTime });
      });

      req.write(body);
      req.end();
    });
  }));
}

function calculateBackoff(attempts, baseSeconds = 30, maxSeconds = 3600) {
  return Math.min(maxSeconds, Math.pow(2, attempts) * baseSeconds);
}

// ─── DB HELPERS (Postgres; same claim/complete semantics as lib/indexing/indexingWorker.ts) ───
async function logIndexing({ provider, urls, type, httpStatus, success, durationMs, response, error }) {
  const { sql } = store;
  const extra = JSON.parse(JSON.stringify({ urlCount: urls.length, urls, type, durationMs, response, error }));
  await sql`
    INSERT INTO indexing_logs (url, engine, provider, status, success, http_status, created_at, extra)
    VALUES (${urls[0] ?? null}, ${provider}, ${provider}, ${success ? 'success' : 'failed'}, ${!!success},
            ${httpStatus ?? null}, NOW(), ${sql.json(extra)})`;
}

/** Atomically claim ready items (concurrent workers never double-process; stale 'processing' > 10min recovered). */
async function claimBatch(limit) {
  const { sql } = store;
  const rows = await sql`
    UPDATE indexing_queue SET status = 'processing', updated_at = NOW()
    WHERE id IN (
      SELECT id FROM indexing_queue
      WHERE (lower(status) = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= NOW()))
         OR (status = 'processing' AND updated_at < NOW() - INTERVAL '10 minutes')
      ORDER BY priority ASC, next_attempt_at ASC NULLS FIRST, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    RETURNING *`;
  return rows.sort((a, b) => a.priority - b.priority
    || (a.next_attempt_at ? a.next_attempt_at.getTime() : 0) - (b.next_attempt_at ? b.next_attempt_at.getTime() : 0)
    || a.created_at.getTime() - b.created_at.getTime());
}
async function completeTask(id, httpStatus) {
  const { sql } = store;
  await sql`UPDATE indexing_queue SET status = 'completed', google_submitted_at = NOW(), updated_at = NOW(),
      extra = extra || ${sql.json({ lastHttpStatus: httpStatus ?? null })} WHERE id = ${id}`;
}
async function deferTask(id, nextAttemptAt, lastError) {
  const { sql } = store;
  await sql`UPDATE indexing_queue SET status = 'pending', next_attempt_at = ${nextAttemptAt}, updated_at = NOW(),
      extra = extra || ${sql.json({ lastError })} WHERE id = ${id}`;
}
async function failOrRetryTask(id, attempts, { error, httpStatus }) {
  const { sql } = store;
  const nextAttempts = attempts + 1;
  const info = { lastError: error || `HTTP ${httpStatus}`, lastHttpStatus: httpStatus ?? null };
  if (nextAttempts >= 5) {
    await sql`UPDATE indexing_queue SET status = 'failed', attempts = ${nextAttempts}, updated_at = NOW(),
        extra = extra || ${sql.json(info)} WHERE id = ${id}`;
    return { final: true, nextAttempts };
  }
  const delaySec = calculateBackoff(nextAttempts);
  await sql`UPDATE indexing_queue SET status = 'pending', attempts = ${nextAttempts}, next_attempt_at = ${new Date(Date.now() + delaySec * 1000)},
      updated_at = NOW(), extra = extra || ${sql.json(info)} WHERE id = ${id}`;
  return { final: false, nextAttempts, delaySec };
}
/** Enqueue (or re-queue) a URL: INSERT .. ON CONFLICT (url) (unique index uq_indexing_queue_url, migration 007). */
async function enqueueUrl(url, type = 'URL_UPDATED', priority = 1, source = 'cron-runner') {
  const { sql } = store;
  const [r] = await sql`
    INSERT INTO indexing_queue (mongo_id, url, type, status, priority, source, next_attempt_at)
    VALUES (${store.meteorId()}, ${url}, ${type}, 'pending', ${priority}, ${source}, NOW())
    ON CONFLICT (url) DO UPDATE SET type = EXCLUDED.type, status = 'pending', priority = LEAST(indexing_queue.priority, EXCLUDED.priority),
      attempts = 0, next_attempt_at = NOW(), updated_at = NOW()
    RETURNING id`;
  return r.id;
}

// ─── EXECUTE SINGLE QUEUE RUN ────────────────────────────────────────────────
async function runCycle() {
  const { sql } = store;
  const cycleStart = Date.now();
  console.log(`\n[IndexingCronRunner] ========== Starting Indexing Cycle ==========`);

  // 1. Check Google Quota for today
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const [{ n: usedToday }] = await sql`
    SELECT COUNT(*)::int AS n FROM indexing_logs
    WHERE provider = 'google' AND created_at >= ${startOfDay}
      AND (success IS TRUE OR http_status IN (200, 202, 400, 403))`;

  const quotaRemaining = Math.max(0, GOOGLE_DAILY_QUOTA - usedToday);
  console.log(`[IndexingCronRunner] Google Quota: ${usedToday}/${GOOGLE_DAILY_QUOTA} used today. Remaining: ${quotaRemaining}`);

  // 2. Atomically claim pending tasks from indexing_queue
  let queueTasks;
  if (dryRun) {
    // dry run must not mutate the queue: peek only
    queueTasks = await sql`
      SELECT * FROM indexing_queue
      WHERE lower(status) = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
      ORDER BY priority ASC, next_attempt_at ASC NULLS FIRST, created_at ASC LIMIT ${batchSize}`;
  } else {
    queueTasks = await claimBatch(batchSize);
  }

  console.log(`[IndexingCronRunner] Found ${queueTasks.length} pending items ready to dispatch.`);

  if (queueTasks.length === 0) {
    console.log(`[IndexingCronRunner] Queue is clear. No actions needed.`);
    return;
  }

  // 3. Dispatch to IndexNow (all valid URLs)
  const indexNowUrls = queueTasks
    .map(t => t.url)
    .filter(u => u && u.startsWith(`https://${DOMAIN}`));

  if (indexNowUrls.length > 0 && !dryRun) {
    console.log(`[IndexingCronRunner] Dispatching ${indexNowUrls.length} URLs to IndexNow engines...`);
    const epResults = await submitBatchToIndexNow(indexNowUrls);
    for (const r of epResults) {
      let providerName = 'indexnow.org';
      if (r.endpoint.includes('bing')) providerName = 'bing';
      else if (r.endpoint.includes('yandex')) providerName = 'yandex';

      await logIndexing({
        provider: providerName, urls: indexNowUrls, type: 'BATCH',
        httpStatus: r.status, success: r.success, durationMs: r.durationMs, error: r.error,
      });

      console.log(`  [IndexNow] ${r.endpoint} -> HTTP ${r.status} (${r.durationMs}ms)`);
    }
  }

  // 4. Dispatch to Google Indexing API within daily quota
  const sa = getGoogleServiceAccount();
  let googleToken = null;
  if (sa && !dryRun) {
    try {
      googleToken = await getGoogleAccessToken(sa);
    } catch (err) {
      console.error(`[IndexingCronRunner Error] Could not acquire Google access token:`, err.message);
    }
  }

  const googleTasks = queueTasks.slice(0, quotaRemaining);
  const deferredTasks = queueTasks.slice(quotaRemaining);

  // Defer overflow tasks to next day reset
  if (deferredTasks.length > 0) {
    const tomorrowReset = new Date(startOfDay);
    tomorrowReset.setUTCDate(tomorrowReset.getUTCDate() + 1);
    console.log(`[IndexingCronRunner] Google quota exhausted for ${deferredTasks.length} items. Deferring to ${tomorrowReset.toISOString()}`);
    if (!dryRun) {
      for (const t of deferredTasks) {
        await deferTask(t.id, tomorrowReset, 'Google quota limit reached (200/day), deferred to next UTC reset');
      }
    }
  }

  let googleSuccess = 0;
  let googleFailed = 0;

  for (let i = 0; i < googleTasks.length; i++) {
    const task = googleTasks[i];
    const targetUrl = task.url;
    const targetType = task.type || 'URL_UPDATED';

    if (dryRun || !googleToken) {
      console.log(`  [DRY RUN] Google Indexing [${targetType}]: ${targetUrl}`);
      if (!dryRun) {
        // claimed but no token: hand the task back so it is retried next cycle
        await sql`UPDATE indexing_queue SET status = 'pending', updated_at = NOW() WHERE id = ${task.id}`;
      }
      continue;
    }

    const gRes = await submitUrlToGoogle(targetUrl, targetType, googleToken);

    await logIndexing({
      provider: 'google', urls: [targetUrl], type: targetType,
      httpStatus: gRes.status, success: gRes.success, durationMs: gRes.durationMs, response: gRes.data, error: gRes.error,
    });

    if (gRes.success) {
      googleSuccess++;
      await completeTask(task.id, gRes.status);
      console.log(`  [✓ Google] [${i + 1}/${googleTasks.length}] ${targetType}: ${targetUrl} (HTTP 200, ${gRes.durationMs}ms)`);
    } else {
      googleFailed++;
      const r = await failOrRetryTask(task.id, Number(task.attempts || 0), { error: gRes.error, httpStatus: gRes.status });
      if (r.final) {
        console.error(`  [✗ Google Failed] Max attempts reached for ${targetUrl}: ${gRes.error}`);
      } else {
        console.warn(`  [⚠ Google Retry] Attempt ${r.nextAttempts}/5 for ${targetUrl} scheduled in ${r.delaySec}s: HTTP ${gRes.status}`);
      }
    }

    if (i < googleTasks.length - 1) {
      await new Promise(r => setTimeout(r, 150));
    }
  }

  const cycleDuration = Date.now() - cycleStart;
  console.log(`[IndexingCronRunner] Cycle finished in ${cycleDuration}ms. Google: ${googleSuccess} OK, ${googleFailed} Failed.`);
}

// ─── MAIN RUNNER ENTRYPOINT ──────────────────────────────────────────────────
async function main() {
  if (!acquireLock()) {
    process.exit(0);
  }
  registerLockCleanup();

  console.log(`[IndexingCronRunner] Initializing runner (PID: ${process.pid})...`);
  console.log(`[IndexingCronRunner] Target domain: ${DOMAIN}, Postgres: ${process.env.DATABASE_URL ? 'DATABASE_URL set' : 'DATABASE_URL MISSING'}`);

  try {
    if (onceMode || intervalSec <= 0) {
      await runCycle();
    } else {
      console.log(`[IndexingCronRunner] Starting recurring loop every ${intervalSec} seconds...`);
      let isBusy = false;
      await runCycle();

      setInterval(async () => {
        if (isBusy) return;
        isBusy = true;
        try {
          await runCycle();
        } catch (err) {
          console.error('[IndexingCronRunner Error] Exception in interval cycle:', err.message);
        } finally {
          isBusy = false;
        }
      }, intervalSec * 1000);

      // Keep process alive for interval mode
      await new Promise(() => {});
    }
  } catch (err) {
    console.error('[IndexingCronRunner Fatal Error]', err.message);
  } finally {
    if (onceMode || intervalSec <= 0) {
      await store.close();
      releaseLock();
      console.log('[IndexingCronRunner] Runner exited gracefully.');
    }
  }
}

if (require.main === module) main();
module.exports = { claimBatch, completeTask, deferTask, failOrRetryTask, enqueueUrl, runCycle };
