import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { sql } from '@/lib/db/pg';

// Constants
export const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '';
export const INDEXNOW_KEY_LOCATION = 'https://nhadat.city/indexnow-key.txt';
export const INDEXNOW_HOST = 'nhadat.city';
export const INDEXNOW_ENDPOINTS = [
  'https://www.bing.com/indexnow',
  'https://api.indexnow.org/indexnow',
  'https://yandex.com/indexnow',
];

export const GOOGLE_DAILY_QUOTA = 200;
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_INDEXING_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish';
export const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/indexing';

export interface IndexingLogEntry {
  batchId?: string;
  provider: 'google' | 'indexnow' | 'bing' | 'yandex' | 'indexnow.org';
  urlCount: number;
  urls: string[];
  type: 'URL_UPDATED' | 'URL_DELETED' | 'BATCH';
  httpStatus: number;
  success: boolean;
  durationMs: number;
  error?: string;
  response?: any;
  createdAt?: Date;
}

export interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  [key: string]: any;
}

// In-memory token cache for Google OAuth2
let cachedGoogleToken: { token: string; expiresAt: number } | null = null;

/**
 * Load Google Service Account JSON configuration
 */
export function getGoogleServiceAccount(): GoogleServiceAccount | null {
  try {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    }
    const keyPath = path.join(process.cwd(), 'google-service-account.json');
    if (fs.existsSync(keyPath)) {
      const raw = fs.readFileSync(keyPath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err: any) {
    console.error('[IndexingEngine Error] Failed to read google-service-account.json:', err?.message || err);
  }
  return null;
}

/**
 * Obtain Google OAuth2 JWT Bearer access token
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  const nowSec = Math.floor(Date.now() / 1000);
  if (cachedGoogleToken && cachedGoogleToken.expiresAt > nowSec + 60) {
    return cachedGoogleToken.token;
  }

  const sa = getGoogleServiceAccount();
  if (!sa || !sa.client_email || !sa.private_key) {
    console.warn('[IndexingEngine Warning] Missing Google Service Account credentials.');
    return null;
  }

  const iat = nowSec;
  const exp = iat + 3600;

  const payload = {
    iss: sa.client_email,
    scope: GOOGLE_SCOPES,
    aud: GOOGLE_TOKEN_URL,
    iat,
    exp,
  };

  const assertion = jwt.sign(payload, sa.private_key, { algorithm: 'RS256' });

  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google token exchange failed with status ${res.status}: ${errText}`);
    }

    const data = await res.json();
    cachedGoogleToken = {
      token: data.access_token,
      expiresAt: nowSec + (data.expires_in || 3600),
    };
    return data.access_token;
  } catch (err: any) {
    console.error('[IndexingEngine Error] Google OAuth token request failed:', err?.message || err);
    return null;
  }
}

/**
 * Log telemetry entry into Postgres `indexing_logs`
 */
export async function logIndexingTelemetry(entry: IndexingLogEntry): Promise<void> {
  try {
    const { provider, httpStatus, urls, createdAt, ...rest } = entry;
    await sql`
      INSERT INTO indexing_logs (url, engine, provider, status, success, http_status, created_at, extra)
      VALUES (${urls?.[0] ?? null}, ${provider}, ${provider}, ${entry.success ? 'success' : 'failed'}, ${!!entry.success},
              ${httpStatus ?? null}, ${createdAt || new Date()},
              ${sql.json(JSON.parse(JSON.stringify({ ...rest, urls })))})`;
  } catch (err: any) {
    console.error('[IndexingEngine:Telemetry Error] Failed to write indexing log to Postgres:', err?.message || err);
  }
}

/**
 * Query remaining Google Indexing daily quota (200 requests/day ceiling)
 */
export async function getGoogleQuotaRemaining(): Promise<{
  usedToday: number;
  remaining: number;
  limit: number;
  resetAt: string;
}> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

  try {
    // Count Google indexing requests submitted today
    const [{ n }] = await sql`
      SELECT COUNT(*)::int AS n FROM indexing_logs
      WHERE provider = 'google' AND created_at >= ${startOfDay}
        AND (success IS TRUE OR http_status IN (200, 202, 400, 403))`; // count attempts against quota
    const usedToday: number = n;

    const remaining = Math.max(0, GOOGLE_DAILY_QUOTA - usedToday);
    return {
      usedToday,
      remaining,
      limit: GOOGLE_DAILY_QUOTA,
      resetAt: endOfDay.toISOString(),
    };
  } catch (err: any) {
    console.error('[IndexingEngine:Quota Error] Error checking Google quota:', err?.message || err);
    return {
      usedToday: 0,
      remaining: GOOGLE_DAILY_QUOTA,
      limit: GOOGLE_DAILY_QUOTA,
      resetAt: endOfDay.toISOString(),
    };
  }
}

