import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';

// Sitemap Index – points to child sitemaps for better crawl budget management
// Cache for 6 hours
export const dynamic = 'force-dynamic';
export const revalidate = 21600;

export async function GET() {
  const baseUrl = 'https://nhadat.city';
  const now = new Date().toISOString();
  
  let totalPartitions = 1;
  try {
    const [{ n }] = await sql`
      SELECT COUNT(*)::int AS n FROM real_estates WHERE status >= 1 AND first_image IS NOT NULL`;
    const activeCount: number = n;
    totalPartitions = Math.max(1, Math.ceil(activeCount / 5000));
  } catch (err) {
    console.error('[sitemap.xml] Error calculating listing partition count:', err);
  }

  // Dynamically generate sitemap indexes for non-empty partitions (5k per sitemap)
  const listingSitemaps: string[] = [];
  for (let page = 1; page <= totalPartitions; page++) {
    listingSitemaps.push(`  <sitemap>
    <loc>${baseUrl}/sitemap-listings-${page}.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-static.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-admin-unit.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-blog.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-projects.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-quyhoach.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
${listingSitemaps.join('\n')}
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=21600, s-maxage=21600',
    },
  });
}
