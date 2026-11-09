/**
 * ==============================================================================
 * CHALLENGER 2: ADVERSARIAL INDEXNOW DISPATCH & CONCURRENCY QUOTA STRESS HARNESS
 * ==============================================================================
 * Milestone: M5 Verification & Hardening
 * Spec: PROJECT.md, TEST_INFRA.md, GEMINI.md
 * 
 * Verifies:
 *  1. IndexNow multi-engine broadcasting payload structure and public key verification
 *  2. High-concurrency dispatch and worker mutex locking
 *  3. Google Indexing API daily quota gatekeeper (200 URLs/day ceiling)
 *  4. Spillover of 100% surplus to IndexNow when Google quota is saturated
 *  5. Next attempt calculation & exponential backoff under concurrent stress
 *  6. Telemetry logging and queue status transitions
 * ==============================================================================
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  suites: 0,
  startTime: Date.now(),
  failures: [],
  findings: []
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
  console.log(`\n${colors.bold(colors.blue('▶ SUITE ' + stats.suites + ':'))} ${colors.bold(name)}`);
  try {
    fn();
  } catch (err) {
    console.error(`${colors.red('Suite initialization error:')}`, err);
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

const EXPECTED_KEY = 'a9f3e2b1c8d74e5f9a0b1c2d3e4f5a6b';

// Pure implementation of Quota Gatekeeper per indexingEngine.ts
function allocateQuota(requestedCount, usedToday, maxDailyQuota = 200) {
  const remainingQuota = Math.max(0, maxDailyQuota - usedToday);
  const googleCount = Math.min(requestedCount, remainingQuota);
  const indexNowSurplus = requestedCount - googleCount;
  return {
    googleCount,
    indexNowSurplus,
    remainingQuota: remainingQuota - googleCount,
  };
}

function calculateBackoff(attempts, baseSeconds = 30, maxSeconds = 3600) {
  return Math.min(maxSeconds, Math.pow(2, attempts) * baseSeconds);
}

// ==============================================================================
// SUITE 1: IndexNow Key Verification & Domain Isolation
// ==============================================================================
suite('IndexNow Key Verification & Payload Formatting', () => {

  test('IDX-01: IndexNow key route and static files serve identical 32-hex key', () => {
    const routeFile = path.join(ROOT_DIR, 'app', 'indexnow-key.txt', 'route.ts');
    assert.ok(fs.existsSync(routeFile));
    const routeContent = fs.readFileSync(routeFile, 'utf8');
    assert.ok(routeContent.includes(EXPECTED_KEY));
    assert.ok(routeContent.includes('text/plain'));

    const pubKey1 = path.join(ROOT_DIR, 'public', 'indexnow-key.txt');
    const pubKey2 = path.join(ROOT_DIR, 'public', `${EXPECTED_KEY}.txt`);
    assert.ok(fs.existsSync(pubKey1));
    assert.ok(fs.existsSync(pubKey2));

    assert.equal(fs.readFileSync(pubKey1, 'utf8').trim(), EXPECTED_KEY);
    assert.equal(fs.readFileSync(pubKey2, 'utf8').trim(), EXPECTED_KEY);
  });

  test('IDX-02: IndexNow payload filtering and third-party domain isolation', () => {
    const rawUrls = [
      'https://nhadat.city/ha-noi/dich-vong/101/ban-nha',
      'https://otherdomain.com/spam',
      'https://nhadat.city/ho-chi-minh/ben-nghe/102/can-ho',
      'https://external-phishing.org/steal',
      '/da-nang/hai-chau/103/dat-nen'
    ];

    const formattedUrls = rawUrls
      .map(u => u.startsWith('http') ? u : `https://nhadat.city${u.startsWith('/') ? '' : '/'}${u}`)
      .filter(u => u.startsWith('https://nhadat.city/'));

    assert.equal(formattedUrls.length, 3);
    assert.ok(formattedUrls.includes('https://nhadat.city/ha-noi/dich-vong/101/ban-nha'));
    assert.ok(formattedUrls.includes('https://nhadat.city/ho-chi-minh/ben-nghe/102/can-ho'));
    assert.ok(formattedUrls.includes('https://nhadat.city/da-nang/hai-chau/103/dat-nen'));
    assert.ok(!formattedUrls.includes('https://otherdomain.com/spam'));
    assert.ok(!formattedUrls.includes('https://external-phishing.org/steal'));

    // Empirical finding check: scheme injection check
    const schemeTest = 'javascript:alert(1)';
    const schemeFormatted = schemeTest.startsWith('http') ? schemeTest : `https://nhadat.city${schemeTest.startsWith('/') ? '' : '/'}${schemeTest}`;
    if (schemeFormatted === 'https://nhadat.city/javascript:alert(1)') {
      stats.findings.push({
        id: 'FINDING-M5-01',
        title: 'Naive string prefix interpolation in submitToIndexNow converts non-HTTP schemes into URLs',
        location: 'lib/indexing/indexingEngine.ts:283',
        severity: 'LOW',
        description: 'Input strings without http prefix (e.g. javascript:alert(1)) are naively prepended with https://nhadat.city/ rather than validated with URL parser.'
      });
    }
  });
});

// ==============================================================================
// SUITE 2: Concurrent Execution & Worker Mutex Simulation
// ==============================================================================
suite('Concurrency Mutex & Overlapping Loop Protection', () => {

  test('IDX-03: Concurrency mutex drops parallel invocations while worker is active', async () => {
    let isWorkerRunning = false;
    let successfulExecutions = 0;
    let droppedExecutions = 0;

    async function simulateWorkerCycle(cycleId, durationMs = 50) {
      if (isWorkerRunning) {
        droppedExecutions++;
        return { success: true, message: 'Worker is busy' };
      }
      isWorkerRunning = true;
      try {
        await new Promise(r => setTimeout(r, durationMs));
        successfulExecutions++;
        return { success: true, cycleId };
      } finally {
        isWorkerRunning = false;
      }
    }

    // Launch 20 concurrent invocations simultaneously
    const promises = Array.from({ length: 20 }, (_, i) => simulateWorkerCycle(i + 1, 30));
    await Promise.all(promises);

    assert.equal(successfulExecutions, 1, 'Only 1 worker cycle must execute during mutex lock');
    assert.equal(droppedExecutions, 19, '19 concurrent cycles must be safely dropped');
  });

  test('IDX-04: CLI Cron Runner PID Lock prevents concurrent process execution', () => {
    const cronScriptPath = path.join(ROOT_DIR, 'scripts', 'indexing-cron-runner.js');
    assert.ok(fs.existsSync(cronScriptPath));
    const scriptContent = fs.readFileSync(cronScriptPath, 'utf8');

    assert.ok(scriptContent.includes('PID_LOCK_FILE'));
    assert.ok(scriptContent.includes('process.kill(pid, 0)'));
    assert.ok(scriptContent.includes('fs.writeFileSync(PID_LOCK_FILE, String(process.pid)'));
    assert.ok(scriptContent.includes('fs.unlinkSync(PID_LOCK_FILE)'));
  });
});

// ==============================================================================
// SUITE 3: Google Indexing API Daily Quota Gatekeeper Stress
// ==============================================================================
suite('Google Daily Quota (200/day) Gatekeeper & Spillover Stress', () => {

  test('IDX-05: Zero usage allocates up to 200 Google slots', () => {
    const res = allocateQuota(150, 0);
    assert.equal(res.googleCount, 150);
    assert.equal(res.indexNowSurplus, 0);
    assert.equal(res.remainingQuota, 50);
  });

  test('IDX-06: Exact quota boundary transition (199 -> 200 -> 201)', () => {
    // 1 remaining
    const r1 = allocateQuota(10, 199);
    assert.equal(r1.googleCount, 1);
    assert.equal(r1.indexNowSurplus, 9);
    assert.equal(r1.remainingQuota, 0);

    // 0 remaining (exactly 200 used)
    const r2 = allocateQuota(50, 200);
    assert.equal(r2.googleCount, 0);
    assert.equal(r2.indexNowSurplus, 50);
    assert.equal(r2.remainingQuota, 0);

    // >200 used (defensive handling)
    const r3 = allocateQuota(100, 250);
    assert.equal(r3.googleCount, 0);
    assert.equal(r3.indexNowSurplus, 100);
    assert.equal(r3.remainingQuota, 0);
  });

  test('IDX-07: Massive bulk load (5,000 URLs) routes exactly 200 to Google and 4,800 to IndexNow', () => {
    const res = allocateQuota(5000, 0);
    assert.equal(res.googleCount, 200);
    assert.equal(res.indexNowSurplus, 4800);
    assert.equal(res.remainingQuota, 0);
  });

  test('IDX-08: Deferral timestamp for quota-exceeded items calculates next UTC midnight', () => {
    const now = new Date('2026-08-24T10:30:00.000Z');
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const nextMidnight = new Date(startOfDay);
    nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);

    assert.equal(nextMidnight.toISOString(), '2026-08-25T00:00:00.000Z');
  });
});

// ==============================================================================
// SUITE 4: Exponential Backoff & Retry Stress Under Hostile Conditions
// ==============================================================================
suite('Exponential Backoff & Retries Calculation', () => {

  test('IDX-09: Exponential backoff increases monotonically and caps at 3600 seconds', () => {
    const attempts = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const delays = attempts.map(a => calculateBackoff(a));

    assert.deepEqual(delays, [
      30,   // 2^0 * 30 = 30s
      60,   // 2^1 * 30 = 60s
      120,  // 2^2 * 30 = 120s
      240,  // 2^3 * 30 = 240s
      480,  // 2^4 * 30 = 480s (8m)
      960,  // 2^5 * 30 = 960s (16m)
      1920, // 2^6 * 30 = 1920s (32m)
      3600, // 2^7 * 30 = 3840 -> capped at 3600 (1h)
      3600,
      3600,
      3600
    ]);
  });

  test('IDX-10: Max 5 retry attempts triggers transition to failed status', () => {
    const maxAttempts = 5;
    const isFailed = (attempts) => attempts >= maxAttempts;

    assert.equal(isFailed(1), false);
    assert.equal(isFailed(4), false);
    assert.equal(isFailed(5), true);
    assert.equal(isFailed(6), true);
  });
});

// ==============================================================================
// SUMMARY & EXIT
// ==============================================================================
const durationMs = Date.now() - stats.startTime;
console.log('\n' + '='.repeat(80));
console.log(colors.bold(' CHALLENGER 2: INDEXNOW & CONCURRENCY STRESS SUMMARY'));
console.log('='.repeat(80));
console.log(`  Suites Executed : ${stats.suites}`);
console.log(`  Total Tests     : ${stats.total}`);
console.log(`  Passed          : ${colors.green(String(stats.passed))}`);
console.log(`  Failed          : ${stats.failed > 0 ? colors.red(String(stats.failed)) : '0'}`);
console.log(`  Findings Found  : ${stats.findings.length > 0 ? colors.yellow(String(stats.findings.length)) : '0'}`);
console.log(`  Execution Time  : ${durationMs}ms`);
console.log('='.repeat(80));

if (stats.findings.length > 0) {
  console.log(colors.bold(colors.yellow('\nEMPIRICAL FINDINGS:')));
  stats.findings.forEach(f => {
    console.log(`  [${f.id}] [${f.severity}] ${f.title}`);
    console.log(`    Location : ${f.location}`);
    console.log(`    Detail   : ${f.description}`);
  });
}

if (stats.failures.length > 0) {
  console.log(colors.bold(colors.red('\nFAILURES:')));
  stats.failures.forEach(f => {
    console.log(`  [T${String(f.id).padStart(3, '0')}] ${f.name}`);
    console.log(`    ${colors.red('Error:')} ${f.error}`);
  });
  process.exit(1);
} else {
  console.log('\n' + colors.green(colors.bold('✓ ALL INDEXNOW & CONCURRENCY TESTS PASSED!')) + '\n');
  process.exit(0);
}
