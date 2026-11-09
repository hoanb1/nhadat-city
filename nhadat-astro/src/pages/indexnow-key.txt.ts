import type { APIRoute } from 'astro';

// SSOT IndexNow verification token for NhaDat.City
const INDEXNOW_KEY = 'nhadat-city-indexnow-2026-auth-key';

export const GET: APIRoute = async () => {
  return new Response(INDEXNOW_KEY, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
