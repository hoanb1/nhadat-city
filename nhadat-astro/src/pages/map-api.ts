import type { APIRoute } from 'astro';

const RUST_API_URL = process.env.RUST_API_URL || 'http://127.0.0.1:3005';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const targetUrl = `${RUST_API_URL}/map-api${url.search}`;

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: { Accept: 'image/png,image/*,*/*' },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return new Response(null, { status: response.status });
    }

    const buffer = await response.arrayBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      },
    });
  } catch (_err: any) {
    return new Response(null, { status: 502 });
  }
};
