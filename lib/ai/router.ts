/**
 * AI Router — Multi-provider, multi-key fallback system
 * 
 * Priority chain (fastest free tier first):
 *   1. Google Gemini  — gemini-2.0-flash   (1500 req/day free per key)
 *   2. Groq           — llama-3.3-70b       (Free, very fast inference)
 *   3. Mistral        — mistral-small        (Free tier)
 *   4. OpenRouter     — google/gemini-flash  (Aggregator, many free models)
 *   5. Google Gemini  — gemini-2.5-flash    (Paid plan fallback, best quality)
 * 
 * Each provider can have MULTIPLE API keys (pool).
 * On 429/quota errors, the router automatically tries the next key/provider.
 */

import { LanguageModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';

// ── Types ───────────────────────────────────────────────────────────────────
export interface ModelCandidate {
  name: string;          // Human-readable name for logs
  provider: string;      // Provider ID
  model: string;         // Model ID
  getModel: () => LanguageModel;
  priority: number;      // Lower = tried first
}

// ── Build the candidate pool from env ───────────────────────────────────────
async function fetchDynamicGeminiModels(apiKey: string): Promise<{ flash: string, pro: string }> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!res.ok) return { flash: 'gemini-flash-latest', pro: 'gemini-pro-latest' };
    const data = await res.json();
    const models = data.models.map((m: any) => m.name.replace('models/', ''));
    
    const excludeWords = ['preview', 'lite', 'latest', 'exp', 'image', 'audio', 'tts', 'vision'];
    const flashModels = models.filter((m: string) => m.includes('flash') && !excludeWords.some(w => m.includes(w)));
    flashModels.sort().reverse(); // e.g., gemini-2.5-flash > gemini-2.0-flash
    const flash = flashModels[0] || 'gemini-flash-latest';

    const proModels = models.filter((m: string) => m.includes('pro') && !excludeWords.some(w => m.includes(w)));
    proModels.sort().reverse();
    const pro = proModels[0] || 'gemini-pro-latest';

    return { flash, pro };
  } catch(e) {
    return { flash: 'gemini-flash-latest', pro: 'gemini-pro-latest' };
  }
}

async function fetchDynamicGroqModel(apiKey: string): Promise<string> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { 'Authorization': `Bearer ${apiKey}` }});
    if (!res.ok) return 'llama-3.3-70b-versatile';
    const data = await res.json();
    const models = data.data.map((m: any) => m.id);
    const llamaModels = models.filter((m: string) => m.includes('llama-3') && !m.includes('tool-use') && !m.includes('vision') && !m.includes('guard'));
    llamaModels.sort().reverse();
    return llamaModels[0] || 'llama-3.3-70b-versatile';
  } catch(e) {
    return 'llama-3.3-70b-versatile';
  }
}

async function fetchDynamicMistralModel(apiKey: string): Promise<string> {
  try {
    const res = await fetch('https://api.mistral.ai/v1/models', { headers: { 'Authorization': `Bearer ${apiKey}` }});
    if (!res.ok) return 'mistral-small-latest';
    const data = await res.json();
    const models = data.data.map((m: any) => m.id);
    const smallModels = models.filter((m: string) => m.includes('small'));
    smallModels.sort().reverse();
    return smallModels[0] || 'mistral-small-latest';
  } catch(e) {
    return 'mistral-small-latest';
  }
}

async function fetchDynamicOpenRouterModels(): Promise<{ fast: string, reasoning: string }> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) return { fast: 'google/gemini-2.5-flash-lite', reasoning: 'meta-llama/llama-3.3-70b-instruct:free' };
    const data = await res.json();
    // find models with zero cost
    const freeModels = data.data.filter((m: any) => m.pricing?.prompt === "0" && m.pricing?.completion === "0");
    const ids = freeModels.map((m: any) => m.id);
    
    const excludeWords = ['image', 'vision', 'audio', 'tts', 'guard'];
    const gemini = ids.filter((m: string) => m.includes('gemini') && m.includes('flash') && m.includes('free') && !excludeWords.some(w => m.includes(w))).sort().reverse()[0];
    const llama = ids.filter((m: string) => m.includes('llama') && m.includes('70b') && m.includes('free') && !excludeWords.some(w => m.includes(w))).sort().reverse()[0];
    
    return { 
      fast: gemini || 'google/gemini-2.5-flash-lite', 
      reasoning: llama || 'meta-llama/llama-3.3-70b-instruct:free' 
    };
  } catch(e) {
    return { fast: 'google/gemini-2.5-flash-lite', reasoning: 'meta-llama/llama-3.3-70b-instruct:free' };
  }
}

