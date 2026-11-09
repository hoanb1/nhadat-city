import { MetadataRoute } from 'next';
import { headers } from 'next/headers';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers();
  const host = headersList.get('host') || '';

  // Chặn hoàn toàn lập chỉ mục cho các subdomain API nội bộ
  if (host.includes('api.nhadat.city') || host.includes('map-api.nhadat.city')) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/api/admin/',
          '/api/auth/',
          '/api/analytics/',
          '/api/ml/',
          '/admin/',
          '/manage-listings/',
          '/login/',
          '/forum/',
          '/search',
          '/*?q=*',
          '/*search*',
        ],
      },
      {
        userAgent: [
          'SemrushBot',
          'PetalBot',
          'AhrefsBot',
          'MJ12bot',
          'Baiduspider',
          'ClaudeBot',
          'GPTBot',
          'Amazonbot',
          'DotBot',
        ],
        disallow: '/',
      },
    ],
    sitemap: [
      'https://nhadat.city/sitemap.xml',
      'https://nhadat.city/sitemap-admin-unit.xml',
      'https://nhadat.city/sitemap-blog.xml',
      'https://nhadat.city/sitemap-static.xml',
      'https://nhadat.city/sitemap-projects.xml',
      'https://nhadat.city/sitemap-quyhoach.xml',
    ],
  };
}
