import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { and } from '@/lib/db/pgUtil';
import { cacheManager } from '@/lib/utils/cacheManager';

export const runtime = 'nodejs';
export const revalidate = 86400; // Cache 24 hours

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const district = searchParams.get('district');
    const province = searchParams.get('province');
    const propertyType = searchParams.get('propertyType');

    if (!district && !province) {
      return NextResponse.json({ success: false, error: 'district or province required' }, { status: 400 });
    }

    const cacheKey = `area_stats_${province || ''}_${district || ''}_${propertyType || ''}`;
    const cachedData = await cacheManager.getCache<any>(cacheKey);
    if (cachedData) {
      return NextResponse.json({ success: true, data: cachedData }, {
        headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' }
      });
    }

    const conds = [sql`status >= 1`, sql`area > 0`, sql`total_price > 0`];
    if (district) conds.push(sql`district_slug = ${district}`);
    else if (province) conds.push(sql`province_slug = ${province}`);
    if (propertyType) conds.push(sql`property_type = ${propertyType}`);
    const where = and(conds);

    const [statRows, distRows] = await Promise.all([
      sql`SELECT AVG(total_price / area) AS "avgPricePerM2",
                 MIN(total_price / area) AS "minPricePerM2",
                 MAX(total_price / area) AS "maxPricePerM2",
                 AVG(total_price) AS "avgTotalPrice",
                 AVG(area) AS "avgArea",
                 PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_price / area) AS "medianPricePerM2",
                 COUNT(*)::int AS count
          FROM real_estates WHERE ${where}`,
      // Price distribution (bucket boundaries 0/20M/50M/100M/200M/1B; >=1B -> last bin)
      sql`SELECT width_bucket((total_price / area)::float8,
                   ARRAY[0, 20000000, 50000000, 100000000, 200000000, 1000000000]::float8[]) AS bin,
                 COUNT(*)::int AS count
          FROM real_estates WHERE ${where}
          GROUP BY bin ORDER BY bin`,
    ]);

    const row = statRows[0];
    const result: any = row && row.count > 0
      ? { ...row }
      : { avgPricePerM2: 0, minPricePerM2: 0, maxPricePerM2: 0, avgTotalPrice: 0, avgArea: 0, count: 0 };
    for (const k of Object.keys(result)) if (result[k] !== null && k !== 'count') result[k] = Number(result[k]);
    if (result.medianPricePerM2 === null) delete result.medianPricePerM2;

    const binLabels = ['< 20 triệu', '20 - 50 triệu', '50 - 100 triệu', '100 - 200 triệu', '200 triệu - 1 tỷ', '> 1 tỷ'];
    const formattedDist = distRows
      .filter((d: any) => Number(d.bin) >= 1)
      .map((d: any) => ({
        label: binLabels[Math.min(Number(d.bin) - 1, binLabels.length - 1)],
        count: d.count,
      }));

    const responseData = { ...result, distribution: formattedDist, district, province };

    // Cache for 24 hours (86400 seconds)
    await cacheManager.setCache(cacheKey, responseData, 86400);

    return NextResponse.json(
      { success: true, data: responseData },
      { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' } }
    );
  } catch (error) {
    console.error('[API] area-stats error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
