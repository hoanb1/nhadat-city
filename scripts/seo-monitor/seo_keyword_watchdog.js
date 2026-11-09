#!/usr/bin/env node
/**
 * seo_keyword_watchdog.js
 * Theo dõi keyword rankings hàng ngày — phát hiện từ khóa mất/giảm hạng tức thì
 *
 * Mô phỏng theo: cotuong.xyz/server/services/seoWatchdog.mjs
 *
 * Pipeline:
 * 1. Fetch top 200 queries từ GSC API (30 ngày gần nhất)
 * 2. Lưu snapshot vào seo-reports/keywords/YYYY-MM-DD.json
 * 3. So sánh với snapshot 7 ngày trước
 * 4. Phát hiện: từ khóa biến mất, giảm hạng >5 vị trí, từ khóa mới nổi
 * 5. Gửi cảnh báo Telegram nếu có bất thường
 * 6. Phân tích market expansion bằng Gemini AI
 *
 * Cron: 08:30 hàng ngày (chạy sau seo_daily_monitor.js 30 phút)
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');
const jwt   = require('jsonwebtoken');

const projectRoot = path.resolve(__dirname, '../..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
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
}

loadEnvFile(path.join(projectRoot, '.env.local'));
loadEnvFile(path.join(projectRoot, '.env'));

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const DOMAIN              = process.env.DOMAIN || 'nhadat.city';
const BASE_URL            = `https://${DOMAIN}`;
const REPORT_DIR          = path.join(projectRoot, 'seo-reports');
const KW_SNAPSHOT_DIR     = path.join(REPORT_DIR, 'keywords');
const SERVICE_ACCOUNT_PATH= path.join(projectRoot, 'google-service-account.json');
const GSC_SITE            = `sc-domain:${DOMAIN}`;
const TELEGRAM_BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID    = process.env.TELEGRAM_CHAT_ID || '5711994460';
const GEMINI_KEY_POOL     = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
  process.env.GEMINI_API_KEY_6,
].filter(Boolean);

// Các từ khóa quan trọng PHẢI theo dõi — cảnh báo CRITICAL nếu mất
// Học từ cotuong.xyz WATCHED_KEYWORDS array
const WATCHED_KEYWORDS = [
  'quy hoạch',
  'bản đồ quy hoạch',
  'tra cứu quy hoạch',
  'quy hoạch sử dụng đất',
  'quy hoạch hà nội',
  'quy hoạch hồ chí minh',
  'quy hoạch bình dương',
  'nhà đất hà nội',
  'nhà đất hồ chí minh',
  'mua bán nhà đất',
  'thuê nhà hà nội',
  'căn hộ hồ chí minh',
  'bất động sản',
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);
const today = () => new Date().toISOString().split('T')[0];
const nDaysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── GSC AUTH (JWT) ───────────────────────────────────────────────────────────
async function getGscToken() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(`Service account not found: ${SERVICE_ACCOUNT_PATH}`);
  }
  const sa = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const signed = jwt.sign(claim, sa.private_key, { algorithm: 'RS256' });

  return new Promise((resolve, reject) => {
    const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${signed}`;
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data).access_token); }
        catch (e) { reject(new Error(`Token parse: ${data.substring(0, 100)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Token request timeout')); });
    req.write(body);
    req.end();
  });
}

// ─── GSC SEARCH ANALYTICS ────────────────────────────────────────────────────
async function fetchGscQueries(token, days = 30, limit = 200) {
  const startDate = nDaysAgo(days + 3); // +3 ngày để bù trễ GSC
  const endDate   = nDaysAgo(3);

  const body = JSON.stringify({
    startDate,
    endDate,
    dimensions: ['query'],
    rowLimit: limit,
    orderBy: [{ fieldName: 'impressions', sortOrder: 'DESCENDING' }],
  });

  return new Promise((resolve, reject) => {
    const siteEncoded = encodeURIComponent(GSC_SITE);
    const req = https.request({
      hostname: 'searchconsole.googleapis.com',
      path: `/webmasters/v3/sites/${siteEncoded}/searchAnalytics/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.rows || []);
        } catch (e) { reject(new Error(`GSC parse: ${data.substring(0, 100)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('GSC timeout')); });
    req.write(body);
    req.end();
  });
}

// ─── GEMINI AI MARKET EXPANSION ──────────────────────────────────────────────
/**
 * Phân tích market expansion dựa trên top 100 queries từ GSC
 * Học từ: cotuong.xyz/server/services/aiSceoOptimizer.mjs analyzeMarketExpansion()
 */
