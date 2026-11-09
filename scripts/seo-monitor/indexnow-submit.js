#!/usr/bin/env node
/**
 * indexnow-submit.js
 * Submit URLs to IndexNow API (Bing/Google/Yandex/Seznam)
 * Protocol: https://www.indexnow.org/documentation
 *
 * Sử dụng:
 *   node scripts/seo-monitor/indexnow-submit.js           # Submit all key sitemaps URLs
 *   node scripts/seo-monitor/indexnow-submit.js [url1] [url2]  # Submit specific URLs
 */

const https = require('https');
const path  = require('path');
const fs    = require('fs');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const projectRoot = path.resolve(__dirname, '../..');

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
    console.warn(`[WARN] Failed to load env: ${filePath}:`, err.message);
  }
}

loadEnvFile(path.join(projectRoot, '.env.local'));
loadEnvFile(path.join(projectRoot, '.env'));

const DOMAIN       = process.env.DOMAIN || 'nhadat.city';
const BASE_URL     = `https://${DOMAIN}`;
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '';
const KEY_LOCATION = `${BASE_URL}/${INDEXNOW_KEY}.txt`;

// IndexNow endpoints to submit to (each propagates to others via IndexNow protocol)
const INDEXNOW_ENDPOINTS = [
  'https://www.bing.com/indexnow',
  'https://api.indexnow.org/indexnow',
];

// ─── KEY URLS TO SUBMIT ───────────────────────────────────────────────────────
// Các trang quan trọng nhất cần ép cào ngay lập tức
const DEFAULT_URLS = [
  `${BASE_URL}/`,
  `${BASE_URL}/quy-hoach`,
  `${BASE_URL}/thong-ke`,
  `${BASE_URL}/ha-noi`,
  `${BASE_URL}/ho-chi-minh`,
  `${BASE_URL}/da-nang`,
  `${BASE_URL}/binh-duong`,
  `${BASE_URL}/dong-nai`,
  `${BASE_URL}/can-tho`,
  // Quy hoạch tỉnh quan trọng
  `${BASE_URL}/quy-hoach/ha-noi`,
  `${BASE_URL}/quy-hoach/ho-chi-minh`,
  `${BASE_URL}/quy-hoach/da-nang`,
  `${BASE_URL}/quy-hoach/binh-duong`,
  `${BASE_URL}/quy-hoach/dong-nai`,
  `${BASE_URL}/quy-hoach/long-an`,
  `${BASE_URL}/quy-hoach/ba-ria-vung-tau`,
  `${BASE_URL}/quy-hoach/khanh-hoa`,
  `${BASE_URL}/quy-hoach/lam-dong`,
  `${BASE_URL}/quy-hoach/thua-thien-hue`,
];

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

// ─── HTTP POST to IndexNow endpoint ──────────────────────────────────────────
function submitBatch(endpoint, urlList) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      host: DOMAIN,
      key: INDEXNOW_KEY,
      keyLocation: KEY_LOCATION,
      urlList,
    });

    const u = new URL(endpoint);
    const options = {
      hostname: u.hostname,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 202) {
          log(`✅ IndexNow [${endpoint}]: ${urlList.length} URLs submitted (HTTP ${res.statusCode})`);
          resolve({ ok: true, status: res.statusCode });
        } else {
          log(`⚠️ IndexNow [${endpoint}]: HTTP ${res.statusCode} — ${data.substring(0, 200)}`);
          resolve({ ok: false, status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => {
      log(`❌ IndexNow [${endpoint}]: ${err.message}`);
      resolve({ ok: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      log(`❌ IndexNow [${endpoint}]: Timeout`);
      resolve({ ok: false, error: 'timeout' });
    });

    req.write(body);
    req.end();
  });
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  // Accept URLs from CLI args or use defaults
  const cliArgs = process.argv.slice(2).filter(a => a.startsWith('http'));
  const urlsToSubmit = cliArgs.length > 0 ? cliArgs : DEFAULT_URLS;

  log(`========== IndexNow Submit for ${DOMAIN} ==========`);
  log(`Key: ${INDEXNOW_KEY}`);
  log(`Key Location: ${KEY_LOCATION}`);
  log(`Submitting ${urlsToSubmit.length} URLs...`);

  // Submit to all endpoints in parallel
  const results = await Promise.all(
    INDEXNOW_ENDPOINTS.map(endpoint => submitBatch(endpoint, urlsToSubmit))
  );

  const successCount = results.filter(r => r.ok).length;
  log(`\n✅ Completed: ${successCount}/${INDEXNOW_ENDPOINTS.length} endpoints OK`);
  
  if (successCount > 0) {
    log(`🔥 Google/Bing will crawl these ${urlsToSubmit.length} pages within minutes!`);
  }
}

main().catch(err => {
  console.error('[FATAL]:', err);
  process.exit(1);
});
