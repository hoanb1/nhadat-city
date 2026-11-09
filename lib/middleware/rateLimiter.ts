/**
 * rateLimiter — Sliding-window, per-IP rate limiter (in-memory).
 *
 * Usage:
 *   import { checkRateLimit } from '@/lib/middleware/rateLimiter';
 *   const result = checkRateLimit(ip, 'map-tile', { maxRequests: 60, windowMs: 60_000 });
 *   if (!result.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 */

interface RateLimitEntry {
  timestamps: number[];
  /** Unix-ms of the last cleanup pass for this key. */
  lastCleanup: number;
}

interface RateLimitOptions {
  /** Maximum requests allowed within the window. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  /** Current count within the window. */
  current: number;
}

/** Namespace → IP → entry */
const stores = new Map<string, Map<string, RateLimitEntry>>();

/** Interval handle for periodic eviction of stale keys. */
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

const CLEANUP_INTERVAL_MS = 60_000; // every 60 s
const MAX_KEYS_PER_NS = 50_000; // hard cap to prevent OOM

// ── helpers ──────────────────────────────────────────────────────────────────

function getStore(namespace: string): Map<string, RateLimitEntry> {
  let store = stores.get(namespace);
  if (!store) {
    store = new Map();
    stores.set(namespace, store);
  }
  return store;
}

function evictStale(namespace: string, windowMs: number) {
  const store = stores.get(namespace);
  if (!store) return;

  const now = Date.now();
  const cutoff = now - windowMs * 2; // double window to be safe

  for (const [key, entry] of store) {
    if (entry.lastCleanup < cutoff && entry.timestamps.every(t => t < now - windowMs)) {
      store.delete(key);
    }
  }
}

function ensureCleanupTimer() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    for (const [ns, store] of stores) {
      if (store.size > MAX_KEYS_PER_NS) {
        // Emergency: drop oldest half
        const keys = [...store.keys()];
        const toDrop = keys.slice(0, Math.floor(keys.length / 2));
        for (const k of toDrop) store.delete(k);
        console.warn(`[RateLimiter] Emergency eviction in ns=${ns}: dropped ${toDrop.length} keys`);
      }
      evictStale(ns, 120_000); // conservative 2-min window for cleanup
    }
  }, CLEANUP_INTERVAL_MS);

  // Allow Node process to exit even if timer is alive.
  if (typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// ── public API ───────────────────────────────────────────────────────────────

/**
 * Check and record a request against the rate limit.
 *
 * @param ip      Client IP (use `request.headers.get('x-forwarded-for')` behind proxy).
 * @param namespace  Logical bucket, e.g. `'map-tile'`, `'parcel-info'`.
 * @param options Rate limit parameters.
 * @returns       Whether the request is allowed, remaining quota, and reset time.
 */
export function checkRateLimit(
  ip: string,
  namespace: string,
  options: RateLimitOptions
): RateLimitResult {
  ensureCleanupTimer();

  const { maxRequests, windowMs } = options;
  const store = getStore(namespace);
  const now = Date.now();

  let entry = store.get(ip);
  if (!entry) {
    entry = { timestamps: [], lastCleanup: now };
    store.set(ip, entry);
  }

  // Slide window: remove timestamps older than the window.
  entry.timestamps = entry.timestamps.filter(t => t > now - windowMs);
  entry.lastCleanup = now;

  const current = entry.timestamps.length;

  if (current >= maxRequests) {
    // Earliest timestamp that will fall off the window.
    const oldest = entry.timestamps[0] ?? now;
    const resetMs = oldest + windowMs - now;
    return { allowed: false, remaining: 0, resetMs: Math.max(resetMs, 0), current };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - current - 1,
    resetMs: windowMs,
    current: current + 1,
  };
}

/**
 * Extract client IP from a NextRequest, handling X-Forwarded-For (Cloudflare/Nginx).
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;
  // Cloudflare
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;
  // X-Forwarded-For (first entry)
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || 'unknown';
  // X-Real-Ip (Nginx)
  const xri = headers.get('x-real-ip');
  if (xri) return xri;
  return 'unknown';
}

/**
 * Validate Origin / Referer against an allow-list of domains.
 * Returns true if the request origin is allowed.
 */
export function isAllowedOrigin(request: Request, allowedDomains: string[]): boolean {
  const origin = request.headers.get('origin') || '';
  const referer = request.headers.get('referer') || '';

  // Allow empty origin (same-origin requests, server-side)
  if (!origin && !referer) return true;
  
  // Web workers sometimes send origin 'null' for blob URLs
  if (origin === 'null' && !referer) return true;

  const check = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return allowedDomains.some(d => hostname === d || hostname.endsWith(`.${d}`));
    } catch {
      return false;
    }
  };

  if (origin && origin !== 'null' && check(origin)) return true;
  if (referer && check(referer)) return true;

  return false;
}

/**
 * Build standard rate-limit response headers.
 */
export function rateLimitHeaders(result: RateLimitResult, windowMs: number): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.current + result.remaining),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil((Date.now() + result.resetMs) / 1000)),
    'Retry-After': String(Math.ceil(result.resetMs / 1000)),
  };
}