async function buildCandidates(): Promise<ModelCandidate[]> {
  const candidates: ModelCandidate[] = [];

  // --- Groq (priority 15+): fast, reliable, but strict 100k TPD / 12k TPM limits
  // NOTE: Groq is now fallback because its strict limits cause stream crashes during multi-step tool calls
  const groqKeys = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
  ].filter(Boolean) as string[];

  let dynamicGroq = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  if (groqKeys[0] && !process.env.GROQ_MODEL) {
    dynamicGroq = await fetchDynamicGroqModel(groqKeys[0]);
  }

  groqKeys.forEach((key, i) => {
    const groq = createGroq({ apiKey: key });
    candidates.push({
      name: `Groq/${dynamicGroq.split('-')[0]}-${dynamicGroq.split('-')[1] || 'model'} [key${i + 1}]`,
      provider: 'groq',
      model: dynamicGroq,
      getModel: () => groq(dynamicGroq),
      priority: 15 + i,
    });
  });

  // --- Google Gemini 1.5 Flash (priority 5+, key pool: 6 keys × 1500 req/day)
  // Gemini is primary because it handles massive contexts and has no strict TPM limits.
  // All keys are same Google project so they share per-minute quota
  const geminiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    process.env.GEMINI_API_KEY_6,
  ].filter(Boolean) as string[];

  let dynamicFlash = process.env.GEMINI_MODEL_FAST || 'gemini-flash-latest';
  let dynamicPro = process.env.GEMINI_MODEL_PRO || 'gemini-pro-latest';
  
  if (geminiKeys[0] && !process.env.GEMINI_MODEL_FAST && !process.env.GEMINI_MODEL_PRO) {
     const fetched = await fetchDynamicGeminiModels(geminiKeys[0]);
     dynamicFlash = fetched.flash;
     dynamicPro = fetched.pro;
  }

  geminiKeys.forEach((key, i) => {
    const g = createGoogleGenerativeAI({ apiKey: key });
    const modelName = dynamicFlash;
    candidates.push({
      name: `${modelName} [key${i + 1}]`,
      provider: 'google',
      model: modelName,
      getModel: () => g(modelName),
      priority: 5 + i,
    });
  });

  // --- Mistral (mistral-small, free tier) ----------------------------------
  const mistralKeys = [
    process.env.MISTRAL_API_KEY,
    process.env.MISTRAL_API_KEY_2,
  ].filter(Boolean) as string[];

  let dynamicMistral = process.env.MISTRAL_MODEL || 'mistral-small-latest';
  if (mistralKeys[0] && !process.env.MISTRAL_MODEL) {
    dynamicMistral = await fetchDynamicMistralModel(mistralKeys[0]);
  }

  mistralKeys.forEach((key, i) => {
    const mistral = createMistral({ apiKey: key });
    candidates.push({
      name: `Mistral/${dynamicMistral.replace('-latest', '')} [key${i + 1}]`,
      provider: 'mistral',
      model: dynamicMistral,
      getModel: () => mistral(dynamicMistral),
      priority: 30 + i,
    });
  });

  // --- OpenRouter (aggregator — routes to many free models) ----------------
  const orKey = process.env.OPENROUTER_API_KEY;
  if (orKey) {
    const or = createOpenAI({
      apiKey: orKey,
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'HTTP-Referer': 'https://nhadat.city',
        'X-Title': 'NhaDat.City AI',
      },
    });
    
    let dynamicORFast = process.env.OPENROUTER_MODEL_FAST;
    let dynamicORReasoning = process.env.OPENROUTER_MODEL_PRO;
    if (!dynamicORFast || !dynamicORReasoning) {
      const orModels = await fetchDynamicOpenRouterModels();
      if (!dynamicORFast) dynamicORFast = orModels.fast;
      if (!dynamicORReasoning) dynamicORReasoning = orModels.reasoning;
    }

    // Use a free Google model via OpenRouter
    candidates.push({
      name: `OpenRouter/${dynamicORFast!.split('/')[1] || 'fast'}`,
      provider: 'openrouter',
      model: dynamicORFast!,
      getModel: () => or(dynamicORFast!),
      priority: 40,
    });
    candidates.push({
      name: `OpenRouter/${dynamicORReasoning!.split('/')[1] || 'reasoning'}`,
      provider: 'openrouter',
      model: dynamicORReasoning!,
      getModel: () => or(dynamicORReasoning!),
      priority: 41,
    });
  }

  // --- Google Gemini (best quality, fallback) ----
  geminiKeys.forEach((key, i) => {
    const g = createGoogleGenerativeAI({ apiKey: key });
    const modelName = dynamicPro;
    candidates.push({
      name: `${modelName} [key${i + 1}]`,
      provider: 'google',
      model: modelName,
      getModel: () => g(modelName),
      priority: 50 + i,
    });
  });

  return candidates.sort((a, b) => a.priority - b.priority);
}

