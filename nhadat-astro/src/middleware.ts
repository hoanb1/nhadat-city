import { defineMiddleware } from 'astro:middleware';
import { PROVINCE_MAP, LEGACY_PROVINCE_MAP } from './lib/constants/provinces';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // 1. Intercept /bds and /bds/* to /du-an
  if (pathname === '/bds' || pathname.startsWith('/bds/')) {
    return context.redirect('/du-an', 301);
  }

  // 2. Intercept legacy classifieds routes to 301 Permanent Redirect
  if (pathname === '/mua-ban' || pathname.startsWith('/mua-ban/')) {
    return context.redirect('/gia-dat', 301);
  }

  if (pathname === '/cho-thue' || pathname.startsWith('/cho-thue/')) {
    return context.redirect('/gia-dat', 301);
  }

  if (pathname === '/realestate' || pathname.startsWith('/realestate/')) {
    return context.redirect('/gia-dat', 301);
  }

  const segments = pathname.split('/').filter(Boolean);

  // Top-level pillar routes, system assets and sitemaps that should NEVER be redirected
  const reservedPrefixes = new Set([
    'gia-dat',
    'quy-hoach',
    'sap-nhap-hanh-chinh',
    'cong-cu',
    'du-an',
    'phap-ly',
    'ma-loai-dat',
    'api',
    '_astro',
    'favicon.svg',
    'favicon.ico',
    'robots.txt',
    'indexnow-key.txt',
  ]);

  const isReserved = (seg: string) =>
    reservedPrefixes.has(seg) ||
    seg.startsWith('sitemap') ||
    seg.includes('.');

  if (segments.length > 0 && !isReserved(segments[0])) {
    const first = segments[0];
    const targetSlug =
      LEGACY_PROVINCE_MAP[first]?.new_province_slug ||
      PROVINCE_MAP[first]?.slug;

    if (targetSlug) {
      // 1-segment: /[province] (e.g. /ha-noi, /ha-nam, /tp-ho-chi-minh, /binh-duong) -> /gia-dat/${targetProvinceSlug}
      if (segments.length === 1) {
        return context.redirect(`/gia-dat/${targetSlug}`, 301);
      }

      // 2-segment legacy district: /[province]/[district] -> /gia-dat/${targetProvinceSlug}
      if (segments.length === 2) {
        return context.redirect(`/gia-dat/${targetSlug}`, 301);
      }

      // 3+ segments: /[province]/[ward]/[id]/[slug] -> /gia-dat/${targetProvinceSlug}/${ward}
      if (segments.length >= 3) {
        const ward = segments[1];
        return context.redirect(`/gia-dat/${targetSlug}/${ward}`, 301);
      }
    } else if (segments.length >= 3) {
      // Fallback for non-province 3+ segments
      const province = segments[0];
      const ward = segments[1];
      return context.redirect(`/gia-dat/${province}/${ward}`, 301);
    }
  }

  const response = await next();

  // Attach high-performance SEO Cache-Control headers
  if (response.status === 200) {
    if (pathname.startsWith('/api/')) {
      response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    } else {
      response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
    }
  }

  return response;
});
