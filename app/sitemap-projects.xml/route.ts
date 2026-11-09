import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { makeUrlSlug } from '@/lib/utils/utils';

// Cache for 12 hours
export const revalidate = 43200;

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

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, mongo_id, short_id, title, updated_at, created_at FROM projects
      WHERE title IS NOT NULL AND title <> ''
      ORDER BY created_at DESC, id DESC
      LIMIT 5000`;
    const projects = rows.map((r) => ({
      _id: r.mongo_id ?? String(r.id),
      shortId: r.short_id as string | null,
      title: r.title as string,
      updatedAt: r.updated_at as Date | null,
      createdAt: r.created_at as Date | null,
    }));

    const entries = projects
      .filter((p) => p.title)
      .map((project) => {
        const idToUse = project.shortId || project._id.toString();
        const slug = makeUrlSlug(project.title);
        const url = escapeXml(`${BASE_URL}/du-an/${idToUse}/${slug}`);
        const lastmod = (project.updatedAt || project.createdAt || new Date())
          .toISOString()
          .split('T')[0];
        return `  <url>\n    <loc>${url}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>`;
      });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=43200, s-maxage=43200',
      },
    });
  } catch (error) {
    console.error('[sitemap-projects] Error generating sitemap:', error);
    return new NextResponse('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', {
      status: 500,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    });
  }
}
