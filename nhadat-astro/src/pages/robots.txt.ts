import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = site ? site.toString().replace(/\/$/, '') : 'https://nhadat.city';

  const robots = `# NhaDat.City SSOT robots.txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/

# Search Index Sitemaps
Sitemap: ${siteUrl}/sitemap.xml
Sitemap: ${siteUrl}/sitemap-static.xml
Sitemap: ${siteUrl}/sitemap-gia-dat.xml
Sitemap: ${siteUrl}/sitemap-quy-hoach.xml
Sitemap: ${siteUrl}/sitemap-sap-nhap.xml
Sitemap: ${siteUrl}/sitemap-projects.xml
Sitemap: ${siteUrl}/sitemap-articles.xml
`;

  return new Response(robots, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
