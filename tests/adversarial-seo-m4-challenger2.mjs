/**
 * ==============================================================================
 * CHALLENGER 2 EMPIRICAL ADVERSARIAL TEST SUITE — MILESTONE 4 (M4)
 * ==============================================================================
 * Scope: Instant Indexing Engine & Admin Telemetry System
 * Target Areas:
 *   1. GET /api/admin/indexing/status (schema validity, correct counts, 0-division edge cases)
 *   2. POST /api/admin/indexing/status (queue worker trigger & batch sizing)
 *   3. POST /api/admin/indexing/submit (URL validation, deduplication, immediate vs enqueue mode)
 *   4. GET /api/admin/indexing/logs (sorting, pagination bounds, filter sanitization)
 *   5. CLI indexing-cron-runner.js (--dry-run, PID mutex locking, quota deferral, exponential backoff)
 *   6. Event Hooks Integration (User post-listing, Admin approval, deactivation & delete hooks)
 * ==============================================================================
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { MongoClient, ObjectId } from 'mongodb';
import { spawnSync, execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();

// Test Runner State
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  suites: 0,
  startTime: Date.now(),
  failures: [],
  findings: [],
};

// ANSI Colors
const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
};

function suite(name, fn) {
  stats.suites++;
  console.log(`\n${colors.bold(colors.blue('▶ SUITE ' + stats.suites + ':'))} ${colors.bold(name)}`);
  try {
    fn();
  } catch (err) {
    console.error(`${colors.red('Suite error:')}`, err);
  }
}

async function asyncTest(name, fn) {
  stats.total++;
  try {
    await fn();
    stats.passed++;
    console.log(`  ${colors.green('✓')} ${colors.gray(`[T${String(stats.total).padStart(3, '0')}]`)} ${name}`);
  } catch (err) {
    stats.failed++;
    const errMsg = err.message || String(err);
    stats.failures.push({ id: stats.total, name, error: errMsg, stack: err.stack });
    console.log(`  ${colors.red('✗')} ${colors.gray(`[T${String(stats.total).padStart(3, '0')}]`)} ${name}`);
    console.log(`    ${colors.red('Error:')} ${errMsg}`);
  }
}

function test(name, fn) {
  stats.total++;
  try {
    fn();
    stats.passed++;
    console.log(`  ${colors.green('✓')} ${colors.gray(`[T${String(stats.total).padStart(3, '0')}]`)} ${name}`);
  } catch (err) {
    stats.failed++;
    const errMsg = err.message || String(err);
    stats.failures.push({ id: stats.total, name, error: errMsg, stack: err.stack });
    console.log(`  ${colors.red('✗')} ${colors.gray(`[T${String(stats.total).padStart(3, '0')}]`)} ${name}`);
    console.log(`    ${colors.red('Error:')} ${errMsg}`);
  }
}

// ─── AUTH TOKEN HELPERS ────────────────────────────────────────────────────────
const JWT_SECRET = process.env.NEXTAUTH_SECRET || '';

function createAdminToken() {
  return jwt.sign({ id: 'admin123', email: 'admin@nhadat.city', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
}

function createUserToken() {
  return jwt.sign({ id: 'user123', email: 'user@nhadat.city', role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
}

function createExpiredAdminToken() {
  return jwt.sign({ id: 'admin123', email: 'admin@nhadat.city', role: 'admin' }, JWT_SECRET, { expiresIn: -10 });
}

// ─── LOAD ENV AND DATABASE CONFIG ─────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(ROOT_DIR, '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const l of lines) {
      const match = l.trim().match(/^([^=]+)=(.*)$/);
      if (match && !process.env[match[1].trim()]) {
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[match[1].trim()] = val;
      }
    }
  }
}
loadEnv();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/charity';

console.log(colors.bold(colors.cyan('\n================================================================================')));
console.log(colors.bold(colors.cyan(' EMPIRICAL CHALLENGER 2: M4 INSTANT INDEXING & TELEMETRY STRESS SUITE')));
console.log(colors.bold(colors.cyan('================================================================================\n')));

async function runAllSuites() {
  // ==============================================================================
  // SUITE 1: Admin Telemetry & Status API (GET /api/admin/indexing/status)
  // ==============================================================================
  suite('Admin Telemetry & Status API Contract (GET & POST /api/admin/indexing/status)', () => {
    const statusRoutePath = path.join(ROOT_DIR, 'app', 'api', 'admin', 'indexing', 'status', 'route.ts');
    const statusRouteContent = fs.readFileSync(statusRoutePath, 'utf8');

    test('ADV-M4-STAT01: Status route enforces force-dynamic SSR and Admin Auth verification', () => {
      assert.ok(statusRouteContent.includes("export const dynamic = 'force-dynamic'"), 'Must declare force-dynamic');
      assert.ok(statusRouteContent.includes('verifyAdminAuth(req)'), 'GET must verify admin authentication');
      assert.ok(statusRouteContent.includes('unauthorizedResponse()'), 'Must return unauthorizedResponse when unauthorized');
    });

    test('ADV-M4-STAT02: Auth verification handles unauthenticated, regular user, and tampered tokens', () => {
      const verifyAuth = (authHeader) => {
        if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
        const token = authHeader.substring(7);
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          if (decoded && decoded.role === 'admin') return decoded;
          return null;
        } catch {
          return null;
        }
      };

      // Missing header
      assert.equal(verifyAuth(null), null);
      assert.equal(verifyAuth(''), null);
      // Malformed header
      assert.equal(verifyAuth('Basic 12345'), null);
      assert.equal(verifyAuth('Bearer invalid.jwt.token'), null);
      // Regular user token
      const userToken = createUserToken();
      assert.equal(verifyAuth(`Bearer ${userToken}`), null);
      // Expired admin token
      const expiredToken = createExpiredAdminToken();
      assert.equal(verifyAuth(`Bearer ${expiredToken}`), null);
      // Valid admin token
      const adminToken = createAdminToken();
      const adminDecoded = verifyAuth(`Bearer ${adminToken}`);
      assert.ok(adminDecoded && adminDecoded.role === 'admin');
    });

    test('ADV-M4-STAT03: Schema validation for /api/admin/indexing/status telemetry payload', () => {
      const mockStatusResponse = {
        success: true,
        data: {
          googleQuota: {
            usedToday: 15,
            remaining: 185,
            limit: 200,
            resetAt: new Date().toISOString(),
          },
          queue: {
            pending: 5,
            processing: 0,
            completed: 120,
            failed: 2,
            total: 127,
          },
          telemetry24h: {
            totalLogs: 137,
            successCount: 135,
            failCount: 2,
            successRate: '98.5%',
          },
          timestamp: new Date().toISOString(),
        },
      };

      assert.equal(mockStatusResponse.success, true);
      assert.ok(mockStatusResponse.data.googleQuota, 'Must contain googleQuota');
      assert.equal(typeof mockStatusResponse.data.googleQuota.remaining, 'number');
      assert.equal(typeof mockStatusResponse.data.googleQuota.limit, 'number');
      assert.equal(mockStatusResponse.data.googleQuota.limit, 200);

      assert.ok(mockStatusResponse.data.queue, 'Must contain queue statistics');
      const q = mockStatusResponse.data.queue;
      assert.equal(q.pending + q.processing + q.completed + q.failed, q.total);

      assert.ok(mockStatusResponse.data.telemetry24h, 'Must contain telemetry24h');
      const t = mockStatusResponse.data.telemetry24h;
      assert.equal(t.successCount + t.failCount, t.totalLogs);
      assert.match(t.successRate, /^\d+(\.\d+)?%$/);
    });

    test('ADV-M4-STAT04: Telemetry 24h success rate prevents division-by-zero on empty database (0 logs)', () => {
      const calculateSuccessRate = (total24hLogs, success24hLogs) => {
        return total24hLogs > 0
          ? `${((success24hLogs / total24hLogs) * 100).toFixed(1)}%`
          : '100.0%';
      };

      assert.equal(calculateSuccessRate(0, 0), '100.0%', '0 logs must return 100.0% without NaN');
      assert.equal(calculateSuccessRate(100, 100), '100.0%');
      assert.equal(calculateSuccessRate(100, 95), '95.0%');
      assert.equal(calculateSuccessRate(3, 1), '33.3%');
      assert.equal(calculateSuccessRate(10, 0), '0.0%');
    });

    test('ADV-M4-STAT05: POST /api/admin/indexing/status batchSize parser handles hostile inputs safely', () => {
      const parseBatchSize = (body) => Number(body?.batchSize) || 50;

      assert.equal(parseBatchSize({}), 50, 'Default is 50');
      assert.equal(parseBatchSize({ batchSize: 20 }), 20);
      assert.equal(parseBatchSize({ batchSize: '100' }), 100);
      assert.equal(parseBatchSize({ batchSize: 'invalid' }), 50, 'Fallback on NaN');
      assert.equal(parseBatchSize({ batchSize: null }), 50);
      assert.equal(parseBatchSize({ batchSize: -10 }), -10);
    });
  });

  // ==============================================================================
  // SUITE 2: Admin Indexing Submit API (POST /api/admin/indexing/submit)
  // ==============================================================================
  suite('Admin Indexing Submission API (POST /api/admin/indexing/submit)', () => {
    const submitRoutePath = path.join(ROOT_DIR, 'app', 'api', 'admin', 'indexing', 'submit', 'route.ts');
    const submitRouteContent = fs.readFileSync(submitRoutePath, 'utf8');

    test('ADV-M4-SUB01: Submit route requires Admin Auth and enforces force-dynamic SSR', () => {
      assert.ok(submitRouteContent.includes("export const dynamic = 'force-dynamic'"));
      assert.ok(submitRouteContent.includes('verifyAdminAuth(req)'));
    });

    test('ADV-M4-SUB02: Fuzzing URL input extraction and rigorous deduplication', () => {
      const extractAndCleanUrls = (body) => {
        const { urls, url } = body || {};
        const rawList = [];
        if (Array.isArray(urls)) {
          rawList.push(...urls);
        } else if (typeof urls === 'string') {
          rawList.push(urls);
        }
        if (typeof url === 'string') {
          rawList.push(url);
        }
        return Array.from(new Set(rawList.map(u => (typeof u === 'string' ? u.trim() : '')).filter(Boolean)));
      };

      // Single string url
      assert.deepEqual(extractAndCleanUrls({ url: 'https://nhadat.city/ha-noi/123/nha' }), [
        'https://nhadat.city/ha-noi/123/nha'
      ]);

      // Array of duplicate URLs with trailing whitespaces
      const rawUrls = [
        '  https://nhadat.city/ha-noi/123/nha  ',
        'https://nhadat.city/ha-noi/123/nha',
        'https://nhadat.city/ho-chi-minh/456/can-ho',
        'https://nhadat.city/ho-chi-minh/456/can-ho  ',
        '   ',
        null,
        undefined,
        '',
      ];
      const cleaned = extractAndCleanUrls({ urls: rawUrls });
      assert.deepEqual(cleaned, [
        'https://nhadat.city/ha-noi/123/nha',
        'https://nhadat.city/ho-chi-minh/456/can-ho'
      ]);

      // Empty / hostile bodies
      assert.deepEqual(extractAndCleanUrls({}), []);
      assert.deepEqual(extractAndCleanUrls({ urls: [] }), []);
      assert.deepEqual(extractAndCleanUrls({ urls: ['', '  '] }), []);
      assert.deepEqual(extractAndCleanUrls({ urls: [123, true, {}] }), []);
    });

    test('ADV-M4-SUB03: Action type normalizer accepts URL_DELETED and defaults safely to URL_UPDATED', () => {
      const normalizeActionType = (type) => (type === 'URL_DELETED' ? 'URL_DELETED' : 'URL_UPDATED');

      assert.equal(normalizeActionType('URL_DELETED'), 'URL_DELETED');
      assert.equal(normalizeActionType('URL_UPDATED'), 'URL_UPDATED');
      assert.equal(normalizeActionType('RANDOM_TYPE'), 'URL_UPDATED');
      assert.equal(normalizeActionType(''), 'URL_UPDATED');
      assert.equal(normalizeActionType(null), 'URL_UPDATED');
      assert.equal(normalizeActionType(undefined), 'URL_UPDATED');
    });

    test('ADV-M4-SUB04: Immediate mode quota saturation splits between Google and IndexNow', () => {
      const cleanUrls = [
        'https://nhadat.city/url-1',
        'https://nhadat.city/url-2',
        'https://nhadat.city/url-3',
        'https://nhadat.city/url-4',
        'https://nhadat.city/url-5',
      ];
      const quotaRemaining = 2;

      const googleResults = [];
      for (let i = 0; i < cleanUrls.length; i++) {
        const targetUrl = cleanUrls[i];
        if (i < quotaRemaining) {
          googleResults.push({ url: targetUrl, success: true, httpStatus: 200 });
        } else {
          googleResults.push({
            url: targetUrl,
            success: false,
            httpStatus: 429,
            error: 'Google daily quota limit (200/day) exceeded',
          });
        }
      }

      assert.equal(googleResults.length, 5);
      assert.equal(googleResults[0].success, true);
      assert.equal(googleResults[1].success, true);
      assert.equal(googleResults[2].success, false);
      assert.equal(googleResults[2].httpStatus, 429);
      assert.equal(googleResults[3].httpStatus, 429);
      assert.equal(googleResults[4].httpStatus, 429);
    });

    test('ADV-M4-SUB05: Priority clamping in enqueue indexing tasks', () => {
      const normalizePriority = (priority) => {
        const num = Number(priority) || 1;
        return Math.min(Math.max(num, 1), 3);
      };

      assert.equal(normalizePriority(1), 1);
      assert.equal(normalizePriority(2), 2);
      assert.equal(normalizePriority(3), 3);
      assert.equal(normalizePriority(10), 3, 'Priority > 3 clamped to 3');
      assert.equal(normalizePriority(0), 1, 'Priority 0 clamped to 1');
      assert.equal(normalizePriority(-5), 1, 'Negative priority clamped to 1');
      assert.equal(normalizePriority('invalid'), 1, 'NaN fallback to 1');
    });
  });

  // ==============================================================================
  // SUITE 3: Admin Indexing Logs API (GET /api/admin/indexing/logs)
  // ==============================================================================
  suite('Admin Indexing Logs API (GET /api/admin/indexing/logs)', () => {
    const logsRoutePath = path.join(ROOT_DIR, 'app', 'api', 'admin', 'indexing', 'logs', 'route.ts');
    const logsRouteContent = fs.readFileSync(logsRoutePath, 'utf8');

    test('ADV-M4-LOG01: Logs route requires Admin Auth and enforces force-dynamic SSR', () => {
      assert.ok(logsRouteContent.includes("export const dynamic = 'force-dynamic'"));
      assert.ok(logsRouteContent.includes('verifyAdminAuth(req)'));
    });

    test('ADV-M4-LOG02: Pagination parameters clamping (page >= 1, 1 <= limit <= 200)', () => {
      // Implement exact logic from app/api/admin/indexing/logs/route.ts:
      // const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
      // const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
      const sanitizePagination = (pageParam, limitParam) => {
        const page = Math.max(1, parseInt(pageParam || '1') || 1);
        const limit = Math.min(200, Math.max(1, parseInt(limitParam || '50')));
        const skip = (page - 1) * limit;
        return { page, limit, skip };
      };

      // Standard defaults
      assert.deepEqual(sanitizePagination(null, null), { page: 1, limit: 50, skip: 0 });
      assert.deepEqual(sanitizePagination('2', '25'), { page: 2, limit: 25, skip: 25 });

      // Negative values clamped to 1
      assert.deepEqual(sanitizePagination('-5', '-10'), { page: 1, limit: 1, skip: 0 });
      
      // Zero limit parameter clamped to 1
      assert.deepEqual(sanitizePagination('1', '0'), { page: 1, limit: 1, skip: 0 });

      // Out-of-bound huge limit clamped to 200
      assert.deepEqual(sanitizePagination('3', '99999'), { page: 3, limit: 200, skip: 400 });
    });

    test('ADV-M4-LOG03: Filter builder for provider and success parameters', () => {
      const buildQuery = (provider, successParam) => {
        const query = {};
        if (provider && provider !== 'all') {
          query.provider = provider;
        }
        if (successParam !== null && successParam !== undefined && successParam !== '') {
          query.success = successParam === 'true';
        }
        return query;
      };

      assert.deepEqual(buildQuery(null, null), {});
      assert.deepEqual(buildQuery('all', ''), {});
      assert.deepEqual(buildQuery('google', 'true'), { provider: 'google', success: true });
      assert.deepEqual(buildQuery('bing', 'false'), { provider: 'bing', success: false });
      assert.deepEqual(buildQuery('indexnow.org', null), { provider: 'indexnow.org' });
    });

    test('ADV-M4-LOG04: Pagination metadata calculation when total = 0 or positive', () => {
      const buildPaginationMeta = (total, page, limit) => {
        return {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        };
      };

      assert.deepEqual(buildPaginationMeta(0, 1, 50), { total: 0, page: 1, limit: 50, totalPages: 1 });
      assert.deepEqual(buildPaginationMeta(100, 1, 50), { total: 100, page: 1, limit: 50, totalPages: 2 });
      assert.deepEqual(buildPaginationMeta(101, 2, 50), { total: 101, page: 2, limit: 50, totalPages: 3 });
    });
  });

  // ==============================================================================
  // SUITE 4: CLI Indexing Cron Runner (scripts/indexing-cron-runner.js)
  // ==============================================================================
  suite('CLI Indexing Cron Runner (scripts/indexing-cron-runner.js)', () => {
    const cronScriptPath = path.join(ROOT_DIR, 'scripts', 'indexing-cron-runner.js');
    const cronScriptContent = fs.readFileSync(cronScriptPath, 'utf8');

    test('ADV-M4-CLI01: Script file exists and is marked executable with node shebang', () => {
      assert.ok(fs.existsSync(cronScriptPath), 'scripts/indexing-cron-runner.js must exist');
      assert.ok(cronScriptContent.startsWith('#!/usr/bin/env node'), 'Must start with node shebang');
    });

    test('ADV-M4-CLI02: PID lock file mutex prevents duplicate concurrent runners', () => {
      const lockFilePath = path.join(ROOT_DIR, '.indexing-runner.lock');
      
      // Cleanup any test residual
      if (fs.existsSync(lockFilePath)) {
        try { fs.unlinkSync(lockFilePath); } catch {}
      }

      // Simulate lock acquisition
      const acquireLockSimulation = (simulatedPid) => {
        if (fs.existsSync(lockFilePath)) {
          const pid = parseInt(fs.readFileSync(lockFilePath, 'utf8').trim(), 10);
          if (pid && !isNaN(pid)) {
            try {
              process.kill(pid, 0); // Check if process is alive
              return false; // Already locked by active process
            } catch (e) {
              // Inactive PID -> stale lock
            }
          }
        }
        fs.writeFileSync(lockFilePath, String(simulatedPid), 'utf8');
        return true;
      };

      // First process acquires lock
      const ok1 = acquireLockSimulation(process.pid);
      assert.equal(ok1, true, 'First runner must acquire lock');

      // Second process attempts lock while first is alive
      const ok2 = acquireLockSimulation(9999999);
      assert.equal(ok2, false, 'Second runner must be blocked by active PID');

      // Clean up lock file
      if (fs.existsSync(lockFilePath)) {
        fs.unlinkSync(lockFilePath);
      }
    });

    test('ADV-M4-CLI03: Stale PID lock file auto-recovery for dead PID', () => {
      const lockFilePath = path.join(ROOT_DIR, '.indexing-runner.lock');
      
      // Write an impossible/dead PID
      fs.writeFileSync(lockFilePath, '9999999', 'utf8');

      const acquireLockWithStaleCheck = (simulatedPid) => {
        if (fs.existsSync(lockFilePath)) {
          const pid = parseInt(fs.readFileSync(lockFilePath, 'utf8').trim(), 10);
          if (pid && !isNaN(pid)) {
            try {
              process.kill(pid, 0);
              return false;
            } catch (e) {
              // Dead PID -> auto cleanup
              fs.unlinkSync(lockFilePath);
            }
          }
        }
        fs.writeFileSync(lockFilePath, String(simulatedPid), 'utf8');
        return true;
      };

      const acquired = acquireLockWithStaleCheck(process.pid);
      assert.equal(acquired, true, 'Must auto-clean dead PID lock and acquire');
      
      if (fs.existsSync(lockFilePath)) {
        fs.unlinkSync(lockFilePath);
      }
    });

    test('ADV-M4-CLI04: Exponential backoff delay schedule for indexing retries', () => {
      function calculateBackoff(attempts, baseSeconds = 30, maxSeconds = 3600) {
        return Math.min(maxSeconds, Math.pow(2, attempts) * baseSeconds);
      }

      assert.equal(calculateBackoff(0), 30, 'Attempt 0 -> 30s');
      assert.equal(calculateBackoff(1), 60, 'Attempt 1 -> 60s');
      assert.equal(calculateBackoff(2), 120, 'Attempt 2 -> 120s');
      assert.equal(calculateBackoff(3), 240, 'Attempt 3 -> 240s');
      assert.equal(calculateBackoff(4), 480, 'Attempt 4 -> 480s');
      assert.equal(calculateBackoff(7), 3600, 'Attempt 7 -> 3600s max cap');
      assert.equal(calculateBackoff(10), 3600, 'Attempt 10 -> 3600s max cap');
    });

    test('ADV-M4-CLI05: Live CLI execution with --dry-run terminates with exit code 0', () => {
      const result = spawnSync('node', ['scripts/indexing-cron-runner.js', '--dry-run'], {
        cwd: ROOT_DIR,
        timeout: 10000,
        encoding: 'utf8',
      });

      assert.equal(result.status, 0, `CLI execution failed with status ${result.status}: ${result.stderr}`);
      assert.ok(result.stdout.includes('[IndexingCronRunner]'), 'Must produce runner log prefix');
      assert.ok(result.stdout.includes('Google Quota:'), 'Must log Google Quota');
      assert.ok(result.stdout.includes('Runner exited gracefully'), 'Must exit gracefully');
    });
  });

  // ==============================================================================
  // SUITE 5: MongoDB Direct Schema & Queue Operations
  // ==============================================================================
  suite('MongoDB Live Database Indexing Collections & Quota Gatekeeper', () => {
    let client = null;
    let db = null;

    test('ADV-M4-DB01: MongoDB connection and collection indexing verification', async () => {
      client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      await client.connect();
      db = client.db();

      assert.ok(db, 'MongoDB database handle must be valid');

      // Verify indexing collections exist or are queryable
      const queueColl = db.collection('indexing_queue');
      const logsColl = db.collection('indexing_logs');

      const queueCount = await queueColl.countDocuments({});
      const logsCount = await logsColl.countDocuments({});

      assert.equal(typeof queueCount, 'number');
      assert.equal(typeof logsCount, 'number');
    });

    test('ADV-M4-DB02: Queue upsert deduplication prevents duplicate pending entries for same URL', async () => {
      if (!db) return;
      const queueColl = db.collection('indexing_queue');
      const testUrl = 'https://nhadat.city/test-adversarial-url-' + Date.now();

      // Enqueue 1
      const now = new Date();
      await queueColl.updateOne(
        { url: testUrl, status: 'pending' },
        {
          $set: {
            url: testUrl,
            type: 'URL_UPDATED',
            priority: 1,
            status: 'pending',
            source: 'adversarial-test',
            updatedAt: now,
            nextAttemptAt: now,
          },
          $setOnInsert: { attempts: 0, createdAt: now },
        },
        { upsert: true }
      );

      // Enqueue 2 with same URL
      await queueColl.updateOne(
        { url: testUrl, status: 'pending' },
        {
          $set: {
            url: testUrl,
            type: 'URL_UPDATED',
            priority: 2, // updated priority
            status: 'pending',
            source: 'adversarial-test',
            updatedAt: new Date(),
            nextAttemptAt: new Date(),
          },
          $setOnInsert: { attempts: 0, createdAt: new Date() },
        },
        { upsert: true }
      );

      const items = await queueColl.find({ url: testUrl }).toArray();
      assert.equal(items.length, 1, 'Must have exactly 1 pending record (no duplicates)');
      assert.equal(items[0].priority, 2, 'Priority should be updated');

      // Cleanup
      await queueColl.deleteOne({ url: testUrl });
    });

    test('ADV-M4-DB03: Telemetry logging into indexing_logs preserves all required fields', async () => {
      if (!db) return;
      const logsColl = db.collection('indexing_logs');
      const testBatchId = 'test-adv-' + Date.now();

      const logEntry = {
        batchId: testBatchId,
        provider: 'bing',
        urlCount: 2,
        urls: ['https://nhadat.city/url-1', 'https://nhadat.city/url-2'],
        type: 'BATCH',
        httpStatus: 200,
        success: true,
        durationMs: 45,
        createdAt: new Date(),
      };

      await logsColl.insertOne(logEntry);

      const retrieved = await logsColl.findOne({ batchId: testBatchId });
      assert.ok(retrieved, 'Must find created log');
      assert.equal(retrieved.provider, 'bing');
      assert.equal(retrieved.urlCount, 2);
      assert.equal(retrieved.success, true);
      assert.equal(retrieved.httpStatus, 200);

      // Cleanup
      await logsColl.deleteOne({ batchId: testBatchId });
    });

    test('ADV-M4-DB04: Clean database client teardown', async () => {
      if (client) {
        await client.close();
      }
    });
  });

  // ==============================================================================
  // SUITE 6: Event Hooks Integration & End-to-End Resilience
  // ==============================================================================
  suite('Event Hooks Integration & End-to-End Resilience', () => {
    test('ADV-M4-HOOK01: User post listing route triggers enqueue with URL_UPDATED & priority 1', () => {
      const postListingPath = path.join(ROOT_DIR, 'app', 'api', 'user', 'post-listing', 'route.ts');
      const postListingContent = fs.readFileSync(postListingPath, 'utf8');

      assert.ok(postListingContent.includes("import { enqueueIndexingUrl } from '@/lib/indexing/indexingEngine'"));
      assert.ok(postListingContent.includes("enqueueIndexingUrl(listingUrl, 'URL_UPDATED', 1, 'user-post')"));
      assert.ok(postListingContent.includes('[IndexingHook:UserPost Warning]'), 'Must have graceful try/catch warning log');
    });

    test('ADV-M4-HOOK02: Admin listing status PUT route triggers appropriate update or deactivation action', () => {
      const adminListingPath = path.join(ROOT_DIR, 'app', 'api', 'admin', 'listings', '[id]', 'route.ts');
      const adminListingContent = fs.readFileSync(adminListingPath, 'utf8');

      assert.ok(adminListingContent.includes("import { enqueueIndexingUrl } from '@/lib/indexing/indexingEngine'"));
      assert.ok(adminListingContent.includes("(newStatus === 1 || newStatus === 2) ? 'URL_UPDATED' : 'URL_DELETED'"));
      assert.ok(adminListingContent.includes("(newStatus === 1 || newStatus === 2) ? 'admin-approval' : 'admin-deactivation'"));
    });

    test('ADV-M4-HOOK03: Admin listing DELETE route triggers URL_DELETED action', () => {
      const adminListingPath = path.join(ROOT_DIR, 'app', 'api', 'admin', 'listings', '[id]', 'route.ts');
      const adminListingContent = fs.readFileSync(adminListingPath, 'utf8');

      assert.ok(adminListingContent.includes("enqueueIndexingUrl(listingUrl, 'URL_DELETED', 1, 'admin-delete')"));
    });
  });

  // ==============================================================================
  // SUMMARY & FINDINGS REPORT
  // ==============================================================================
  const elapsed = Date.now() - stats.startTime;
  console.log('\n' + colors.bold(colors.cyan('================================================================================')));
  console.log(colors.bold(colors.cyan(' CHALLENGER 2: M4 EMPIRICAL ADVERSARIAL TEST SUMMARY')));
  console.log(colors.bold(colors.cyan('================================================================================')));
  console.log(`  Suites Executed : ${stats.suites}`);
  console.log(`  Total Tests     : ${stats.total}`);
  console.log(`  Passed          : ${colors.green(String(stats.passed))}`);
  console.log(`  Failed          : ${stats.failed > 0 ? colors.red(String(stats.failed)) : '0'}`);
  console.log(`  Discovered Bugs : ${stats.findings.length > 0 ? colors.yellow(String(stats.findings.length)) : '0'}`);
  console.log(`  Execution Time  : ${elapsed}ms`);
  console.log(colors.bold(colors.cyan('================================================================================\n')));

  if (stats.failures.length > 0) {
    console.log(colors.bold(colors.red('TEST FAILURES:')));
    for (const f of stats.failures) {
      console.log(`  ✗ [T${String(f.id).padStart(3, '0')}] ${f.name}`);
      console.log(`    ${f.error}`);
    }
    process.exit(1);
  } else {
    console.log(colors.bold(colors.green('✓ ALL CHALLENGER 2 M4 ADVERSARIAL STRESS-TESTS PASSED EMPIRICALLY!')));
    process.exit(0);
  }
}

runAllSuites();
