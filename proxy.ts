import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignore static assets, next internal routes, and api routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/map-api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split('/').filter(Boolean);

  // Case 1: 5-segment legacy URL (e.g., /ho-chi-minh/7/tan-phong/FyxMWeS4APZFfzRPS/slug)
  // Format: /:province/:district/:ward/:id/:slug
  if (segments.length === 5) {
    const idCandidate = segments[3];
    // Check if 4th segment is an ID (shortId 6-7 chars, or Meteor ObjectID 17-24 chars)
    if (/^[A-Za-z0-9_-]{6,24}$/.test(idCandidate)) {
      const province = segments[0];
      const ward = segments[2];
      const id = segments[3];
      const slug = segments[4];
      const targetUrl = new URL(`/${province}/${ward}/${id}/${slug}`, request.url);
      return NextResponse.redirect(targetUrl, 308);
    }
  }

  // Case 2: 3-segment legacy URL missing ward (e.g., /ha-noi/AumBqS/slug)
  // Format: /:province/:id/:slug
  if (segments.length === 3) {
    const idCandidate = segments[1];
    // Ward slugs are lowercase with hyphens (e.g. thanh-khe).
    // IDs contain uppercase/digits or fixed length without hyphens.
    const isId =
      /^[A-Za-z0-9]{6,24}$/.test(idCandidate) &&
      (/[A-Z0-9]/.test(idCandidate) || [6, 7, 17, 24].includes(idCandidate.length));

    if (isId) {
      const province = segments[0];
      const id = segments[1];
      const slug = segments[2];
      const targetUrl = new URL(`/${province}/all/${id}/${slug}`, request.url);
      return NextResponse.redirect(targetUrl, 308);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