/**
 * Submit single URL to Google Indexing API
 */
export async function submitToGoogleIndexing(
  url: string,
  type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED'
): Promise<{
  success: boolean;
  httpStatus: number;
  responseData?: any;
  error?: string;
  durationMs: number;
}> {
  const startTime = Date.now();

  const formattedUrl = url.startsWith('http') ? url : `https://nhadat.city${url.startsWith('/') ? '' : '/'}${url}`;

  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    const durationMs = Date.now() - startTime;
    const errorMsg = 'No Google OAuth2 access token available';
    await logIndexingTelemetry({
      provider: 'google',
      urlCount: 1,
      urls: [formattedUrl],
      type,
      httpStatus: 401,
      success: false,
      durationMs,
      error: errorMsg,
    });
    return { success: false, httpStatus: 401, error: errorMsg, durationMs };
  }

  try {
    const response = await fetch(GOOGLE_INDEXING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        url: formattedUrl,
        type,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const durationMs = Date.now() - startTime;
    const responseData = await response.json().catch(() => null);

    const isSuccess = response.ok;
    const httpStatus = response.status;

    await logIndexingTelemetry({
      provider: 'google',
      urlCount: 1,
      urls: [formattedUrl],
      type,
      httpStatus,
      success: isSuccess,
      durationMs,
      response: responseData,
      error: !isSuccess ? JSON.stringify(responseData) : undefined,
    });

    if (isSuccess) {
      console.log(`[IndexingEngine:Google] Successfully dispatched [${type}] for ${formattedUrl} (${durationMs}ms)`);
      return { success: true, httpStatus, responseData, durationMs };
    } else {
      console.warn(`[IndexingEngine:Google Warning] Dispatch failed (${httpStatus}) for ${formattedUrl}:`, responseData);
      return { success: false, httpStatus, responseData, error: JSON.stringify(responseData), durationMs };
    }
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    console.error(`[IndexingEngine:Google Error] Exception dispatching ${formattedUrl}:`, err?.message || err);
    await logIndexingTelemetry({
      provider: 'google',
      urlCount: 1,
      urls: [formattedUrl],
      type,
      httpStatus: 500,
      success: false,
      durationMs,
      error: err?.message || String(err),
    });
    return { success: false, httpStatus: 500, error: err?.message || String(err), durationMs };
  }
}

/**
 * Submit URLs to IndexNow endpoints (Bing, Yandex, IndexNow.org)
 */
