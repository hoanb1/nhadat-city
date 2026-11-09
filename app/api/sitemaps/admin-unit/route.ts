import { sql } from '@/lib/db/pg';
import { escapeXml } from '@/lib/utils/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const baseUrl = 'https://nhadat.city';
  const mapApiCommuneUrl = process.env.NEXT_PUBLIC_MAP_API_COMMUNE_URL || 'https://map-api.nhadat.city/map-api/commune';

  try {
    // Load provinces and wards (shape kept as Mongo CodeName/Name)
    const provinces = (await sql`SELECT slug, name FROM provinces_2025 ORDER BY id`)
      .map((r) => ({ CodeName: r.slug as string, Name: r.name as string }));
    const allWards = (await sql`SELECT province_slug, slug, name FROM wards_2025 ORDER BY id`)
      .map((r) => ({ ProvinceCodeName: r.province_slug as string, CodeName: r.slug as string, Name: r.name as string }));

    // Group wards by province
    const wardsByProvince = new Map<string, any[]>();
    for (const ward of allWards) {
      const prov = ward.ProvinceCodeName;
      if (prov) {
        if (!wardsByProvince.has(prov)) {
          wardsByProvince.set(prov, []);
        }
        wardsByProvince.get(prov)!.push(ward);
      }
    }

    // Get active listing counts grouped by province and ward
    const counts = (await sql`
      SELECT province_slug AS province, ward_slug AS ward, COUNT(*)::int AS count
      FROM real_estates
      WHERE status >= 1 AND first_image IS NOT NULL
      GROUP BY province_slug, ward_slug`)
      .map((r) => ({ _id: { province: r.province, ward: r.ward }, count: r.count as number }));

    const provinceCounts = new Map<string, number>();
    const wardCounts = new Map<string, Map<string, number>>();

    for (const item of counts) {
      const prov = item._id.province;
      const ward = item._id.ward;
      const count = item.count;

      if (prov) {
        provinceCounts.set(prov, (provinceCounts.get(prov) || 0) + count);
        
        if (ward) {
          if (!wardCounts.has(prov)) {
            wardCounts.set(prov, new Map<string, number>());
          }
          wardCounts.get(prov)!.set(ward, count);
        }
      }
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

    for (const province of provinces) {
      const totalProvinceProperties = provinceCounts.get(province.CodeName) || 0;

      // Filter: only show provinces with at least 3 active properties
      if (totalProvinceProperties < 3) continue;

      const provinceLoc = `${baseUrl}/${province.CodeName}`;
      const provinceChartLoc = `${baseUrl}/thong-ke/${province.CodeName}`;
      const provinceImage = `${mapApiCommuneUrl}/${province.CodeName}.webp`;

      xml += `  <url>\n`;
      xml += `    <loc>${escapeXml(provinceLoc)}</loc>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>0.9</priority>\n`;
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${escapeXml(provinceImage)}</image:loc>\n`;
      xml += `      <image:title>${escapeXml(`Bản đồ tỉnh ${province.Name}`)}</image:title>\n`;
      xml += `    </image:image>\n`;
      xml += `  </url>\n`;

      xml += `  <url>\n`;
      xml += `    <loc>${escapeXml(provinceChartLoc)}</loc>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;

      const wards = wardsByProvince.get(province.CodeName) || [];
      const wardCountMap = wardCounts.get(province.CodeName);

      for (const ward of wards) {
        const count = wardCountMap ? (wardCountMap.get(ward.CodeName) || 0) : 0;
        
        // Filter: only show wards with at least 3 active properties
        if (count < 3) continue;

        const wardLoc = `${baseUrl}/${province.CodeName}/${ward.CodeName}`;
        const wardImage = `${mapApiCommuneUrl}/${province.CodeName}/${ward.CodeName}.webp`;

        xml += `  <url>\n`;
        xml += `    <loc>${escapeXml(wardLoc)}</loc>\n`;
        xml += `    <changefreq>daily</changefreq>\n`;
        xml += `    <priority>0.8</priority>\n`;
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${escapeXml(wardImage)}</image:loc>\n`;
        xml += `      <image:title>${escapeXml(`Bản đồ xã ${ward.Name}, ${province.Name}`)}</image:title>\n`;
        xml += `    </image:image>\n`;
        xml += `  </url>\n`;
      }
    }

    xml += `</urlset>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (error) {
    console.error('Error generating admin unit sitemap:', error);
    return new Response('Error generating admin unit sitemap', { status: 500 });
  }
}
