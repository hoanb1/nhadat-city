import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache for 1 hour

const BASE_URL = 'https://nhadat.city';

function escapeXml(str: string): string {
  if (!str) return '';
  return str.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function buildXmlEntry(url: string, lastmod: string, changefreq: string, priority: string) {
  return `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export async function GET() {
  const now = new Date().toISOString().split('T')[0];
  const entries: string[] = [];

  // Main Blog Hub URL
  entries.push(buildXmlEntry(`${BASE_URL}/blog`, now, 'daily', '1.0'));

  try {
    const blogs = await sql`
      SELECT slug, updated_at AS "updatedAt" FROM blog_posts
      WHERE status = 'published' AND slug IS NOT NULL AND slug NOT IN ('null', '')
      ORDER BY updated_at DESC NULLS LAST, id`;

    for (const b of blogs) {
      if (!b.slug || b.slug === 'null') continue;
      const lastmod = b.updatedAt ? new Date(b.updatedAt).toISOString().split('T')[0] : now;
      entries.push(buildXmlEntry(`${BASE_URL}/blog/${b.slug}`, lastmod, 'weekly', '0.9'));
    }
  } catch (err) {
    console.error('[Sitemap Blog Error]:', err);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
