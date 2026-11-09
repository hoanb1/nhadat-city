import { sql } from '@/lib/db/pg';

export const dynamic = 'force-dynamic';

export async function GET() {
  const baseUrl = 'https://nhadat.city';
  const today = new Date().toISOString().split('T')[0];

  try {
    const dateThreshold = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const [{ n }] = await sql`
      SELECT COUNT(*)::int AS n FROM real_estates
      WHERE status >= 1 AND first_image IS NOT NULL
        AND (updated_at >= ${dateThreshold} OR created_at >= ${dateThreshold})`;
    let totalRecords: number = n;
    const recordsPerSitemap = 500;
    
    // Fallback: If 0 matching, default to 5000 listings (10 sitemaps) so search console links don't break
    if (totalRecords === 0) {
      totalRecords = 5000;
    }

    const totalSitemaps = Math.ceil(totalRecords / recordsPerSitemap);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    
    xml += `  <sitemap>\n`;
    xml += `    <loc>${baseUrl}/sitemap-static.xml</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `  </sitemap>\n`;

    xml += `  <sitemap>\n`;
    xml += `    <loc>${baseUrl}/sitemap-admin-unit.xml</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `  </sitemap>\n`;

    for (let i = 1; i <= totalSitemaps; i++) {
      xml += `  <sitemap>\n`;
      xml += `    <loc>${baseUrl}/sitemap-real-estate-${i}.xml</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `  </sitemap>\n`;
    }

    xml += `</sitemapindex>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (error) {
    console.error('Error generating sitemap index:', error);
    return new Response('Error generating sitemap index', { status: 500 });
  }
}
