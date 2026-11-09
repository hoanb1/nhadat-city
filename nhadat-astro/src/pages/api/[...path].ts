import type { APIRoute } from 'astro';

const RUST_API_URL = process.env.RUST_API_URL || 'http://127.0.0.1:3005';

export const ALL: APIRoute = async ({ request, params }) => {
  const path = params.path || '';
  const url = new URL(request.url);
  const targetUrl = `${RUST_API_URL}/api/${path}${url.search}`;
  const isTileRequest = path.startsWith('v1/tiles/');

  try {
    const fetchOptions: RequestInit = {
      method: request.method,
      headers: {
        'Accept': isTileRequest ? 'image/png,image/*,*/*' : 'application/json',
        ...(request.headers.get('content-type')
          ? { 'Content-Type': request.headers.get('content-type')! }
          : {}),
      },
      signal: AbortSignal.timeout(8000),
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      fetchOptions.body = await request.text();
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type') || (isTileRequest ? 'image/png' : 'application/json; charset=utf-8');

    if (contentType.startsWith('image/')) {
      const buffer = await response.arrayBuffer();
      return new Response(buffer, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400, s-maxage=604800',
        },
      });
    }

    const body = await response.text();
    const isVolatile = path.includes('search') || path.includes('merger/lookup');
    const cacheControl = isVolatile
      ? 'public, max-age=5, s-maxage=10'
      : 'public, max-age=60, s-maxage=300';

    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': cacheControl,
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: 'Rust Core Backend Service Unavailable',
        message: err.message || 'Connection timeout or offline',
        status: 503,
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }
};

