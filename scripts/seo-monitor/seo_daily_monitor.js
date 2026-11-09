#!/usr/bin/env node
/**
 * seo_daily_monitor.js
 * Theo dõi, giám sát và phân tích SEO hằng ngày cho nhadat.city
 *
 * Tính năng:
 * 1. Health check HTTP (Sitemaps, Sitemap Partitions, Homepage, Category pages)
 * 2. Đếm số lượng URLs trong các Sitemap XML
 * 3. Kiểm tra lỗi aria-hidden bug
 * 4. Truy vấn số liệu thống kê Postgres (Tổng tin đăng, tin active, scraping logs)
 * 5. Google Search Console API (clicks, impressions, position, CTR)
 * 6. So sánh biến động chỉ số với ngày hôm trước
 * 7. Gửi báo cáo chi tiết qua Telegram channel
 * 8. Lưu báo cáo dạng JSON và cập nhật lịch sử CSV
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const store = require('../lib/pgStore');
const jwt = require('jsonwebtoken');

// Load environment variables via pure JS parser to avoid external dotenv dependency
const projectRoot = path.resolve(__dirname, '../..');
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
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
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch (err) {
    console.warn(`[WARN] Failed to load env file ${filePath}:`, err.message);
  }
}

loadEnvFile(path.join(projectRoot, '.env.local'));
loadEnvFile(path.join(projectRoot, '.env'));

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const DOMAIN = process.env.DOMAIN || 'nhadat.city';
const BASE_URL = `https://${DOMAIN}`;
const REPORT_DIR = path.join(projectRoot, 'seo-reports');
const SERVICE_ACCOUNT_PATH = path.join(projectRoot, 'google-service-account.json');
const GSC_SITE = `sc-domain:${DOMAIN}`;
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '';
// Gemini Key Pool — rotates through up to 6 keys when primary hits 429 Rate Limit
const GEMINI_KEY_POOL = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
  process.env.GEMINI_API_KEY_6,
].filter(Boolean);
const GEMINI_API_KEY = GEMINI_KEY_POOL[0] || '';

const HEALTH_URLS = [
  { url: `${BASE_URL}/robots.txt`, name: 'robots.txt' },
  { url: `${BASE_URL}/sitemap.xml`, name: 'sitemap-index' },
  { url: `${BASE_URL}/sitemap-static.xml`, name: 'sitemap-static' },
  { url: `${BASE_URL}/sitemap-projects.xml`, name: 'sitemap-projects' },
  { url: `${BASE_URL}/sitemap-quyhoach.xml`, name: 'sitemap-quyhoach' },
  { url: `${BASE_URL}/sitemap-listings-1.xml`, name: 'sitemap-listings-1' },
  { url: `${BASE_URL}/sitemap-listings-71.xml`, name: 'sitemap-listings-71' },
  { url: `${BASE_URL}/sitemap-listings-200.xml`, name: 'sitemap-listings-200' },
  { url: `${BASE_URL}/`, name: 'homepage' },
  { url: `${BASE_URL}/ha-noi`, name: 'category-hanoi' },
  { url: `${BASE_URL}/ho-chi-minh`, name: 'category-hcm' },
  { url: `${BASE_URL}/quy-hoach`, name: 'quy-hoach-index' },
  { url: `${BASE_URL}/quy-hoach/ha-noi`, name: 'quy-hoach-hanoi' },
  { url: `${BASE_URL}/thong-ke`, name: 'thong-ke' },
];

const today = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }))
    .toISOString()
    .split('T')[0];
};

const getNDaysAgo = (n) => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

// ─── HTTP FETCH UTILS ────────────────────────────────────────────────────────
function fetchUrl(url, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode || 0, body, ms: Date.now() - start }));
    });
    req.on('error', (err) => resolve({ status: 0, body: '', ms: Date.now() - start, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '', ms: timeoutMs, error: 'timeout' }); });
  });
}

const countXmlUrls = (body) => (body.match(/<loc>/g) || []).length;

function countAriaBug(body) {
  const matches = body.match(/<(div|section|ul|ol)[^>]*aria-hidden="true"[^>]*>/g) || [];
  return matches.length;
}

// ─── GSC AUTH & QUERY ────────────────────────────────────────────────────────
async function getGscToken() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    log('[WARN] google-service-account.json not found – skipping GSC API');
    return null;
  }
  try {
    const sa = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
    const now = Math.floor(Date.now() / 1000);
    const token = jwt.sign({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }, sa.private_key, { algorithm: 'RS256' });

    const postData = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: token,
    }).toString();

    return new Promise((resolve) => {
      const req = https.request({
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        },
      }, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          try {
            const p = JSON.parse(body);
            if (p.access_token) resolve(p.access_token);
            else { log(`[WARN] GSC token error: ${body}`); resolve(null); }
          } catch (e) { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.write(postData);
      req.end();
    });
  } catch (err) {
    log(`[ERROR] GSC Auth: ${err.message}`);
    return null;
  }
}

function gscQuery(accessToken, dateStr, dimensions = [], rowLimit = 10) {
  if (!accessToken) return Promise.resolve(null);
  const body = JSON.stringify({
    startDate: dateStr,
    endDate: dateStr,
    dimensions,
    rowLimit,
  });
  const encodedSite = encodeURIComponent(GSC_SITE);
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'searchconsole.googleapis.com',
      path: `/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.write(body);
    req.end();
  });
}

// ─── TELEGRAM ALERT ──────────────────────────────────────────────────────────
async function sendTelegramAlert(text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT_ID || '5711994460';

  if (!botToken || !chatId) {
    log('[WARN] Telegram bot token or chat ID is missing in settings.');
    return;
  }

  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  };

  try {
    const { execSync } = require('child_process');
    const tempFile = path.join(REPORT_DIR, `temp_tg_${Date.now()}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(payload));

    const cmd = `curl -s -X POST https://api.telegram.org/bot${botToken}/sendMessage -H "Content-Type: application/json" -d @${tempFile}`;
    const result = execSync(cmd).toString();
    
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }

    const resObj = JSON.parse(result);
    if (resObj.ok) {
      log('✅ Telegram report sent successfully via system curl!');
    } else {
      log(`🛑 Telegram API error: ${result}`);
    }
  } catch (err) {
    log(`🛑 Failed to send Telegram alert via curl: ${err.message}`);
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const todayStr = today();
  log(`========== SEO Daily Monitor for ${DOMAIN} – ${todayStr} ==========`);
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  // 1. Health Checks
  log('--- 1. Health Checks ---');
  const healthResults = [];
  let robotsTxtContent = '';
  for (const item of HEALTH_URLS) {
    const r = await fetchUrl(item.url);
    const sitemapCount = item.name.includes('sitemap') ? countXmlUrls(r.body) : 0;
    const ariaCount = (item.name.includes('category') || item.name === 'homepage') ? countAriaBug(r.body) : 0;
    const ok = r.status === 200;
    
    if (item.name === 'robots.txt') {
      robotsTxtContent = r.body;
    }

    log(`  ${ok ? '✅' : '❌'} ${item.name.padEnd(20)}: HTTP ${r.status} | ${r.ms}ms${sitemapCount > 0 ? ` | ${sitemapCount} URLs` : ''}${ariaCount > 0 ? ` | ⚠️ ${ariaCount} aria-hidden` : ''}`);
    healthResults.push({
      name: item.name,
      url: item.url,
      status: r.status,
      ms: r.ms,
      sitemapCount,
      ariaCount,
      error: r.error || null
    });
  }

  const isRobotsBlocking = /Disallow:\s*\/\*-202[45]/i.test(robotsTxtContent) || /Disallow:\s*\/\*\/\*-202[45]/i.test(robotsTxtContent);

  // 2. Postgres Stats
  log('--- 2. Fetching Postgres Stats ---');
  let dbStats = { total: 0, active: 0, scrapedLast24h: 0 };
  if (process.env.DATABASE_URL) {
    try {
      const { sql } = store;
      const [r] = await sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 2)::int AS active FROM real_estates`;
      const [l] = await sql`SELECT count(*)::int AS n FROM scraping_logs WHERE started_at >= ${new Date(Date.now() - 24 * 3600 * 1000)}`;
      dbStats = { total: r.total, active: r.active, scrapedLast24h: l.n };
      log(`  Total listings: ${r.total} | Active: ${r.active} | Scraper logs (24h): ${l.n}`);
    } catch (dbErr) {
      log(`  [WARN] Postgres metrics failed: ${dbErr.message}`);
    } finally {
      await store.close();
    }
  } else {
    log('  [SKIP] DATABASE_URL not found in env.');
  }

  // 3. GSC Data
  log('--- 3. Fetching GSC Data ---');
  let gscData = null;
  let targetDate = '';
  const token = await getGscToken();
  if (token) {
    // Loop back from 2 to 4 days ago to find latest GSC stats
    for (let daysAgo = 2; daysAgo <= 4; daysAgo++) {
      const checkDate = getNDaysAgo(daysAgo);
      log(`Checking GSC data for ${checkDate}...`);
      const summary = await gscQuery(token, checkDate, [], 1);
      if (summary?.rows?.[0]) {
        const pagesRes = await gscQuery(token, checkDate, ['page'], 10);
        const queriesRes = await gscQuery(token, checkDate, ['query'], 10);
        gscData = {
          summary: summary.rows[0],
          pages: (pagesRes?.rows || []).map(r => ({
            key: r.keys?.[0] || '',
            clicks: r.clicks || 0,
            impressions: r.impressions || 0,
            ctr: Math.round((r.ctr || 0) * 10000) / 100,
            position: Math.round((r.position || 0) * 10) / 10,
          })),
          queries: (queriesRes?.rows || []).map(r => ({
            key: r.keys?.[0] || '',
            clicks: r.clicks || 0,
            impressions: r.impressions || 0,
            ctr: Math.round((r.ctr || 0) * 10000) / 100,
            position: Math.round((r.position || 0) * 10) / 10,
          }))
        };
        targetDate = checkDate;
        break;
      }
    }
  }

  let gscSummary = null;
  let gscTopPages = [];
  let gscTopQueries = [];

  if (gscData) {
    gscSummary = {
      date: targetDate,
      clicks: gscData.summary.clicks || 0,
      impressions: gscData.summary.impressions || 0,
      ctr: Math.round((gscData.summary.ctr || 0) * 10000) / 100,
      position: Math.round((gscData.summary.position || 0) * 10) / 10,
    };
    gscTopPages = gscData.pages;
    gscTopQueries = gscData.queries;
    log(`  Target Date: ${targetDate} | Clicks: ${gscSummary.clicks} | Impressions: ${gscSummary.impressions}`);
  } else {
    log('  [INFO] GSC data is not available yet (delay might be longer).');
  }

  // 4. Compare with yesterday
  let clickDiff = 0, impressionDiff = 0, positionDiff = 0;
  let totalDiff = 0, activeDiff = 0;
  let previousReportFound = false;

  const yesterdayDate = getNDaysAgo(1);
  const prevReportPath = path.join(REPORT_DIR, `${yesterdayDate}.json`);
  if (fs.existsSync(prevReportPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(prevReportPath, 'utf8'));
      previousReportFound = true;
      if (prev.gscSummary && gscSummary) {
        clickDiff = gscSummary.clicks - prev.gscSummary.clicks;
        impressionDiff = gscSummary.impressions - prev.gscSummary.impressions;
        positionDiff = gscSummary.position - prev.gscSummary.position;
      }
      if (prev.dbStats && dbStats) {
        totalDiff = dbStats.total - prev.dbStats.total;
        activeDiff = dbStats.active - prev.dbStats.active;
      }
    } catch (e) {}
  }

  // 5. Save JSON Report
  const report = {
    date: todayStr,
    generatedAt: new Date().toISOString(),
    health: healthResults,
    robotsBlocked: isRobotsBlocking,
    dbStats,
    gscSummary,
    gscTopPages,
    gscTopQueries
  };
  const jsonPath = path.join(REPORT_DIR, `${todayStr}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  log(`✅ JSON report saved to: ${jsonPath}`);

  // 6. Append CSV History
  const csvPath = path.join(REPORT_DIR, 'history.csv');
  const header = 'date,clicks,impressions,ctr,position,total_listings,active_listings,all_ok';
  const allOk = healthResults.every(h => h.status === 200);
  const row = [
    todayStr,
    gscSummary?.clicks ?? '',
    gscSummary?.impressions ?? '',
    gscSummary?.ctr ?? '',
    gscSummary?.position ?? '',
    dbStats.total,
    dbStats.active,
    allOk ? 'true' : 'false'
  ].join(',');

  // Rewrite header to match current columns; drop any existing row for today and replace it.
  const existing = fs.existsSync(csvPath)
    ? fs.readFileSync(csvPath, 'utf8').split('\n').filter(l => l.trim() !== '')
    : [];
  const dataRows = existing.filter(l => !l.startsWith('date,') && l.split(',')[0] !== todayStr);
  fs.writeFileSync(csvPath, [header, ...dataRows, row].join('\n') + '\n');
  log(`✅ CSV history updated: ${csvPath}`);

  // 7. Generate and send Telegram daily report
  log('--- 4. Sending Telegram Report ---');
  const failingUrls = healthResults.filter(h => h.status !== 200);
  const ariaBugs = healthResults.filter(h => h.ariaCount > 0);

  let telegramMsg = `<b>📊 BÁO CÁO SEO & HỆ THỐNG DAILY (${todayStr})</b>\n`;
  telegramMsg += `🌐 Domain: <code>${DOMAIN}</code>\n\n`;

  // Health Section
  telegramMsg += `<b>🚨 Trạng thái hệ thống:</b>\n`;
  if (failingUrls.length === 0) {
    telegramMsg += `  🟢 Tất cả URL quan trọng hoạt động tốt (HTTP 200)\n`;
  } else {
    telegramMsg += `  🔴 Phát hiện ${failingUrls.length} URL lỗi:\n`;
    failingUrls.forEach(f => {
      telegramMsg += `    • <code>${f.name}</code>: HTTP <b>${f.status}</b>\n`;
    });
  }

  if (isRobotsBlocking) {
    telegramMsg += `  ⚠️ <b>CẢNH BÁO:</b> robots.txt đang block URLs 2024/2025!\n`;
  }

  if (ariaBugs.length > 0) {
    telegramMsg += `  ⚠️ <b>aria-hidden bug:</b> phát hiện tại:\n`;
    ariaBugs.forEach(b => {
      telegramMsg += `    • <code>${b.name}</code>: <b>${b.ariaCount}</b> tags\n`;
    });
  }
  telegramMsg += `\n`;

  // DB Stats Section
  telegramMsg += `<b>🗄️ Chỉ số Database:</b>\n`;
  const totSign = totalDiff >= 0 ? '+' : '';
  const actSign = activeDiff >= 0 ? '+' : '';
  telegramMsg += `  • Tổng tin: <b>${dbStats.total.toLocaleString()}</b> (<i>${totSign}${totalDiff}</i>)\n`;
  telegramMsg += `  • Tin Active: <b>${dbStats.active.toLocaleString()}</b> (<i>${actSign}${activeDiff}</i>)\n`;
  telegramMsg += `  • Tin mới cào (24h): <b>${dbStats.scrapedLast24h.toLocaleString()}</b>\n\n`;

  // GSC Metrics Section
  if (gscSummary) {
    telegramMsg += `<b>📈 Chỉ số Google Search Console (${gscSummary.date}):</b>\n`;
    const clickSign = clickDiff >= 0 ? '+' : '';
    const imprSign = impressionDiff >= 0 ? '+' : '';
    const posSign = positionDiff >= 0 ? '+' : '';
    const compText = previousReportFound
      ? ` (So với hôm trước: Clicks ${clickSign}${clickDiff} | Impr ${imprSign}${impressionDiff} | Pos ${posSign}${positionDiff.toFixed(1)})`
      : '';

    telegramMsg += `  • Clicks: <b>${gscSummary.clicks}</b>\n`;
    telegramMsg += `  • Impressions: <b>${gscSummary.impressions}</b>\n`;
    telegramMsg += `  • CTR: <b>${gscSummary.ctr}%</b>\n`;
    telegramMsg += `  • Vị trí trung bình: <b>${gscSummary.position}</b>\n`;
    if (compText) {
      telegramMsg += `  <i>${compText}</i>\n`;
    }
    telegramMsg += `\n`;

    // Top Pages
    if (gscTopPages.length > 0) {
      telegramMsg += `<b>📄 Top 3 Pages:</b>\n`;
      gscTopPages.slice(0, 3).forEach((p, idx) => {
        const cleanPath = p.key.replace(BASE_URL, '') || '/';
        telegramMsg += `  ${idx + 1}. <code>${cleanPath}</code>: <b>${p.clicks}</b> clicks\n`;
      });
      telegramMsg += `\n`;
    }

    // Top Queries
    if (gscTopQueries.length > 0) {
      telegramMsg += `<b>🔍 Top 3 Từ Khóa (Impressions):</b>\n`;
      gscTopQueries.slice(0, 3).forEach((q, idx) => {
        telegramMsg += `  ${idx + 1}. "<i>${q.key}</i>": pos <b>${q.position}</b> (<b>${q.impressions}</b> hiển thị)\n`;
      });
    }
  } else {
    telegramMsg += `<b>📈 Chỉ số GSC:</b>\n`;
    telegramMsg += `  ⚠️ Chưa có dữ liệu GSC hôm nay (Google trễ 2-3 ngày). Đang tiếp tục theo dõi.\n`;
  }

  telegramMsg += `\n🔗 Truy cập Search Console: <a href="https://search.google.com/search-console?resource_id=${encodeURIComponent(GSC_SITE)}">GSC Dashboard</a>`;

  // 5. AI Insights (Gemini) — inspired by cotuong.xyz/server/services/aiAnalytics.mjs
  log('--- 5. Gemini AI Insights ---');
  if (GEMINI_API_KEY && gscSummary) {
    try {
      const aiInsights = await generateAiInsights({
        gscSummary,
        gscTopPages,
        gscTopQueries,
        dbStats,
        healthResults,
        clickDiff,
        impressionDiff,
        positionDiff,
      });
      if (aiInsights) {
        telegramMsg += `\n\n<b>🤖 AI Nhận Định (Gemini):</b>\n`;
        telegramMsg += `<i>${aiInsights.summary || ''}</i>\n`;
        if (aiInsights.recommendations && aiInsights.recommendations.length > 0) {
          telegramMsg += `<b>💡 Khuyến nghị:</b>\n`;
          aiInsights.recommendations.slice(0, 3).forEach((r, i) => {
            telegramMsg += `  ${i + 1}. ${r}\n`;
          });
        }
        log(`✅ Gemini AI insights generated: ${aiInsights.summary?.substring(0, 80)}...`);
      }
    } catch (err) {
      log(`[WARN] Gemini AI insights failed: ${err.message}`);
    }
  } else if (!GEMINI_API_KEY) {
    log('  [SKIP] GEMINI_API_KEY not set — skipping AI insights.');
  }

  await sendTelegramAlert(telegramMsg);

  // 6. IndexNow Auto-Submit — ép Google/Bing cào ngay lập tức (học từ cotuong.xyz/server/services/indexNow.mjs)
  log('--- 6. IndexNow Auto-Submit ---');
  const indexNowUrls = [
    `${BASE_URL}/`,
    `${BASE_URL}/quy-hoach`,
    `${BASE_URL}/ha-noi`,
    `${BASE_URL}/ho-chi-minh`,
    `${BASE_URL}/da-nang`,
    `${BASE_URL}/quy-hoach/ha-noi`,
    `${BASE_URL}/quy-hoach/ho-chi-minh`,
    `${BASE_URL}/quy-hoach/binh-duong`,
  ];
  await submitToIndexNow(indexNowUrls);

  log('========== SEO Daily Monitor Process completed ==========');
}

// ─── GEMINI AI INSIGHTS ──────────────────────────────────────────────────────
/**
 * Phân tích dữ liệu GSC bằng Gemini AI và trả về khuyến nghị.
 * Mô phỏng theo cotuong.xyz/server/services/aiAnalytics.mjs generateAdminInsights()
 */