async function analyzeMarketExpansion(topQueries) {
  if (!GEMINI_KEY_POOL.length || !topQueries.length) return null;

  const queryList = topQueries.slice(0, 100).map(q => ({
    k: q.keys[0],
    v: q.impressions,
    c: q.clicks,
    p: +q.position.toFixed(1),
    ctr: (q.ctr * 100).toFixed(1) + '%',
  }));

  const prompt = `Bạn là CHUYÊN GIA SEO BẤT ĐỘNG SẢN VIỆT NAM.
Dựa trên ${queryList.length} từ khóa thực tế từ Google Search Console của website "${DOMAIN}" (bất động sản):
${JSON.stringify(queryList)}

HÃY PHÂN TÍCH CHUYÊN SÂU:
1. TOPIC CLUSTERS: Nhóm từ khóa vào 4-6 cụm (ví dụ: Quy hoạch, Mua bán nhà đất, Thuê nhà, BĐS theo tỉnh, ...). Mỗi cụm: tên, số lượng từ khóa, trạng thái.
2. BREAKOUT KEYWORDS: Từ khóa có impressions cao nhưng clicks thấp (CTR < 3%) → cơ hội tối ưu title/description ngay.
3. KEYWORD GAPS: 5-8 từ khóa BẤT ĐỘNG SẢN tiềm năng cao mà website chưa rank tốt.
4. ACTION PLAN: 3 hành động SEO cụ thể ưu tiên cao nhất tuần này.

TRẢ VỀ JSON HỢP LỆ (KHÔNG MARKDOWN):
{"clusters":[{"name":"...","keywordCount":0,"status":"dominant|growth_opportunity|weak","topKeywords":["kw1","kw2"]}],"breakoutKeywords":[{"keyword":"...","impressions":0,"ctr":"...","action":"..."}],"keywordGaps":[{"keyword":"...","estimatedVolume":"...","difficulty":"low|medium|high","strategy":"..."}],"actionPlan":["hành động 1","hành động 2","hành động 3"]}`;

  for (let i = 0; i < GEMINI_KEY_POOL.length; i++) {
    const apiKey = GEMINI_KEY_POOL[i];
    const reqBody = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
    });

    const result = await new Promise((resolve) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const req = https.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(reqBody) },
        timeout: 30000,
      }, (res) => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => {
          try {
            if (res.statusCode === 429) { resolve({ _retry: true }); return; }
            const text = JSON.parse(data)?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (!text) { resolve(null); return; }
            const clean = text.replace(/```json\n?|```/g, '').trim();
            let obj = null;
            try { obj = JSON.parse(clean); } catch (_) {
              const m = clean.match(/\{[\s\S]*\}/);
              if (m) obj = JSON.parse(m[0]);
            }
            resolve(obj);
          } catch (e) { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.write(reqBody);
      req.end();
    });

    if (result && result._retry) {
      log(`[WARN] Gemini key#${i + 1} 429 — rotating...`);
      continue;
    }
    return result;
  }
  return null;
}

