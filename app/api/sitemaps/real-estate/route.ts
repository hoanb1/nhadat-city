import { NextRequest } from 'next/server';
import { sql } from '@/lib/db/pg';
import { mapRealEstateRow } from '@/lib/db/realEstate';
import { getImageUrl, makeUrlSlug, cleanAndShortenText, escapeXml } from '@/lib/utils/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const baseUrl = 'https://nhadat.city';
  const today = new Date().toISOString().split('T')[0];

  const url = new URL(request.url);
  let idParam = url.searchParams.get('id');
  
  // Fallback: extract page number from rewritten pathname if present (e.g., /sitemap-real-estate-2.xml)
  if (!idParam) {
    const match = url.pathname.match(/sitemap-real-estate-(\d+)\.xml/);
    if (match) {
      idParam = match[1];
    }
  }

  const page = parseInt(idParam || '1', 10);
  
  if (isNaN(page) || page < 1) {
    return new Response('Invalid sitemap page number', { status: 400 });
  }

  const limit = 500;
  const skip = (page - 1) * limit;

  try {
    const dateThreshold = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const recent = sql`status >= 1 AND first_image IS NOT NULL
      AND (updated_at >= ${dateThreshold} OR created_at >= ${dateThreshold})`;
    const all = sql`status >= 1 AND first_image IS NOT NULL`;

    // Check if there are matches. If not, use fallback (all active listings with images)
    const [{ ok }] = await sql`SELECT EXISTS (SELECT 1 FROM real_estates WHERE ${recent}) AS ok`;
    const where = ok ? recent : all;

    // Deterministic order: created_at DESC, id DESC (stable paging)
    const rows = await sql`
      SELECT id, mongo_id, short_id, province_slug, ward_slug, title, updated_at, created_at, images[1:5] AS images
      FROM real_estates WHERE ${where}
      ORDER BY created_at DESC, id DESC
      OFFSET ${skip} LIMIT ${limit}`;
    const items = rows.map(mapRealEstateRow);

    if (items.length === 0 && page > 1) {
      return new Response('Sitemap page not found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      });
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

    for (const item of items) {
      const province = item.adminunit?.province || 'ha-noi';
      const ward = item.adminunit?.ward || '';
      const idToUse = item.shortId || item._id;
      const slug = makeUrlSlug(item.title || '');
      
      let loc = `${baseUrl}/${province}`;
      if (ward) {
        loc += `/${ward}`;
      }
      loc += `/${idToUse}/${slug}`;

      let lastmodDate = item.updatedAt || item.createdAt || new Date();
      if (!(lastmodDate instanceof Date)) {
        lastmodDate = new Date(lastmodDate);
      }
      const lastmod = isNaN(lastmodDate.getTime()) ? today : lastmodDate.toISOString().split('T')[0];

      xml += `  <url>\n`;
      xml += `    <loc>${escapeXml(loc)}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.7</priority>\n`;

      const images = item.images || [];
      if (Array.isArray(images) && images.length > 0) {
        // Limit to top 5 images per listing to prevent bloated sitemaps
        for (const imgId of images.slice(0, 5)) {
          if (typeof imgId === 'string' && imgId.trim()) {
            const imgUrl = getImageUrl(imgId, item._id.toString());
            const cleanTitle = cleanAndShortenText(item.title || '', 100);
            xml += `    <image:image>\n`;
            xml += `      <image:loc>${escapeXml(imgUrl)}</image:loc>\n`;
            xml += `      <image:caption>${escapeXml(cleanTitle)}</image:caption>\n`;
            xml += `    </image:image>\n`;
          }
        }
      }

      xml += `  </url>\n`;
    }

    xml += `</urlset>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (error) {
    console.error(`Error generating sitemap real estate page ${page}:`, error);
    return new Response(`Error generating sitemap real estate page ${page}`, { status: 500 });
  }
}