async function generateAiInsights(context) {
  if (!GEMINI_API_KEY) return null;

  const condensed = {
    gsc: {
      clicks: context.gscSummary.clicks,
      impressions: context.gscSummary.impressions,
      ctr: context.gscSummary.ctr,
      position: context.gscSummary.position,
      clickDelta: context.clickDiff,
      impressionDelta: context.impressionDiff,
      positionDelta: context.positionDiff,
    },
    topKeywords: context.gscTopQueries.slice(0, 8).map(q => ({
      q: q.key?.substring(0, 30),
      pos: q.position,
      impr: q.impressions,
      clicks: q.clicks,
    })),
    topPages: context.gscTopPages.slice(0, 5).map(p => ({
      url: (p.key || '').replace(BASE_URL, '').substring(0, 40),
      clicks: p.clicks,
    })),
    db: {
      total: context.dbStats.total,
      active: context.dbStats.active,
    },
    healthFails: context.healthResults.filter(h => h.status !== 200).length,
  };

  const prompt = `Phân tích dữ liệu SEO của website bất động sản ${DOMAIN}: ${JSON.stringify(condensed)}.
Trả về JSON hợp lệ (không markdown): {"summary": "tóm tắt 1-2 câu tiếng Việt", "recommendations": ["hành động 1", "hành động 2", "hành động 3"]}.
Tập trung vào: xu hướng click/impression, từ khóa cần tối ưu, rủi ro SEO cần xử lý. Tiếng Việt.`;

  // Try each key in pool until one works (avoids 429 Rate Limit)
  for (let keyIdx = 0; keyIdx < GEMINI_KEY_POOL.length; keyIdx++) {
    const apiKey = GEMINI_KEY_POOL[keyIdx];
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const reqBody = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 512, temperature: 0.3 },
    });

    const result = await new Promise((resolve) => {
      const req = https.request(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(reqBody) },
        timeout: 20000,
      }, (res) => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => {
          try {
            if (res.statusCode === 429) { resolve({ _retry: true }); return; }
            const parsed = JSON.parse(data);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (!text) {
              log(`[WARN] Gemini key#${keyIdx + 1} empty text. HTTP ${res.statusCode}. Raw: ${data.substring(0, 150)}`);
              resolve(null);
              return;
            }
            const clean = text.replace(/```json\n?|```/g, '').trim();
            let result = null;
            try { result = JSON.parse(clean); } catch (_) {
              const jsonMatch = clean.match(/\{[\s\S]*\}/);
              if (jsonMatch) result = JSON.parse(jsonMatch[0]);
            }
            log(`✅ Gemini key#${keyIdx + 1} succeeded.`);
            resolve(result);
          } catch (e) {
            log(`[WARN] Gemini parse failed key#${keyIdx + 1}: ${e.message}. Raw: ${data.substring(0, 150)}`);
            resolve(null);
          }
        });
      });
      req.on('error', err => { log(`[WARN] Gemini key#${keyIdx + 1} error: ${err.message}`); resolve(null); });
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.write(reqBody);
      req.end();
    });

    if (result && result._retry) {
      log(`[WARN] Gemini key#${keyIdx + 1} hit 429, rotating to next key...`);
      continue;
    }
    return result;
  }
  log('[WARN] All Gemini keys exhausted (all 429). Skipping AI insights today.');
  return null;
}

