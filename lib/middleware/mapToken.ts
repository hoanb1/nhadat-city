/**
 * mapToken — HMAC-based short-lived token for map tile requests.
 *
 * Flow:
 *   1. Client loads page → calls /api/map-token → gets { token, expires }
 *   2. Client appends ?t=<token> to every tile request
 *   3. Map-api proxy validates token before serving tiles
 *
 * Token = base64url( HMAC-SHA256( payload ) ) + "." + base64url( payload )
 * Payload = { exp: unixSeconds, nonce: random }
 *
 * NOTE: IP binding is intentionally REMOVED because Cloudflare/VPN can cause
 * the client IP to differ between the token request and tile requests.
 * Protection relies on:
 *   - Short TTL (5 min) — token cannot be stockpiled
 *   - Requires JS execution — bots without headless browser can't get token
 *   - Origin/Referer check — prevents cross-origin scraping
 *   - Rate limiting — throttles even valid token holders
 */

import { createHmac, randomBytes } from 'crypto';

/** Secret key — fallback to random per-process if not set (resets on restart = safe). */
const SECRET = process.env.MAP_TOKEN_SECRET || randomBytes(32).toString('hex');

/** Token validity in seconds. */
const TOKEN_TTL_SECONDS = 300; // 5 minutes

interface TokenPayload {
  /** Expiry (unix seconds). */
  exp: number;
  /** Random nonce (prevents prediction). */
  n: string;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s, 'base64url');
}

/**
 * Generate a signed map token.
 */
export function generateMapToken(): { token: string; expires: number } {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload: TokenPayload = {
    exp,
    n: randomBytes(8).toString('hex'),
  };

  const payloadStr = JSON.stringify(payload);
  const payloadB64 = b64url(Buffer.from(payloadStr));

  const sig = createHmac('sha256', SECRET).update(payloadB64).digest();
  const sigB64 = b64url(sig);

  return {
    token: `${sigB64}.${payloadB64}`,
    expires: exp,
  };
}

/**
 * Validate a map token.
 *
 * @returns null if valid, error string if invalid.
 */
export function validateMapToken(token: string): string | null {
  if (!token) return 'missing token';

  const parts = token.split('.');
  if (parts.length !== 2) return 'malformed token';

  const [sigB64, payloadB64] = parts;

  // Verify signature
  const expectedSig = createHmac('sha256', SECRET).update(payloadB64).digest();
  const actualSig = b64urlDecode(sigB64);

  if (!expectedSig.equals(actualSig)) return 'invalid signature';

  // Parse payload
  let payload: TokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString());
  } catch {
    return 'corrupt payload';
  }

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) return 'token expired';

  return null; // valid
}
