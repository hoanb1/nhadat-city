#!/usr/bin/env node
/**
 * seo_integrated_optimizer.js
 * Tích hợp dữ liệu từ seo-analytic dashboard vào quy trình tối ưu nhadat.city
 *
 * Nguồn dữ liệu:
 * - seo-analytic API (internal.example:4000): keyword rankings, rank alerts, bot crawl, index coverage
 * - Google Search Console (qua GSC JWT): raw query data
 * - Gemini AI: phân tích và đề xuất tối ưu
 *
 * Mục tiêu:
 * 1. Phát hiện zero-click keywords (high impression, 0 click) → đề xuất fix title/description
 * 2. Phân tích rank drops → gửi cảnh báo Telegram ngay
 * 3. Kiểm tra index coverage → báo cáo URL lỗi
 * 4. Bot crawl analysis → đánh giá crawl budget efficiency
 * 5. AI Market Expansion từ data thực của dashboard
 *
 * Cron: 09:00 hàng ngày
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const projectRoot = path.resolve(__dirname, '../..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^([^=]+)=(.*)$/);
    if (m) {
      const key = m[1].trim();
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (!process.env[key]) process.env[key] = val;
    }
  }
}
loadEnvFile(path.join(projectRoot, '.env.local'));
loadEnvFile(path.join(projectRoot, '.env'));

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const DOMAIN         = 'nhadat.city';
const ANALYTICS_BASE = process.env.SEO_ANALYTICS_URL || 'https://internal.example:4000';
const REPORT_DIR     = path.join(projectRoot, 'seo-reports');
const TG_TOKEN       = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT        = process.env.TELEGRAM_CHAT_ID   || '5711994460';
const GEMINI_KEYS    = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
  process.env.GEMINI_API_KEY_6,
].filter(Boolean);

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);
const today = () => new Date().toISOString().split('T')[0];
const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };

// ─── HTTP FETCH ───────────────────────────────────────────────────────────────
function fetchJson(url, opts = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const reqOpts = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: { 'Accept': 'application/json', ...(opts.headers || {}) },
      rejectUnauthorized: false, // Allow self-signed certs for internal analytics
      timeout: opts.timeout || 15000,
    };
    const req = (u.protocol === 'https:' ? https : require('http')).request(reqOpts, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    });
    req.on('error', err => { log(`[WARN] HTTP ${url}: ${err.message}`); resolve(null); });
    req.on('timeout', () => { req.destroy(); log(`[WARN] Timeout: ${url}`); resolve(null); });
    req.end();
  });
}

// ─── ANALYTICS API HELPERS ────────────────────────────────────────────────────
async function getKeywords(period = 'day') {
  const res = await fetchJson(`${ANALYTICS_BASE}/api/keywords?period=${period}&domain=${DOMAIN}&limit=200`);
  return res?.data || res || [];
}

async function getRankAlerts(period = 'day') {
  const res = await fetchJson(`${ANALYTICS_BASE}/api/rank-alerts?period=${period}`);
  const data = res?.data || res || [];
  return Array.isArray(data) ? data.filter(a => a.domain === DOMAIN) : [];
}

async function getIndexCoverage() {
  const res = await fetchJson(`${ANALYTICS_BASE}/api/gsc/index-coverage?domain=${DOMAIN}`);
  return res?.data || res || {};
}

async function getBotCrawlStats(period = 'day') {
  const res = await fetchJson(`${ANALYTICS_BASE}/api/crawls/stats?period=${period}`);
  return res?.data || res || {};
}

async function getOverview(period = 'day') {
  const res = await fetchJson(`${ANALYTICS_BASE}/api/overview?period=${period}`);
  return res?.data || res || {};
}

async function getPathShifts(period = 'day') {
  const res = await fetchJson(`${ANALYTICS_BASE}/api/path-shifts?period=${period}&domain=${DOMAIN}`);
  const data = res?.data || res || [];
  return Array.isArray(data) ? data.filter(r => r.domain === DOMAIN) : [];
}

// ─── GEMINI AI OPTIMIZER ──────────────────────────────────────────────────────
/**
 * Phân tích zero-click keywords và đề xuất title/description tối ưu
 * Học từ cotuong.xyz/server/services/aiSceoOptimizer.mjs
 */