// ─── INDEXNOW SUBMIT ─────────────────────────────────────────────────────────
/**
 * Submit URLs to IndexNow (Bing/Google) for near-instant indexing.
 * Mô phỏng theo cotuong.xyz/server/services/indexNow.mjs submitToIndexNow()
 */
async function submitToIndexNow(urls) {
  if (!urls || urls.length === 0) return;
  const body = JSON.stringify({
    host: DOMAIN,
    key: INDEXNOW_KEY,
    keyLocation: `${BASE_URL}/indexnow-key.txt`,
    urlList: urls,
  });

  const endpoints = [
    'https://www.bing.com/indexnow',
    'https://api.indexnow.org/indexnow',
  ];

  for (const endpoint of endpoints) {
    await new Promise((resolve) => {
      const u = new URL(endpoint);
      const req = https.request({
        hostname: u.hostname,
        path: u.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 10000,
      }, (res) => {
        res.resume();
        if (res.statusCode === 200 || res.statusCode === 202) {
          log(`  ✅ IndexNow [${u.hostname}]: ${urls.length} URLs submitted (HTTP ${res.statusCode})`);
        } else {
          log(`  ⚠️ IndexNow [${u.hostname}]: HTTP ${res.statusCode}`);
        }
        resolve();
      });
      req.on('error', err => { log(`  ❌ IndexNow [${u.hostname}]: ${err.message}`); resolve(); });
      req.on('timeout', () => { req.destroy(); resolve(); });
      req.write(body);
      req.end();
    });
  }
}

main().catch(err => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