export async function submitToIndexNow(urls: string[]): Promise<{
  success: boolean;
  totalUrls: number;
  endpointResults: Array<{ endpoint: string; status: number; success: boolean; error?: string }>;
  durationMs: number;
}> {
  const startTime = Date.now();

  const formattedUrls = urls
    .map(u => u.startsWith('http') ? u : `https://nhadat.city${u.startsWith('/') ? '' : '/'}${u}`)
    .filter(u => u.startsWith('https://nhadat.city/'));

  if (formattedUrls.length === 0) {
    return { success: true, totalUrls: 0, endpointResults: [], durationMs: 0 };
  }

  const payload = {
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList: formattedUrls,
  };

  const endpointResults: Array<{ endpoint: string; status: number; success: boolean; error?: string }> = [];

  for (const endpoint of INDEXNOW_ENDPOINTS) {
    const epStart = Date.now();
    let providerName: 'bing' | 'yandex' | 'indexnow.org' = 'indexnow.org';
    if (endpoint.includes('bing')) providerName = 'bing';
    else if (endpoint.includes('yandex')) providerName = 'yandex';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      const epDuration = Date.now() - epStart;
      const isOk = response.status === 200 || response.status === 202;
      endpointResults.push({
        endpoint,
        status: response.status,
        success: isOk,
        error: !isOk ? `HTTP ${response.status}` : undefined,
      });

      await logIndexingTelemetry({
        provider: providerName,
        urlCount: formattedUrls.length,
        urls: formattedUrls,
        type: 'BATCH',
        httpStatus: response.status,
        success: isOk,
        durationMs: epDuration,
        error: !isOk ? `HTTP status ${response.status}` : undefined,
      });

      console.log(`[IndexingEngine:IndexNow] Sent ${formattedUrls.length} URLs to ${endpoint} -> HTTP ${response.status} (${epDuration}ms)`);
    } catch (err: any) {
      const epDuration = Date.now() - epStart;
      endpointResults.push({
        endpoint,
        status: 500,
        success: false,
        error: err?.message || String(err),
      });

      await logIndexingTelemetry({
        provider: providerName,
        urlCount: formattedUrls.length,
        urls: formattedUrls,
        type: 'BATCH',
        httpStatus: 500,
        success: false,
        durationMs: epDuration,
        error: err?.message || String(err),
      });

      console.error(`[IndexingEngine:IndexNow Error] Failed to send to ${endpoint}:`, err?.message || err);
    }
  }

  const overallSuccess = endpointResults.some(r => r.success);
  return {
    success: overallSuccess,
    totalUrls: formattedUrls.length,
    endpointResults,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Enqueue a URL into Postgres `indexing_queue`
 */
export async function enqueueIndexingUrl(
  url: string,
  type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED',
  priority: number = 1,
  source: string = 'user-post'
): Promise<{ success: boolean; queueId?: string; error?: string }> {
  try {
    const formattedUrl = url.startsWith('http') ? url : `https://nhadat.city${url.startsWith('/') ? '' : '/'}${url}`;
    const now = new Date();
    const prio = Math.min(priority, 3);

    // url is UNIQUE (migration 007): one row per url; re-enqueue resets it to pending (status is always lowercase)
    const rows = await sql`
      INSERT INTO indexing_queue (url, type, status, priority, source, attempts, created_at, updated_at, next_attempt_at)
      VALUES (${formattedUrl}, ${type}, 'pending', ${prio}, ${source}, 0, ${now}, ${now}, ${now})
      ON CONFLICT (url) DO UPDATE SET
        type = EXCLUDED.type, priority = EXCLUDED.priority, source = EXCLUDED.source,
        status = 'pending', attempts = 0, updated_at = EXCLUDED.updated_at, next_attempt_at = EXCLUDED.next_attempt_at
      RETURNING id`;

    console.log(`[IndexingEngine:Queue] Enqueued URL: ${formattedUrl} [${type}, priority: ${priority}, source: ${source}]`);
    return {
      success: true,
      queueId: String(rows[0].id),
    };
  } catch (err: any) {
    console.error('[IndexingEngine:Queue Error] Failed to enqueue URL:', err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Helper to calculate exponential backoff delay in seconds
 */
export function calculateBackoff(attempts: number, baseSeconds: number = 30, maxSeconds: number = 3600): number {
  return Math.min(maxSeconds, Math.pow(2, attempts) * baseSeconds);
}

/**
 * Helper to allocate Google and IndexNow quota
 */
export function allocateQuota(
  requestedCount: number,
  usedToday: number,
  maxDailyQuota: number = GOOGLE_DAILY_QUOTA
): {
  googleCount: number;
  indexNowSurplus: number;
  remainingQuota: number;
} {
  const remainingQuota = Math.max(0, maxDailyQuota - usedToday);
  const googleCount = Math.min(requestedCount, remainingQuota);
  const indexNowSurplus = requestedCount - googleCount;
  return {
    googleCount,
    indexNowSurplus,
    remainingQuota: remainingQuota - googleCount,
  };
}