async function analyzeZeroClickKeywords(zeroClickKws) {
  if (!GEMINI_KEYS.length || !zeroClickKws.length) return null;

  const kwList = zeroClickKws.slice(0, 20).map(k => ({
    query: k.query,
    position: Math.round(k.position),
    impressions: k.impressions,
    domain: DOMAIN,
  }));

  const prompt = `Bạn là CHUYÊN GIA SEO BẤT ĐỘNG SẢN VIỆT NAM.
Website "${DOMAIN}" đang có ${kwList.length} từ khóa bất động sản có impressions cao nhưng ZERO CLICK (CTR 0%).
Đây là dữ liệu thực từ Google Search Console:
${JSON.stringify(kwList)}

Với mỗi từ khóa, hãy đề xuất:
1. Meta Title tối ưu (dưới 60 ký tự, có từ khóa, có call-to-action)
2. Meta Description tối ưu (dưới 155 ký tự, nêu lợi ích rõ ràng, có CTA)
3. Lý do tại sao CTR thấp và cách khắc phục

Chú ý: vị trí hiện tại (position) xác định mức độ ưu tiên — pos 30-50 cần tối ưu URL/content trước, pos 1-10 cần tối ưu title/description ngay.

TRẢ VỀ JSON (KHÔNG MARKDOWN):
{"optimizations":[{"query":"...","currentPosition":0,"suggestedTitle":"...","suggestedDescription":"...","ctrIssue":"...","priority":"high|medium|low"}],"generalStrategy":"..."}`;

  for (const key of GEMINI_KEYS) {
    const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2048, temperature: 0.3 } });
    const result = await new Promise((resolve) => {
      const req = https.request(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 30000,
      }, (res) => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => {
          try {
            if (res.statusCode === 429) { resolve({ _retry: true }); return; }
            const text = JSON.parse(data)?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const clean = text.replace(/```json\n?|```/g, '').trim();
            let obj = null; try { obj = JSON.parse(clean); } catch { const m = clean.match(/\{[\s\S]*\}/); if (m) try { obj = JSON.parse(m[0]); } catch {} }
            resolve(obj);
          } catch { resolve(null); }
        });
      });
      req.on('error', () => resolve(null)); req.on('timeout', () => { req.destroy(); resolve(null); }); req.write(body); req.end();
    });
    if (result && result._retry) { log(`[WARN] Gemini 429 - rotating`); continue; }
    return result;
  }
  return null;
}

