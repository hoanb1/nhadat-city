/**
 * GET /api/map-token
 *
 * Returns a signed, IP-bound, short-lived token that must be appended to
 * tile requests as ?t=<token>. This endpoint should only be called by
 * the browser — bots without JS execution cannot obtain tokens.
 */
import { NextRequest, NextResponse } from 'next/server';
import { generateMapToken } from '@/lib/middleware/mapToken';
import { isAllowedOrigin } from '@/lib/middleware/rateLimiter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_DOMAINS = ['nhadat.city', 'localhost', '127.0.0.1'];

export async function GET(request: NextRequest) {
  // Only browsers on nhadat.city may request tokens
  if (!isAllowedOrigin(request, ALLOWED_DOMAINS)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { token, expires } = generateMapToken();

  return NextResponse.json(
    { token, expires },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Access-Control-Allow-Origin': request.headers.get('origin') || 'https://nhadat.city',
        'Vary': 'Origin',
      },
    }
  );
}
