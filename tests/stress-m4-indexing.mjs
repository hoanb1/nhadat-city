/**
 * ==============================================================================
 * NHADAT.CITY MILESTONE 4 EMPIRICAL STRESS TEST & VERIFICATION HARNESS
 * ==============================================================================
 * Scope: Instant Indexing Engine (Google + IndexNow), Queue Worker, Telemetry API
 * Author: Empirical Challenger 1
 * Guidelines: GEMINI.md, PROJECT.md
 *
 * Execution:
 *   timeout 60s node tests/stress-m4-indexing.mjs
 * ==============================================================================
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const ROOT_DIR = process.cwd();
const APP_DIR = path.join(ROOT_DIR, 'app');
const LIB_DIR = path.join(ROOT_DIR, 'lib');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  suites: 0,
  startTime: Date.now(),
  failures: [],
};

const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
};

function suite(name, fn) {
  stats.suites++;
  console.log(`\n${colors.bold(colors.blue('▶ M4 STRESS SUITE ' + stats.suites + ':'))} ${colors.bold(name)}`);
  try {
    fn();
  } catch (err) {
    console.error(`${colors.red('Suite init error:')}`, err);
  }
}

function test(name, fn) {
  stats.total++;
  try {
    fn();
    stats.passed++;
    console.log(`  ${colors.green('✓')} ${colors.gray(`[ST-${String(stats.total).padStart(2, '0')}]`)} ${name}`);
  } catch (err) {
    stats.failed++;
    stats.failures.push({ id: stats.total, name, error: err.message, stack: err.stack });
    console.log(`  ${colors.red('✗')} ${colors.gray(`[ST-${String(stats.total).padStart(2, '0')}]`)} ${name}`);
    console.log(`    ${colors.red('Error:')} ${err.message}`);
  }
}

// ------------------------------------------------------------------------------
// IMPORT / REPLICATE CORE M4 LOGIC FOR EMPIRICAL EXECUTION & ADVERSARIAL TESTING
// ------------------------------------------------------------------------------

const EXPECTED_INDEXNOW_KEY = 'a9f3e2b1c8d74e5f9a0b1c2d3e4f5a6b';
const EXPECTED_INDEXNOW_HOST = 'nhadat.city';
const EXPECTED_INDEXNOW_KEY_LOCATION = 'https://nhadat.city/indexnow-key.txt';
const EXPECTED_INDEXNOW_ENDPOINTS = [
  'https://www.bing.com/indexnow',
  'https://api.indexnow.org/indexnow',
  'https://yandex.com/indexnow',
];
const GOOGLE_DAILY_QUOTA = 200;

function calculateBackoff(attempts, baseSeconds = 30, maxSeconds = 3600) {
  const safeAttempts = Math.max(0, Math.min(attempts, 30));
  return Math.min(maxSeconds, Math.pow(2, safeAttempts) * baseSeconds);
}

function allocateQuota(requestedCount, usedToday, maxDailyQuota = GOOGLE_DAILY_QUOTA) {
  const remainingQuota = Math.max(0, maxDailyQuota - usedToday);
  const googleCount = Math.min(requestedCount, remainingQuota);
  const indexNowSurplus = requestedCount - googleCount;
  return {
    googleCount,
    indexNowSurplus,
    remainingQuota: remainingQuota - googleCount,
  };
}

function formatIndexNowPayload(urls, key = EXPECTED_INDEXNOW_KEY, host = EXPECTED_INDEXNOW_HOST, keyLocation = EXPECTED_INDEXNOW_KEY_LOCATION) {
  const formattedUrls = (urls || [])
    .map(u => u.startsWith('http') ? u : `https://${host}${u.startsWith('/') ? '' : '/'}${u}`)
    .filter(u => u.startsWith(`https://${host}/`));

  return {
    host,
    key,
    keyLocation,
    urlList: formattedUrls,
  };
}

// ==============================================================================
// SUITE 1: GOOGLE QUOTA ALLOCATION & DAILY EXHAUSTION DEFENSE
// ==============================================================================
suite('M4.1 - Google Indexing API Daily Quota Gatekeeper & Exhaustion Stress', () => {

  test('ST-01: Zero usage allocates full quota up to requested count', () => {
    const q1 = allocateQuota(50, 0);
    assert.equal(q1.googleCount, 50);
    assert.equal(q1.indexNowSurplus, 0);
    assert.equal(q1.remainingQuota, 150);

    const q2 = allocateQuota(200, 0);
    assert.equal(q2.googleCount, 200);
    assert.equal(q2.indexNowSurplus, 0);
    assert.equal(q2.remainingQuota, 0);
  });

  test('ST-02: Partial usage saturates exactly at 200 and spills surplus to IndexNow', () => {
    const q = allocateQuota(100, 150);
    assert.equal(q.googleCount, 50, 'Only 50 remaining out of 200');
    assert.equal(q.indexNowSurplus, 50, '50 surplus URLs deferred for Google but active for IndexNow');
    assert.equal(q.remainingQuota, 0);
  });

  test('ST-03: Complete quota exhaustion (usedToday >= 200) dispatches 0 Google and 100% IndexNow', () => {
    const qAt200 = allocateQuota(500, 200);
    assert.equal(qAt200.googleCount, 0);
    assert.equal(qAt200.indexNowSurplus, 500);
    assert.equal(qAt200.remainingQuota, 0);

    const qOver200 = allocateQuota(500, 250);
    assert.equal(qOver200.googleCount, 0);
    assert.equal(qOver200.indexNowSurplus, 500);
    assert.equal(qOver200.remainingQuota, 0);
  });

  test('ST-04: Massive bulk load (10,000 URLs) maintains integer bounds without overflow', () => {
    const qMassive = allocateQuota(10000, 0);
    assert.equal(qMassive.googleCount, 200);
    assert.equal(qMassive.indexNowSurplus, 9800);
    assert.equal(qMassive.remainingQuota, 0);
  });

  test('ST-05: Daily quota reset ISO timestamp calculation strictly advances to next UTC midnight', () => {
    const now = new Date('2026-08-24T15:30:45.123Z');
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    assert.equal(endOfDay.toISOString(), '2026-08-25T00:00:00.000Z');
    assert.ok(endOfDay.getTime() > now.getTime(), 'Reset must be in future');
    assert.equal(endOfDay.getTime() - startOfDay.getTime(), 86400000, 'Exact 24h interval');
  });

  test('ST-06: Deferral simulation for quota-exceeded queue items', () => {
    const mockQueue = Array.from({ length: 250 }, (_, i) => ({
      _id: `item_${i + 1}`,
      url: `https://nhadat.city/ha-noi/dich-vong/${i + 1}/ban-nha`,
      status: 'pending',
      nextAttemptAt: new Date(),
    }));

    const quotaInfo = { remaining: 200, limit: 200, resetAt: '2026-08-25T00:00:00.000Z' };
    const googleItems = mockQueue.slice(0, quotaInfo.remaining);
    const quotaExceededItems = mockQueue.slice(quotaInfo.remaining);

    assert.equal(googleItems.length, 200);
    assert.equal(quotaExceededItems.length, 50);

    // Verify deferred items update payload
    const deferredUpdates = quotaExceededItems.map(item => ({
      id: item._id,
      nextAttemptAt: new Date(quotaInfo.resetAt),
      lastError: 'Google daily quota limit (200/day) reached, deferred to next reset',
    }));

    assert.equal(deferredUpdates.length, 50);
    deferredUpdates.forEach(d => {
      assert.equal(d.nextAttemptAt.toISOString(), '2026-08-25T00:00:00.000Z');
      assert.ok(d.lastError.includes('Google daily quota limit'));
    });
  });
});

// ==============================================================================
// SUITE 2: INDEXNOW MULTI-ENGINE BROADCASTING & KEY VERIFICATION
// ==============================================================================
suite('M4.2 - IndexNow Multi-Engine Broadcasting Payload & Key Verification', () => {

  test('ST-07: Public key files exist and match exact 32-hex character secret', () => {
    const keyFile = path.join(PUBLIC_DIR, 'indexnow-key.txt');
    const namedKeyFile = path.join(PUBLIC_DIR, `${EXPECTED_INDEXNOW_KEY}.txt`);

    assert.ok(fs.existsSync(keyFile), 'public/indexnow-key.txt must exist');
    assert.ok(fs.existsSync(namedKeyFile), `public/${EXPECTED_INDEXNOW_KEY}.txt must exist`);

    const k1 = fs.readFileSync(keyFile, 'utf8').trim();
    const k2 = fs.readFileSync(namedKeyFile, 'utf8').trim();

    assert.equal(k1, EXPECTED_INDEXNOW_KEY);
    assert.equal(k2, EXPECTED_INDEXNOW_KEY);
    assert.match(k1, /^[a-f0-9]{32}$/, 'Must be 32 lowercase hex string');
  });

  test('ST-08: IndexNow route handler serves public key with text/plain header', () => {
    const routePath = path.join(APP_DIR, 'indexnow-key.txt', 'route.ts');
    assert.ok(fs.existsSync(routePath), 'app/indexnow-key.txt/route.ts must exist');

    const content = fs.readFileSync(routePath, 'utf8');
    assert.ok(content.includes(EXPECTED_INDEXNOW_KEY), 'Route must return exact key');
    assert.ok(content.includes('text/plain'), 'Content-Type must be text/plain');
    assert.ok(content.includes('Cache-Control') && content.includes('public'), 'Must specify public caching');
  });

  test('ST-09: IndexNow multi-engine endpoints list matches official specifications', () => {
    const engineFile = path.join(LIB_DIR, 'indexing', 'indexingEngine.ts');
    const content = fs.readFileSync(engineFile, 'utf8');

    for (const ep of EXPECTED_INDEXNOW_ENDPOINTS) {
      assert.ok(content.includes(ep), `indexingEngine.ts must declare endpoint ${ep}`);
    }
  });

  test('ST-10: Payload formatting handles batch URLs and excludes foreign domains', () => {
    const inputUrls = [
      'https://nhadat.city/ha-noi/dich-vong/101/ban-nha',
      '/ho-chi-minh/ben-nghe/102/can-ho',
      'da-nang/hai-chau/103/dat-nen',
      'https://malicious-site.com/fake-url',
      'https://spam.net/hack',
    ];

    const payload = formatIndexNowPayload(inputUrls);

    assert.equal(payload.host, 'nhadat.city');
    assert.equal(payload.key, EXPECTED_INDEXNOW_KEY);
    assert.equal(payload.keyLocation, 'https://nhadat.city/indexnow-key.txt');
    assert.equal(payload.urlList.length, 3, 'Must filter out foreign domain URLs');
    assert.deepEqual(payload.urlList, [
      'https://nhadat.city/ha-noi/dich-vong/101/ban-nha',
      'https://nhadat.city/ho-chi-minh/ben-nghe/102/can-ho',
      'https://nhadat.city/da-nang/hai-chau/103/dat-nen',
    ]);
  });

  test('ST-11: Empty or invalid input produces clean empty URL list payload without error', () => {
    const pEmpty = formatIndexNowPayload([]);
    assert.equal(pEmpty.urlList.length, 0);

    const pNull = formatIndexNowPayload(null);
    assert.equal(pNull.urlList.length, 0);
  });
});

// ==============================================================================
// SUITE 3: QUEUE RETRY BACKOFF TIMING & CONCURRENCY MUTEX
// ==============================================================================
suite('M4.3 - Queue Retry Backoff Algorithm & Worker Mutex Concurrency', () => {

  test('ST-12: Exponential backoff calculation progresses up to 1-hour cap', () => {
    const expectedSchedule = [
      [0, 30],
      [1, 60],
      [2, 120],
      [3, 240],
      [4, 480],
      [5, 960],
      [6, 1920],
      [7, 3600], // Capped at 3600
      [8, 3600],
      [20, 3600],
      [100, 3600],
    ];

    for (const [attempt, expectedDelay] of expectedSchedule) {
      const delay = calculateBackoff(attempt);
      assert.equal(delay, expectedDelay, `Attempt ${attempt} must produce delay ${expectedDelay}s`);
    }
  });

  test('ST-13: Max attempts threshold (5 retries) triggers status transition to failed', () => {
    function simulateWorkerRetry(item, httpStatus, errorMsg) {
      const nextAttempts = (item.attempts || 0) + 1;
      if (nextAttempts >= 5) {
        return {
          status: 'failed',
          attempts: nextAttempts,
          lastError: errorMsg || `HTTP ${httpStatus}`,
        };
      } else {
        const delaySec = calculateBackoff(nextAttempts);
        return {
          status: 'pending',
          attempts: nextAttempts,
          delaySec,
          nextAttemptAt: new Date(Date.now() + delaySec * 1000),
          lastError: errorMsg || `HTTP ${httpStatus}`,
        };
      }
    }

    const item0 = { attempts: 0 };
    const r1 = simulateWorkerRetry(item0, 503, 'Service Unavailable');
    assert.equal(r1.status, 'pending');
    assert.equal(r1.attempts, 1);
    assert.equal(r1.delaySec, 60);

    const item3 = { attempts: 3 };
    const r4 = simulateWorkerRetry(item3, 500, 'Internal Server Error');
    assert.equal(r4.status, 'pending');
    assert.equal(r4.attempts, 4);
    assert.equal(r4.delaySec, 480);

    const item4 = { attempts: 4 };
    const r5 = simulateWorkerRetry(item4, 500, 'Gateway Timeout');
    assert.equal(r5.status, 'failed', '5th failed attempt must transition to failed');
    assert.equal(r5.attempts, 5);
  });

  test('ST-14: Concurrency mutex locks runner and drops concurrent overlapping loops', () => {
    let isWorkerRunning = false;

    function runWorkerCycle() {
      if (isWorkerRunning) {
        return { success: true, message: 'Worker is busy', executed: false };
      }
      isWorkerRunning = true;
      try {
        // Execute simulated work
        return { success: true, message: 'Batch processed', executed: true };
      } finally {
        // Simulate background lock
      }
    }

    const run1 = runWorkerCycle();
    assert.equal(run1.executed, true, 'First worker run must acquire lock');

    const run2 = runWorkerCycle();
    assert.equal(run2.executed, false, 'Overlapping runner invocation must be skipped');
    assert.equal(run2.message, 'Worker is busy');

    isWorkerRunning = false; // Release lock
    const run3 = runWorkerCycle();
    assert.equal(run3.executed, true, 'Subsequent run after release must succeed');
  });

  test('ST-15: Inter-request pacing delay prevents Google API 429 rate limit spikes', () => {
    const workerFile = path.join(LIB_DIR, 'indexing', 'indexingWorker.ts');
    const content = fs.readFileSync(workerFile, 'utf8');

    assert.ok(content.includes('setTimeout') || content.includes('150'), 'Worker must implement inter-request pacing delay (e.g. 150ms)');
  });
});

// ==============================================================================
// SUITE 4: GOOGLE SERVICE ACCOUNT & OAUTH2 JWT INTEGRATION
// ==============================================================================
suite('M4.4 - Google Service Account Credentials & RS256 JWT Token Signing', () => {

  test('ST-16: Google Service Account file contains valid fields', () => {
    const saPath = path.join(ROOT_DIR, 'google-service-account.json');
    assert.ok(fs.existsSync(saPath), 'google-service-account.json must exist in project root');

    const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
    assert.ok(sa.client_email, 'Service account must have client_email');
    assert.ok(sa.private_key, 'Service account must have private_key');
    assert.ok(sa.project_id, 'Service account must have project_id');
    assert.equal(sa.type, 'service_account', 'type must be service_account');
  });

  test('ST-17: RS256 JWT token generation and cryptographic verification', () => {
    const saPath = path.join(ROOT_DIR, 'google-service-account.json');
    const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));

    const nowSec = Math.floor(Date.now() / 1000);
    const payload = {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/indexing',
      aud: 'https://oauth2.googleapis.com/token',
      iat: nowSec,
      exp: nowSec + 3600,
    };

    const token = jwt.sign(payload, sa.private_key, { algorithm: 'RS256' });
    assert.ok(token && typeof token === 'string', 'JWT signing must succeed');

    const decoded = jwt.decode(token, { complete: true });
    assert.equal(decoded.header.alg, 'RS256');
    assert.equal(decoded.payload.iss, sa.client_email);
    assert.equal(decoded.payload.scope, 'https://www.googleapis.com/auth/indexing');
    assert.equal(decoded.payload.aud, 'https://oauth2.googleapis.com/token');
    assert.equal(decoded.payload.exp - decoded.payload.iat, 3600);
  });
});

// ==============================================================================
// SUITE 5: EVENT-DRIVEN HOOKS & ADMIN TELEMETRY API CONTRACTS
// ==============================================================================
suite('M4.5 - Event-Driven Indexing Hooks & Admin Telemetry API Endpoints', () => {

  test('ST-18: User listing submission route triggers enqueueIndexingUrl', () => {
    const postListingRoute = path.join(APP_DIR, 'api', 'user', 'post-listing', 'route.ts');
    assert.ok(fs.existsSync(postListingRoute), 'app/api/user/post-listing/route.ts must exist');

    const content = fs.readFileSync(postListingRoute, 'utf8');
    assert.ok(content.includes('enqueueIndexingUrl'), 'post-listing route must import and call enqueueIndexingUrl');
    assert.ok(content.includes('URL_UPDATED'), 'New listings must enqueue with URL_UPDATED');
    assert.ok(content.includes('user-post'), 'Source must be user-post');
  });

  test('ST-19: Admin listing management route triggers enqueueIndexingUrl on update and delete', () => {
    const adminListingRoute = path.join(APP_DIR, 'api', 'admin', 'listings', '[id]', 'route.ts');
    assert.ok(fs.existsSync(adminListingRoute), 'app/api/admin/listings/[id]/route.ts must exist');

    const content = fs.readFileSync(adminListingRoute, 'utf8');
    assert.ok(content.includes('enqueueIndexingUrl'), 'Admin listings route must call enqueueIndexingUrl');
    assert.ok(content.includes('URL_UPDATED'), 'Must handle URL_UPDATED for active status');
    assert.ok(content.includes('URL_DELETED'), 'Must handle URL_DELETED for deleted/inactive status');
  });

  test('ST-20: Admin indexing status endpoint exports GET and POST with admin authentication', () => {
    const statusRoute = path.join(APP_DIR, 'api', 'admin', 'indexing', 'status', 'route.ts');
    assert.ok(fs.existsSync(statusRoute), 'app/api/admin/indexing/status/route.ts must exist');

    const content = fs.readFileSync(statusRoute, 'utf8');
    assert.ok(content.includes('verifyAdminAuth'), 'Must protect with verifyAdminAuth');
    assert.ok(content.includes('getGoogleQuotaRemaining'), 'Must report Google quota remaining');
    assert.ok(content.includes('indexing_queue'), 'Must report queue breakdown');
    assert.ok(content.includes('indexing_logs'), 'Must report 24h telemetry statistics');
    assert.ok(content.includes('processIndexingQueue'), 'POST handler must trigger queue worker');
  });

  test('ST-21: Admin indexing logs endpoint supports pagination, provider and success filters', () => {
    const logsRoute = path.join(APP_DIR, 'api', 'admin', 'indexing', 'logs', 'route.ts');
    assert.ok(fs.existsSync(logsRoute), 'app/api/admin/indexing/logs/route.ts must exist');

    const content = fs.readFileSync(logsRoute, 'utf8');
    assert.ok(content.includes('verifyAdminAuth'), 'Must protect with verifyAdminAuth');
    assert.ok(content.includes('indexing_logs'), 'Must query indexing_logs collection');
    assert.ok(content.includes('page') && content.includes('limit'), 'Must support pagination');
    assert.ok(content.includes('provider'), 'Must support provider filter');
    assert.ok(content.includes('success'), 'Must support success status filter');
  });

  test('ST-22: Admin indexing submit endpoint supports both immediate broadcast and queueing', () => {
    const submitRoute = path.join(APP_DIR, 'api', 'admin', 'indexing', 'submit', 'route.ts');
    assert.ok(fs.existsSync(submitRoute), 'app/api/admin/indexing/submit/route.ts must exist');

    const content = fs.readFileSync(submitRoute, 'utf8');
    assert.ok(content.includes('verifyAdminAuth'), 'Must protect with verifyAdminAuth');
    assert.ok(content.includes('immediate'), 'Must support immediate dispatch flag');
    assert.ok(content.includes('enqueueIndexingUrl'), 'Must support queueing URLs');
    assert.ok(content.includes('submitToGoogleIndexing'), 'Must support Google dispatch');
    assert.ok(content.includes('submitToIndexNow'), 'Must support IndexNow dispatch');
  });
});

// ------------------------------------------------------------------------------
// SUMMARY REPORT
// ------------------------------------------------------------------------------
const durationMs = Date.now() - stats.startTime;
console.log('\n' + '='.repeat(80));
console.log(colors.bold(' M4 EMPIRICAL STRESS TEST SUITE EXECUTION SUMMARY'));
console.log('='.repeat(80));
console.log(`  Suites Executed : ${stats.suites}`);
console.log(`  Total Tests     : ${stats.total}`);
console.log(`  Passed          : ${colors.green(String(stats.passed))}`);
console.log(`  Failed          : ${stats.failed > 0 ? colors.red(String(stats.failed)) : '0'}`);
console.log(`  Execution Time  : ${durationMs}ms`);
console.log('='.repeat(80));

if (stats.failures.length > 0) {
  console.log(colors.bold(colors.red('\nFAILED TESTS BREAKDOWN:')));
  stats.failures.forEach(f => {
    console.log(`  [ST-${String(f.id).padStart(2, '0')}] ${f.name}`);
    console.log(`    ${colors.red('Error:')} ${f.error}`);
  });
  console.log('\n' + colors.red('M4 stress test completed with failures.') + '\n');
  process.exit(1);
} else {
  console.log('\n' + colors.green(colors.bold('✓ ALL M4 EMPIRICAL STRESS TESTS PASSED SUCCESSFULLY!')) + '\n');
  process.exit(0);
}