// ── Singleton pool (built once per process) ──────────────────────────────────
let _pool: ModelCandidate[] | null = null;
export async function getModelPool(): Promise<ModelCandidate[]> {
  if (!_pool) _pool = await buildCandidates();
  return _pool;
}

// ── Quota / rate-limit tracking ─────────────────────────────────────────────
const rateLimitedModels = new Map<string, number>();

export function markModelRateLimited(candidate: ModelCandidate, resetMs: number = 60000, errorMsg?: string) {
  let penalty = resetMs;
  if (errorMsg) {
    const msg = errorMsg.toLowerCase();
    const match = msg.match(/try again in (?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)/);
    if (match) {
      const h = parseInt(match[1] || '0', 10);
      const m = parseInt(match[2] || '0', 10);
      const s = parseFloat(match[3] || '0');
      penalty = (h * 3600 + m * 60 + s) * 1000 + 5000; // add 5s buffer
    } else if (msg.includes('tokens per day') || msg.includes('tpd')) {
      penalty = Math.max(penalty, 3600 * 1000); // at least 1 hour for daily limit
    }
  }
  rateLimitedModels.set(candidateKey(candidate), Date.now() + penalty);
  return penalty;
}

// ── Quota / rate-limit error detection ──────────────────────────────────────
export function isRateLimitError(err: any): boolean {
  const status = err?.statusCode ?? err?.status ?? err?.cause?.statusCode;
  if (status === 429) return true;
  const msg = (err?.message || err?.cause?.message || '').toLowerCase();
  return (
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('too many requests') ||
    msg.includes('exceeded')
  );
}

// ── Main export: get next available model ───────────────────────────────────
/**
 * Returns the first available LanguageModelV1 in the pool.
 * 
 * Pass `exclude` to skip models that already failed this request.
 * The router logs each attempt with [ROUTER] prefix.
 */
export function getNextModel(
  pool: ModelCandidate[],
  exclude: Set<string> = new Set(),
  logFn: (level: string, step: string, data?: any) => void = () => {},
  estTokens: number = 0
): { model: LanguageModel; candidate: ModelCandidate } | null {
  for (const candidate of pool) {
    const key = candidateKey(candidate);
    if (exclude.has(key)) continue;
    
    // Skip if model is currently rate-limited
    const rateLimitUntil = rateLimitedModels.get(key);
    if (rateLimitUntil && Date.now() < rateLimitUntil) {
       logFn('DEBUG', 'ROUTER_SKIP_RATELIMITED', { name: candidate.name, until: new Date(rateLimitUntil).toISOString() });
       continue;
    }
    
    // Skip Groq for long prompts due to strict 12k TPM limits
    if (candidate.provider === 'groq' && estTokens > 3500) {
       logFn('DEBUG', 'ROUTER_SKIP_LONG_PROMPT', { name: candidate.name, estTokens });
       continue;
    }
    
    logFn('DEBUG', 'ROUTER_CANDIDATE', { name: candidate.name, priority: candidate.priority });
    try {
      const model = candidate.getModel();
      return { model, candidate };
    } catch (e) {
      logFn('WARN', 'ROUTER_BUILD_FAIL', { name: candidate.name, error: (e as Error).message });
    }
  }
  return null;
}

/** 
 * Key to exclude a failed candidate from retry loop.
 * Stable key regardless of instantiation order.
 */
export function candidateKey(c: ModelCandidate): string {
  return `${c.provider}:${c.model}:${c.name}`;
}