// ─── TELEGRAM ─────────────────────────────────────────────────────────────────
async function sendTelegram(text, parseMode = 'HTML') {
  if (!TG_TOKEN || !TG_CHAT) return;
  const chunks = [];
  const MAX_LEN = 4000;
  for (let i = 0; i < text.length; i += MAX_LEN) chunks.push(text.slice(i, i + MAX_LEN));
  
  for (const chunk of chunks) {
    const body = JSON.stringify({ chat_id: TG_CHAT, text: chunk, parse_mode: parseMode, disable_web_page_preview: true });
    await new Promise((resolve) => {
      const req = https.request({ hostname: 'api.telegram.org', path: `/bot${TG_TOKEN}/sendMessage`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 10000 }, (res) => { res.resume(); resolve(); });
      req.on('error', () => resolve()); req.on('timeout', () => { req.destroy(); resolve(); }); req.write(body); req.end();
    });
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const todayStr = today();
  ensureDir(REPORT_DIR);

  log(`========== SEO Integrated Optimizer: ${DOMAIN} – ${todayStr} ==========`);
  log(`Analytics source: ${ANALYTICS_BASE}`);

  // 1. Fetch all data in parallel
  log('--- 1. Fetching data from seo-analytic dashboard ---');
  const [keywords, rankAlerts, indexCoverage, botStats, overview, pathShifts] = await Promise.all([
    getKeywords('day'),
    getRankAlerts('day'),
    getIndexCoverage(),
    getBotCrawlStats('day'),
    getOverview('day'),
    getPathShifts('day'),
  ]);

  log(`  ✅ Keywords: ${keywords.length} | Rank Alerts: ${rankAlerts.length} | Path Shifts: ${pathShifts.length}`);

  // 2. Analyze zero-click keywords
  log('--- 2. Zero-Click Keyword Analysis ---');
  const zeroClickKws = keywords.filter(k => k.clicks === 0 && k.impressions >= 5)
    .sort((a, b) => b.impressions - a.impressions);
  const topImprKws = keywords.sort((a, b) => b.impressions - a.impressions).slice(0, 10);
  
  log(`  Zero-Click with ≥5 impressions: ${zeroClickKws.length}`);
  log(`  Top zero-click: ${zeroClickKws.slice(0,3).map(k=>`"${k.query}"(${k.impressions}i)`).join(', ')}`);

  // 3. Index coverage analysis
  log('--- 3. Index Coverage Analysis ---');
  const errorUrls = (indexCoverage.inspectedUrls || []).filter(u => u.verdict === 'ERROR' || u.verdict === 'NEUTRAL');
  const indexedCount = indexCoverage.indexedCount || 0;
  const errorCount = indexCoverage.errorCount || 0;
  log(`  Indexed: ${indexedCount} | Errors: ${errorCount} | Ratio: ${indexCoverage.indexCoverageRatio}%`);
  
  // 4. Bot crawl analysis for nhadat.city
  log('--- 4. Bot Crawl Analysis ---');
  const nhadatBotData = (botStats.topDomainBots || []).find(d => d.domain === DOMAIN);
  if (nhadatBotData) {
    log(`  Googlebot: ${(nhadatBotData.googlebotHits/1000).toFixed(0)}K/day | AI Crawlers: ${(nhadatBotData.aiBotHits/1000).toFixed(0)}K/day`);
  }

  // 5. Rank alerts for nhadat.city
  log('--- 5. Rank Alerts ---');
  const criticalDrops = rankAlerts.filter(a => a.type === 'CRITICAL_DROP');
  const drops = rankAlerts.filter(a => a.type === 'DROP_WARNING');
  const gains = rankAlerts.filter(a => a.type === 'RANK_GAIN');
  log(`  CRITICAL: ${criticalDrops.length} | DROP: ${drops.length} | GAIN: ${gains.length}`);

  // 6. AI Optimization for zero-click keywords
  log('--- 6. Gemini AI Zero-Click Optimizer ---');
  let aiOptimizations = null;
  if (zeroClickKws.length > 0) {
    aiOptimizations = await analyzeZeroClickKeywords(zeroClickKws.slice(0, 20));
    if (aiOptimizations) {
      const savePath = path.join(REPORT_DIR, `ai-optimizations-${todayStr}.json`);
      fs.writeFileSync(savePath, JSON.stringify({ date: todayStr, domain: DOMAIN, ...aiOptimizations }, null, 2));
      log(`  ✅ AI optimizations saved: ${savePath}`);
    } else {
      log('  [SKIP] AI optimization rate limited or no data');
    }
  }

  // 7. Build comprehensive Telegram report
  log('--- 7. Building Telegram Report ---');
  
  // Summary metrics from GSC
  const gsc = overview.gsc || {};
  const ga4 = overview.ga4 || {};

  let msg = `<b>📊 SEO INTEGRATED REPORT — ${DOMAIN}</b>\n`;
  msg += `<i>${todayStr} | Nguồn: internal.example:4000 + GSC</i>\n\n`;

  // Overall metrics
  msg += `<b>📈 Tổng Quan Hệ Thống:</b>\n`;
  msg += `  • Clicks: <b>${(gsc.clicks||0).toLocaleString()}</b> (${gsc.clicksDiff > 0 ? '+' : ''}${gsc.clicksDiff?.toFixed(1) || 0}%)\n`;
  msg += `  • Impressions: <b>${(gsc.impressions||0).toLocaleString()}</b> (${gsc.impressionsDiff > 0 ? '+' : ''}${gsc.impressionsDiff?.toFixed(1) || 0}%)\n`;
  msg += `  • CTR: <b>${gsc.ctr?.toFixed(2) || 0}%</b> (${gsc.ctrDiff > 0 ? '+' : ''}${gsc.ctrDiff?.toFixed(1) || 0}%)\n`;
  msg += `  • Avg Position: <b>${gsc.avgPosition?.toFixed(1) || 0}</b>\n\n`;

  // nhadat.city specific
  msg += `<b>🏠 nhadat.city (GSC thực tế hôm nay):</b>\n`;
  const totalKwClicks = keywords.reduce((s, k) => s + k.clicks, 0);
  const totalKwImpr = keywords.reduce((s, k) => s + k.impressions, 0);
  msg += `  • Keywords đang theo dõi: <b>${keywords.length}</b>\n`;
  msg += `  • Total Clicks: <b>${totalKwClicks}</b> | Total Impressions: <b>${totalKwImpr}</b>\n`;
  msg += `  • CTR thực tế: <b>${totalKwImpr > 0 ? ((totalKwClicks/totalKwImpr)*100).toFixed(2) : 0}%</b>\n`;
  if (nhadatBotData) {
    msg += `  • Googlebot crawls: <b>${(nhadatBotData.googlebotHits/1000).toFixed(0)}K</b>/ngày\n`;
  }
  msg += '\n';

  // Zero-click opportunities
  if (zeroClickKws.length > 0) {
    msg += `<b>💥 ${zeroClickKws.length} Từ Khóa Zero-Click (Cần Tối Ưu Title/Desc):</b>\n`;
    zeroClickKws.slice(0, 6).forEach(k => {
      msg += `  • pos:<b>${Math.round(k.position)}</b> | ${k.impressions}impr | "<i>${k.query}</i>"\n`;
    });
    msg += '\n';
  }

  // Rank alerts
  if (criticalDrops.length > 0) {
    msg += `🚨 <b>CRITICAL DROPS (${criticalDrops.length}):</b>\n`;
    criticalDrops.forEach(a => { msg += `  ❌ "${a.query}": ${a.previousRank}→${a.currentRank}\n`; });
    msg += '\n';
  }
  if (drops.length > 0) {
    msg += `⬇️ <b>Drop Warnings (${drops.length}):</b>\n`;
    drops.slice(0, 3).forEach(a => { msg += `  ⚠️ "${a.query}": ${a.previousRank}→${a.currentRank}\n`; });
    msg += '\n';
  }
  if (gains.length > 0) {
    msg += `📈 <b>Rank Gains (${gains.length}):</b>\n`;
    gains.slice(0, 3).forEach(a => { msg += `  ✅ "${a.query}": +${Math.abs(a.shift)} vị trí\n`; });
    msg += '\n';
  }

  // Index coverage
  if (errorCount > 0 || errorUrls.length > 0) {
    msg += `🔍 <b>Index Coverage Issues:</b>\n`;
    msg += `  • Indexed: ${indexedCount} | Lỗi: ${errorCount} | Tỉ lệ: ${indexCoverage.indexCoverageRatio}%\n`;
    errorUrls.slice(0, 3).forEach(u => {
      msg += `  ⚠️ ${u.url} → ${u.coverageState}\n`;
    });
    msg += '\n';
  }

  // AI Optimizations
  if (aiOptimizations && aiOptimizations.optimizations) {
    msg += `<b>🤖 AI Đề Xuất Tối Ưu Title/Desc (Gemini):</b>\n`;
    aiOptimizations.optimizations.filter(o => o.priority === 'high').slice(0, 3).forEach(o => {
      msg += `  🎯 "<i>${o.query}</i>" (pos ${o.currentPosition})\n`;
      msg += `  📝 Title: ${o.suggestedTitle}\n`;
      msg += `  📄 Desc: ${o.suggestedDescription?.slice(0,80)}...\n\n`;
    });
    if (aiOptimizations.generalStrategy) {
      msg += `<b>📋 Chiến Lược Tổng Thể:</b> ${aiOptimizations.generalStrategy}\n`;
    }
  }

  // Bot crawl
  msg += `<b>🤖 Bot Crawl Stats (7 ngày):</b>\n`;
  const botDist = botStats.botDistribution || [];
  botDist.forEach(b => { msg += `  • ${b.name}: <b>${(b.count/1000000).toFixed(1)}M</b> (${b.percentage}%)\n`; });

  await sendTelegram(msg);

  // Save full report
  const reportData = { date: todayStr, domain: DOMAIN, keywords: keywords.slice(0, 50), zeroClickOpportunities: zeroClickKws.slice(0, 20), rankAlerts, indexCoverage, botCrawlStats: nhadatBotData, aiOptimizations: aiOptimizations || null };
  fs.writeFileSync(path.join(REPORT_DIR, `integrated-report-${todayStr}.json`), JSON.stringify(reportData, null, 2));
  
  log(`✅ Integrated optimizer complete. Report saved.`);
  log(`========== DONE ==========`);
}

main().catch(err => { console.error('[FATAL]:', err); process.exit(1); });
