import type { APIRoute } from 'astro';
import { getSitemapData } from '../lib/api';

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = site ? site.toString().replace(/\/$/, '') : 'https://nhadat.city';
  const now = new Date().toISOString();
  const sitemapData = await getSitemapData();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapData.articles
  .map((a: any) => {
    const slug = typeof a === 'string' ? a : a.slug;
    const lastmod = typeof a === 'object' && (a.updated_at || a.published_at) ? (a.updated_at || a.published_at) : now;
    return `  <url>
    <loc>${siteUrl}/phap-ly/${slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  })
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
