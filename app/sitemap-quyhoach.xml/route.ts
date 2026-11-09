import { NextResponse } from 'next/server';
import { PROVINCES } from '@/lib/utils/province';
import { sql } from '@/lib/db/pg';

export const dynamic = 'force-dynamic';
export const revalidate = 86400; // Cache for 24h

const BASE_URL = 'https://nhadat.city';
const MAP_CDN  = 'https://nhadat.city'; // Same-origin for Open Graph map thumbnails

function escapeXml(str: string): string {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Build a <url> entry with optional image:image extension.
 * Image extension helps nhadat.city rank in Google Images for "bản đồ quy hoạch [tỉnh]".
 * Inspired by cotuong.xyz/server/routes/sitemap.mjs image extension pattern.
 */
function buildXmlEntry(
  url: string,
  lastmod: string,
  changefreq: string,
  priority: string,
  imageUrl?: string,
  imageTitle?: string,
) {
  const imgBlock = imageUrl ? `
    <image:image>
      <image:loc>${escapeXml(imageUrl)}</image:loc>
      <image:title><![CDATA[${imageTitle || url}]]></image:title>
    </image:image>` : '';

  return `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${imgBlock}
  </url>`;
}

export async function GET() {
  const now = new Date().toISOString().split('T')[0];
  const entries: string[] = [];

  // Quy hoạch index page
  entries.push(buildXmlEntry(
    `${BASE_URL}/quy-hoach`,
    now,
    'weekly',
    '0.9',
    `${MAP_CDN}/og-quy-hoach.jpg`,
    'Bản đồ quy hoạch sử dụng đất toàn quốc 2024-2025 — NhaDat.City',
  ));

  // Province-level quy hoạch pages — with image thumbnail per province
  for (const [slug, info] of Object.entries(PROVINCES)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const provinceName = typeof info === 'object' && info !== null ? (info as any).name || slug : slug;
    entries.push(buildXmlEntry(
      `${BASE_URL}/quy-hoach/${slug}`,
      now,
      'weekly',
      '0.8',
      `${MAP_CDN}/og-quy-hoach-${slug}.jpg`,
      `Bản đồ quy hoạch ${provinceName} 2024-2025 — NhaDat.City`,
    ));
  }

  // District-level quy hoạch pages (~700 districts)
  try {
    const rows = await sql`
      SELECT province_code_name, code_name, name, province_name FROM districts ORDER BY id`;
    const districts = rows.map((r) => ({
      ProvinceCodeName: r.province_code_name as string | null,
      CodeName: r.code_name as string | null,
      Name: r.name as string | null,
      ProvinceName: r.province_name as string | null,
    }));

    for (const d of districts) {
      if (d.ProvinceCodeName && d.CodeName) {
        const districtName = d.Name || d.CodeName;
        const provinceName = d.ProvinceName || d.ProvinceCodeName;
        entries.push(buildXmlEntry(
          `${BASE_URL}/quy-hoach/${d.ProvinceCodeName}/${d.CodeName}`,
          now,
          'monthly',
          '0.7',
          `${MAP_CDN}/og-quy-hoach-${d.ProvinceCodeName}.jpg`,
          `Bản đồ quy hoạch ${districtName}, ${provinceName} — NhaDat.City`,
        ));
      }
    }
  } catch (error) {
    console.error('[sitemap-quyhoach] Error fetching districts:', error);
  }

  // XML sitemap with image namespace declaration
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}