// ─── TELEGRAM ────────────────────────────────────────────────────────────────
async function sendTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log('[WARN] Telegram not configured — printing to stdout only');
    console.log(text);
    return;
  }
  const body = JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 10000,
    }, (res) => { res.resume(); resolve(); });
    req.on('error', err => { log(`[WARN] Telegram: ${err.message}`); resolve(); });
    req.on('timeout', () => { req.destroy(); resolve(); });
    req.write(body);
    req.end();
  });
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const todayStr = today();
  ensureDir(KW_SNAPSHOT_DIR);

  log(`========== SEO Keyword Watchdog for ${DOMAIN} – ${todayStr} ==========`);

  // 1. Fetch queries from GSC
  log('--- 1. Fetching GSC keyword data ---');
  let rows = [];
  try {
    const token = await getGscToken();
    rows = await fetchGscQueries(token, 28, 200);
    log(`  ✅ Fetched ${rows.length} keywords from GSC`);
  } catch (err) {
    log(`  ❌ GSC fetch failed: ${err.message}`);
  }

  if (!rows.length) {
    log('[WARN] No keyword data available. Skipping watchdog run.');
    return;
  }

  // 2. Save today's snapshot
  const snapshotPath = path.join(KW_SNAPSHOT_DIR, `${todayStr}.json`);
  const snapshot = rows.map(r => ({
    query: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
    date: todayStr,
  }));
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  log(`  ✅ Snapshot saved: ${snapshotPath}`);

  // 3. Compare with 7-day-old snapshot
  log('--- 2. Comparing with 7-day snapshot ---');
  const refDate = nDaysAgo(7);
  const refPath = path.join(KW_SNAPSHOT_DIR, `${refDate}.json`);

  let dropped = [];
  let disappeared = [];
  let improved = [];

  if (fs.existsSync(refPath)) {
    const refSnapshot = JSON.parse(fs.readFileSync(refPath, 'utf8'));
    const currentMap = new Map(snapshot.map(k => [k.query, k]));
    const refMap = new Map(refSnapshot.map(k => [k.query, k]));

    for (const [query, refData] of refMap) {
      const current = currentMap.get(query);
      if (!current) {
        // Từ khóa biến mất hoàn toàn
        if (refData.impressions >= 10 || WATCHED_KEYWORDS.includes(query)) {
          disappeared.push({
            query,
            previousPosition: Math.round(refData.position),
            previousClicks: refData.clicks,
            previousImpressions: refData.impressions,
          });
        }
      } else {
        const posDelta = current.position - refData.position;
        // Giảm hạng > 5 vị trí
        if (posDelta > 5 && (refData.impressions >= 10 || WATCHED_KEYWORDS.includes(query))) {
          dropped.push({
            query,
            previousPosition: Math.round(refData.position),
            currentPosition: Math.round(current.position),
            delta: Math.round(posDelta),
            previousClicks: refData.clicks,
            currentClicks: current.clicks,
          });
        }
        // Cải thiện > 3 vị trí
        if (posDelta < -3 && current.clicks > 3) {
          improved.push({
            query,
            previousPosition: Math.round(refData.position),
            currentPosition: Math.round(current.position),
            delta: Math.round(Math.abs(posDelta)),
          });
        }
      }
    }

    // Sắp xếp theo mức độ nghiêm trọng
    disappeared.sort((a, b) => b.previousImpressions - a.previousImpressions);
    dropped.sort((a, b) => b.delta - a.delta);
    improved.sort((a, b) => b.delta - a.delta);

    log(`  📉 Disappeared: ${disappeared.length} | Dropped: ${dropped.length} | 📈 Improved: ${improved.length}`);
  } else {
    log(`  [INFO] No 7-day snapshot found (${refDate}). First run — nothing to compare.`);
  }

  // 4. Check watched keywords
  const currentQuerySet = new Set(snapshot.map(k => k.query));
  const watchedMissing = WATCHED_KEYWORDS.filter(kw => !currentQuerySet.has(kw));

  // 5. Build Telegram alert
  log('--- 3. Sending Telegram Keyword Report ---');
  const isCritical = watchedMissing.length > 0 || disappeared.length > 3;
  const isWarning  = dropped.length > 5 || disappeared.length > 0;

  let msg = `<b>🔍 KEYWORD WATCHDOG ${DOMAIN} (${todayStr})</b>\n`;
  msg += `📊 Đang theo dõi: <b>${rows.length}</b> từ khóa | Kỳ so sánh: 7 ngày\n\n`;

  if (watchedMissing.length > 0) {
    msg += `🚨 <b>CRITICAL — Từ khóa quan trọng BIẾN MẤT:</b>\n`;
    watchedMissing.slice(0, 5).forEach(kw => { msg += `  ❌ "${kw}"\n`; });
    msg += '\n';
  }

  if (disappeared.length > 0) {
    msg += `📉 <b>${disappeared.length} từ khóa biến mất hoàn toàn:</b>\n`;
    disappeared.slice(0, 5).forEach(d => {
      msg += `  • "${d.query}" (vị trí ${d.previousPosition}, ${d.previousImpressions} lượt hiển thị)\n`;
    });
    msg += '\n';
  }

  if (dropped.length > 0) {
    msg += `⬇️ <b>${dropped.length} từ khóa giảm hạng đáng kể (>5 vị trí):</b>\n`;
    dropped.slice(0, 5).forEach(d => {
      msg += `  • "${d.query}": <b>${d.previousPosition} → ${d.currentPosition}</b> (−${d.delta})\n`;
    });
    msg += '\n';
  }

  if (improved.length > 0) {
    msg += `📈 <b>Top ${Math.min(3, improved.length)} từ khóa cải thiện:</b>\n`;
    improved.slice(0, 3).forEach(d => {
      msg += `  ✅ "${d.query}": ${d.previousPosition} → ${d.currentPosition} (+${d.delta})\n`;
    });
    msg += '\n';
  }

  if (!isCritical && !isWarning) {
    msg += `✅ <i>Tất cả từ khóa ổn định. Không có bất thường.</i>\n\n`;
  }

  // Top 5 keywords by impressions
  msg += `<b>🔑 Top 5 Keywords (Impressions):</b>\n`;
  rows.slice(0, 5).forEach((r, i) => {
    msg += `  ${i + 1}. <i>"${r.keys[0]}"</i> — pos <b>${r.position.toFixed(1)}</b>, ${r.impressions} hiển thị, ${r.clicks} click\n`;
  });
  msg += '\n';

  // 6. AI Market Expansion (Gemini)
  log('--- 4. Gemini Market Expansion Analysis ---');
  const expansion = await analyzeMarketExpansion(rows);
  if (expansion) {
    msg += `<b>🤖 AI Phân Tích Market Expansion (Gemini):</b>\n`;

    if (expansion.breakoutKeywords && expansion.breakoutKeywords.length > 0) {
      msg += `<b>💥 Cơ hội tối ưu CTR ngay:</b>\n`;
      expansion.breakoutKeywords.slice(0, 3).forEach(kw => {
        msg += `  • "${kw.keyword}" (${kw.impressions} impr, CTR ${kw.ctr}) → ${kw.action || 'Tối ưu title/description'}\n`;
      });
      msg += '\n';
    }

    if (expansion.keywordGaps && expansion.keywordGaps.length > 0) {
      msg += `<b>🎯 Từ khóa Gap cần tấn công:</b>\n`;
      expansion.keywordGaps.slice(0, 4).forEach(kw => {
        msg += `  • "${kw.keyword}" (${kw.estimatedVolume}) — ${kw.difficulty} difficulty\n`;
      });
      msg += '\n';
    }

    if (expansion.actionPlan && expansion.actionPlan.length > 0) {
      msg += `<b>📋 Action Plan tuần này:</b>\n`;
      expansion.actionPlan.slice(0, 3).forEach((action, i) => {
        msg += `  ${i + 1}. ${action}\n`;
      });
    }

    // Save full expansion analysis to file
    const expansionPath = path.join(REPORT_DIR, `keyword-expansion-${todayStr}.json`);
    fs.writeFileSync(expansionPath, JSON.stringify({ date: todayStr, expansion, topQueries: rows.slice(0, 50) }, null, 2));
    log(`  ✅ AI expansion saved: ${expansionPath}`);
  } else {
    log('  [SKIP] Gemini AI expansion skipped (rate limited or no data)');
  }

  // 7. Send to Telegram
  await sendTelegram(msg);
  log(`✅ Keyword watchdog complete. Sent Telegram report.`);
  log(`========== Keyword Watchdog DONE ==========`);
}

main().catch(err => {
  console.error('[FATAL]:', err.message);
  process.exit(1);
});
