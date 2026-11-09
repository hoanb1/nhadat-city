const fs = require('fs');
const path = require('path');
const https = require('https');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ── Load env ──────────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.resolve(__dirname, '../../.env.local');
  const env = {};
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^#=]+)=(.+)/);
      if (m) env[m[1].trim()] = m[2].replace(/['"]/g, '').trim();
    });
  }
  return env;
}

const ENV = loadEnv();

// ── Gemini keys ───────────────────────────────────────────────────────────────
const geminiKeys = Object.entries(ENV)
  .filter(([k]) => k.startsWith('GEMINI_API_KEY'))
  .map(([, v]) => v);

// ── Other provider keys ───────────────────────────────────────────────────────
const groqKeys = Object.entries(ENV)
  .filter(([k]) => k.startsWith('GROQ_API_KEY'))
  .map(([, v]) => v);

const mistralKey = ENV['MISTRAL_API_KEY'] || null;
const openrouterKey = ENV['OPENROUTER_API_KEY'] || null;

// ── Exhausted key tracking (reset every hour) ─────────────────────────────────
const exhausted = { gemini: new Set(), groq: new Set() };
let exhaustedResetAt = Date.now() + 60 * 60 * 1000;

function resetExhaustedIfNeeded() {
  if (Date.now() > exhaustedResetAt) {
    exhausted.gemini.clear();
    exhausted.groq.clear();
    exhaustedResetAt = Date.now() + 60 * 60 * 1000;
    console.log('[AI_HUB] Reset exhausted keys (1h interval).');
  }
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function httpPost(hostname, urlPath, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname, path: urlPath, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers } },
      (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch (e) { reject(new Error('JSON parse: ' + raw.slice(0, 100))); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

function parseJsonFromText(text) {
  if (!text) return null;
  const clean = text.replace(/```json\n?|\n?```/g, '').trim();
  try { return JSON.parse(clean); } catch (_) {}
  const m = clean.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (_) {} }
  return null;
}

// ── Provider: Gemini ──────────────────────────────────────────────────────────
async function tryGemini(prompt) {
  resetExhaustedIfNeeded();
  if (geminiKeys.length === 0) return null;
  const models = [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-pro-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-flash-latest',
  ];
  for (let i = 0; i < geminiKeys.length; i++) {
    if (exhausted.gemini.has(i)) continue;
    const genAI = new GoogleGenerativeAI(geminiKeys[i]);
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const parsed = parseJsonFromText(result.response.text());
        if (parsed) return parsed;
      } catch (e) {
        if (e.message.includes('429') || e.message.includes('quota')) {
          exhausted.gemini.add(i);
          const left = geminiKeys.length - exhausted.gemini.size;
          console.warn(`[AI_HUB] Gemini key[${i}] 429. Còn ${left} key.`);
          break;
        }
        console.error(`[AI_HUB] Gemini key[${i}] ${modelName}:`, e.message.split('\n')[0]);
      }
    }
  }
  return null;
}

// ── Provider: Groq ────────────────────────────────────────────────────────────
async function tryGroq(prompt) {
  resetExhaustedIfNeeded();
  if (groqKeys.length === 0) return null;
  const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'];
  for (let ki = 0; ki < groqKeys.length; ki++) {
    if (exhausted.groq.has(ki)) continue;
    for (const model of models) {
      try {
        const res = await httpPost('api.groq.com', '/openai/v1/chat/completions',
          { Authorization: 'Bearer ' + groqKeys[ki] },
          { model, messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 800 }
        );
        if (res.status === 429) { exhausted.groq.add(ki); console.warn(`[AI_HUB] Groq key[${ki}] 429.`); break; }
        if (res.status !== 200) { console.warn(`[AI_HUB] Groq ${model} status ${res.status}`); continue; }
        const parsed = parseJsonFromText(res.body?.choices?.[0]?.message?.content);
        if (parsed) return parsed;
      } catch (e) {
        console.error(`[AI_HUB] Groq key[${ki}] ${model}:`, e.message.split('\n')[0]);
      }
    }
  }
  return null;
}

