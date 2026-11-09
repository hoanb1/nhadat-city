import { NextResponse } from 'next/server';
import { escapeXml } from '@/lib/utils/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const baseUrl = 'https://nhadat.city';
  const today = new Date().toISOString().split('T')[0];

  const staticUrls = [
    { loc: `${baseUrl}`, lastmod: today, changefreq: 'daily', priority: '1.0' },
    { loc: `${baseUrl}/thong-ke`, lastmod: today, changefreq: 'daily', priority: '0.9' },
    { loc: `${baseUrl}/about`, lastmod: today, changefreq: 'monthly', priority: '0.7' },
    { loc: `${baseUrl}/contact`, lastmod: today, changefreq: 'monthly', priority: '0.7' },
    { loc: `${baseUrl}/terms`, lastmod: today, changefreq: 'yearly', priority: '0.5' },
    { loc: `${baseUrl}/privacy`, lastmod: today, changefreq: 'yearly', priority: '0.5' },
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  for (const url of staticUrls) {
    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(url.loc)}</loc>\n`;
    xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
    xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
    xml += `    <priority>${url.priority}</priority>\n`;
    xml += `  </url>\n`;
  }
  xml += `</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
