import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { mapRealEstateRow } from '@/lib/db/realEstate';
import { escapeXml, getRealEstateUrl } from '@/lib/utils/utils';

// Cache for 4 hours
export const revalidate = 14400;

const BASE_URL = 'https://nhadat.city';
const ITEMS_PER_SITEMAP = 5000; // Small 5k chunks to fit under Varnish reverse proxy memory transient allocation limits

export async function GET(request: Request, context: any) {
  try {
    const params = await context.params;
    const page = params?.page;
    const pageNum = parseInt(page) || 1;
    
    const skip = (pageNum - 1) * ITEMS_PER_SITEMAP;

    // Fixed 5,000-row chunks; deterministic order (created_at DESC, id DESC) matches detail page requirements
    const rows = await sql`
      SELECT id, mongo_id, short_id, province_slug, district_slug, ward_slug, title, updated_at, created_at
      FROM real_estates
      WHERE status >= 1 AND first_image IS NOT NULL
      ORDER BY created_at DESC, id DESC
      OFFSET ${Math.max(0, skip)} LIMIT ${ITEMS_PER_SITEMAP}`;
    const items = rows.map(mapRealEstateRow);

    const entries = items
      .filter((item) => item.adminunit?.province && item.title)
      .map((item) => {
        const canonicalPath = getRealEstateUrl(item);
        const url = escapeXml(`${BASE_URL}${canonicalPath}`);
        const lastmod = (item.updatedAt || item.createdAt || new Date())
          .toISOString()
          .split('T')[0];
        return `  <url>\n    <loc>${url}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
      });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=14400, s-maxage=14400',
      },
    });
  } catch (error) {
    console.error(`[sitemap-listings] Error generating sitemap page:`, error);
    return new NextResponse('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', {
      status: 500,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    });
  }
}