// ── Provider: Mistral ─────────────────────────────────────────────────────────
async function tryMistral(prompt) {
  if (!mistralKey) return null;
  try {
    const res = await httpPost('api.mistral.ai', '/v1/chat/completions',
      { Authorization: 'Bearer ' + mistralKey },
      { model: 'mistral-small-latest', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 800 }
    );
    if (res.status === 429) { console.warn('[AI_HUB] Mistral 429.'); return null; }
    if (res.status !== 200) { console.warn('[AI_HUB] Mistral status', res.status); return null; }
    return parseJsonFromText(res.body?.choices?.[0]?.message?.content);
  } catch (e) {
    console.error('[AI_HUB] Mistral:', e.message.split('\n')[0]);
    return null;
  }
}

// ── Provider: OpenRouter ──────────────────────────────────────────────────────
async function tryOpenRouter(prompt) {
  if (!openrouterKey) return null;
  const models = [
    'meta-llama/llama-3.1-8b-instruct:free',   // Meta Llama 3.1 8B – stable free
    'qwen/qwen3-8b:free',                        // Qwen3 8B free
    'microsoft/phi-4-reasoning-plus:free',       // Phi-4 reasoning
    'deepseek/deepseek-r1-0528:free',            // DeepSeek R1
  ];

  for (const model of models) {
    try {
      const res = await httpPost('openrouter.ai', '/api/v1/chat/completions',
        { Authorization: 'Bearer ' + openrouterKey, 'HTTP-Referer': 'https://nhadat.city', 'X-Title': 'NhaDat Scraper' },
        { model, messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 800 }
      );
      if (res.status === 429) { console.warn('[AI_HUB] OpenRouter ' + model + ' 429.'); continue; }
      if (res.status !== 200) continue;
      const parsed = parseJsonFromText(res.body?.choices?.[0]?.message?.content);
      if (parsed) return parsed;
    } catch (e) {
      console.error('[AI_HUB] OpenRouter ' + model + ':', e.message.split('\n')[0]);
    }
  }
  return null;
}

// ── Provider: Local GPU Qwen 249 ─────────────────────────────────────────────
function httpLocalPost(hostname, port, urlPath, body) {
  const httpModule = require('http');
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = httpModule.request(
      { hostname, port, path: urlPath, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch (e) { reject(new Error('JSON parse: ' + raw.slice(0, 100))); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

async function tryLocalOllama(prompt) {
  const models = ['qwen2.5:7b', 'qwen2.5:1.5b'];
  for (const model of models) {
    try {
      const res = await httpLocalPost('internal.example', 11434, '/api/chat', {
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { temperature: 0.3 }
      });
      if (res.status === 200 && res.body?.message?.content) {
        const parsed = parseJsonFromText(res.body.message.content);
        if (parsed) return parsed;
      }
    } catch (e) {
      console.warn(`[AI_HUB] Local GPU Ollama (${model}) error:`, e.message.split('\n')[0]);
    }
  }
  return null;
}

// ── Main: multi-provider fallback chain ───────────────────────────────────────
// Gemini → Local GPU Ollama → Groq → Mistral → OpenRouter → fallback nội dung gốc
async function generateContentWithRetry(db, prompt, fallbackObj, maxRetries = 3, actionName = 'AI Text Generation') {
  const providers = [
    { name: 'Gemini',          fn: () => tryGemini(prompt) },
    { name: 'Local GPU Qwen',  fn: () => tryLocalOllama(prompt) },
    { name: 'Groq',            fn: () => tryGroq(prompt) },
    { name: 'Mistral',         fn: () => tryMistral(prompt) },
    { name: 'OpenRouter',      fn: () => tryOpenRouter(prompt) },
  ];

  for (const provider of providers) {
    try {
      const result = await provider.fn();
      if (result) {
        if (db) {
          db.collection('ai_logs').insertOne({
            action: actionName, provider: provider.name, createdAt: new Date()
          }).catch(() => {});
        }
        console.log(`[AI_HUB] OK via ${provider.name} - ${actionName}`);
        return { ...fallbackObj, ...result };
      }
    } catch (e) {
      console.error(`[AI_HUB] ${provider.name} threw:`, e.message.split('\n')[0]);
    }
    console.log(`[AI_HUB] ${provider.name} không khả dụng → thử provider tiếp theo...`);
  }

  console.warn('[AI_HUB] Tất cả providers thất bại → dùng nội dung gốc.');
  return fallbackObj;
}

module.exports = { generateContentWithRetry };
