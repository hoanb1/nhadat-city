import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { and, type Frag } from '@/lib/db/pgUtil';
import { cacheManager } from '@/lib/utils/cacheManager';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const province = searchParams.get('province');
    const ward = searchParams.get('ward');
    const loaiDatId = searchParams.get('loaiDatId');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const sw = searchParams.get('sw');
    const ne = searchParams.get('ne');
    
    // Check Redis cache first
    const cacheKey = `stats_${searchParams.toString()}`;
    const cachedData = await cacheManager.getCache(cacheKey);
    if (cachedData) {
      return NextResponse.json({ success: true, data: cachedData, cached: true });
    }
    
    // Build parameterized WHERE (PUBLIC_STATUS = 1)
    const conds: Frag[] = [sql`status >= 1`];
    if (sw && ne) {
      const [swLng, swLat] = sw.split(',').map(Number);
      const [neLng, neLat] = ne.split(',').map(Number);
      if (!isNaN(swLng) && !isNaN(neLat)) {
        conds.push(sql`geom && ST_MakeEnvelope(${swLng}, ${swLat}, ${neLng}, ${neLat}, 4326)`);
      }
    } else {
      if (province) conds.push(sql`province_slug = ${province}`);
      if (ward) conds.push(sql`ward_slug = ${ward}`);
    }

    if (loaiDatId) conds.push(sql`extra ->> 'loaiDatId' = ${loaiDatId}`);
    if (minPrice) conds.push(sql`total_price >= ${Number(minPrice)}`);
    if (maxPrice) conds.push(sql`total_price <= ${Number(maxPrice)}`);
    const where = and(conds);

    // ─── Pass 1: Tính phân phối priceM2 để phát hiện giá trị ngoại lai ─────────
    // Hard bounds: tuyệt đối loại bỏ các nhập liệu phi lý trước
    const HARD_MIN = 500_000;        // 500 nghìn/m² (đất rừng cực xa)
    const HARD_MAX = 500_000_000;    // 500 triệu/m² (trần Hoàn Kiếm)

    const price = sql`COALESCE(total_price, price)`;
    const priceM2 = sql`CASE WHEN area > 0 AND COALESCE(total_price, price) > 0
                        THEN COALESCE(total_price, price) / area END`;

    // Aggregations scan many rows: allow more than the pool-wide 10s statement_timeout.
    const out = await sql.begin(async (tx) => {
      await tx`SET LOCAL statement_timeout = 60000`;

      const dist = await tx`
        SELECT avg(p) AS mean, stddev_pop(p) AS std_dev, count(*)::int AS count
        FROM (SELECT ${priceM2} AS p FROM real_estates WHERE ${where}) s
        WHERE p >= ${HARD_MIN} AND p <= ${HARD_MAX}`;
      const distRow = dist[0];
      const ds = distRow && distRow.count > 0
        ? { mean: distRow.mean as number, stdDev: distRow.std_dev as number, count: distRow.count as number }
        : null;

      let dMin = HARD_MIN;
      let dMax = HARD_MAX;
      if (ds && ds.count >= 10) {
        // Phân phối giá BĐS lệch phải: mean - 2.5σ cho cận dưới, mean + 6σ cho cận trên
        dMin = Math.max(HARD_MIN, ds.mean - 2.5 * ds.stdDev);
        dMax = Math.min(HARD_MAX, ds.mean + 6 * ds.stdDev);
      }
      // Ngưỡng động áp dụng cho trends / overall / priceByType
      const valid = sql`pm2 >= ${dMin} AND pm2 <= ${dMax}`;

      const res = await Promise.all([
        tx`SELECT date_part('year', created_at AT TIME ZONE 'UTC')::int AS year,
                  date_part('month', created_at AT TIME ZONE 'UTC')::int AS month,
                  avg(pm2) AS avg_price_m2, count(*)::int AS count
           FROM (SELECT created_at, ${priceM2} AS pm2 FROM real_estates WHERE ${where}) p
           WHERE ${valid} GROUP BY 1, 2 ORDER BY 1, 2`,
        tx`SELECT avg(pm2) AS avg_price_m2, avg(tp) AS avg_price, count(*)::int AS total_listings
           FROM (SELECT ${priceM2} AS pm2, ${price} AS tp FROM real_estates WHERE ${where}) p
           WHERE ${valid}`,
        tx`SELECT property_type AS id, count(*)::int AS count FROM real_estates
           WHERE ${where} AND property_type IS NOT NULL AND property_type <> '' AND status >= 1
           GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
        tx`SELECT direction AS id, count(*)::int AS count FROM real_estates
           WHERE ${where} AND direction IS NOT NULL AND direction <> '' AND status >= 1
           GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
        tx`SELECT CASE WHEN p < 2000000000 THEN '< 2 Tỷ' WHEN p < 5000000000 THEN '2 - 5 Tỷ'
                       WHEN p < 10000000000 THEN '5 - 10 Tỷ' ELSE '> 10 Tỷ' END AS id, count(*)::int AS count
           FROM (SELECT ${price} AS p FROM real_estates WHERE ${where}) s WHERE p > 0 GROUP BY 1`,
        tx`SELECT COALESCE(listing_mode, 'ban') AS id, count(*)::int AS count FROM real_estates
           WHERE ${where} GROUP BY 1`,
        tx`SELECT CASE WHEN area < 30 THEN '< 30 m²' WHEN area < 50 THEN '30 - 50 m²'
                       WHEN area < 100 THEN '50 - 100 m²' WHEN area < 500 THEN '100 - 500 m²' ELSE '> 500 m²' END AS id,
                  count(*)::int AS count
           FROM real_estates WHERE ${where} AND area > 0 GROUP BY 1`,
        tx`SELECT CASE WHEN v < 3 THEN '< 3m (Ngõ nhỏ)' WHEN v < 5 THEN '3 - 5m'
                       WHEN v < 10 THEN '5 - 10m' ELSE '> 10m (Mặt tiền lớn)' END AS id, count(*)::int AS count
           FROM (SELECT CASE WHEN jsonb_typeof(f -> 'value') = 'number' THEN (f ->> 'value')::numeric END AS v
                 FROM real_estates, jsonb_array_elements(
                   CASE WHEN jsonb_typeof(dynamic_fields) = 'array' THEN dynamic_fields ELSE '[]'::jsonb END) f
                 WHERE ${where} AND f ->> '_id' = 'facade') s
           WHERE v > 0 GROUP BY 1`,
        // Price trend broken down by property type
        tx`SELECT year, month, property_type, avg(pm2) AS avg_price_m2, count(*)::int AS count
           FROM (SELECT date_part('year', created_at AT TIME ZONE 'UTC')::int AS year,
                        date_part('month', created_at AT TIME ZONE 'UTC')::int AS month,
                        property_type, ${priceM2} AS pm2
                 FROM real_estates WHERE ${where} AND property_type IS NOT NULL AND property_type <> '') p
           WHERE ${valid} GROUP BY year, month, property_type ORDER BY year, month, property_type LIMIT 300`,
      ]);
      return { res, ds, dMin, dMax };
    });

    const distStats = out.ds ? [out.ds] : [];
    const dynamicMin = out.dMin;
    const dynamicMax = out.dMax;
    const [trendRows, overallRows, propertyTypeRows, directionRows, priceSegmentsRows, listingModeRows, areaSegmentsRows, facadeSegmentsRows, priceByTypeRows] = out.res;

    // Normalise rows into the legacy ({_id, ...}) shapes consumed below
    const trends = trendRows.map((r) => ({ _id: { year: r.year, month: r.month }, avgPriceM2: r.avg_price_m2 as number, count: r.count as number }));
    const overall = overallRows[0] && overallRows[0].total_listings > 0
      ? [{ avgPriceM2: overallRows[0].avg_price_m2 as number, avgPrice: overallRows[0].avg_price as number, totalListings: overallRows[0].total_listings as number }]
      : [];
    const propertyTypes = propertyTypeRows.map((r) => ({ _id: r.id as string, count: r.count as number }));
    const directions = directionRows.map((r) => ({ _id: r.id as string, count: r.count as number }));
    const priceSegmentsData = priceSegmentsRows.map((r) => ({ _id: r.id as string, count: r.count as number }));
    const listingModesData = listingModeRows.map((r) => ({ _id: r.id as string, count: r.count as number }));
    const areaSegmentsData = areaSegmentsRows.map((r) => ({ _id: r.id as string, count: r.count as number }));
    const facadeSegmentsData = facadeSegmentsRows.map((r) => ({ _id: r.id as string, count: r.count as number }));
    const priceByTypeRaw = priceByTypeRows.map((r) => ({
      _id: { year: r.year as number, month: r.month as number, propertyType: r.property_type as string },
      avgPriceM2: r.avg_price_m2 as number,
    }));

    // Format segments to ensure correct ordering
    const segmentOrder = ["< 2 Tỷ", "2 - 5 Tỷ", "5 - 10 Tỷ", "> 10 Tỷ"];
    const priceSegments = segmentOrder.map(seg => {
      const found = priceSegmentsData.find(d => d._id === seg);
      return { name: seg, count: found ? found.count : 0 };
    });

    const areaOrder = ["< 30 m²", "30 - 50 m²", "50 - 100 m²", "100 - 500 m²", "> 500 m²"];
    const areaSegments = areaOrder.map(seg => {
      const found = areaSegmentsData.find(d => d._id === seg);
      return { name: seg, count: found ? found.count : 0 };
    });

    const facadeOrder = ["< 3m (Ngõ nhỏ)", "3 - 5m", "5 - 10m", "> 10m (Mặt tiền lớn)"];
    const facadeSegments = facadeOrder.map(seg => {
      const found = facadeSegmentsData.find(d => d._id === seg);
      return { name: seg, count: found ? found.count : 0 };
    });

    const listingModes = [
      { name: 'Bán', count: listingModesData.find(d => d._id === 'ban')?.count || 0 },
      { name: 'Cho thuê', count: (listingModesData.find(d => d._id === 'cho_thue')?.count || 0) + (listingModesData.find(d => d._id === 'thue')?.count || 0) }
    ];

    // Pivot priceByType into chart-friendly format: [{time, nha_pho: X, can_ho: Y, ...}]
    const TYPE_LABELS: Record<string,string> = {
      nha_pho: 'Nhà phố', can_ho: 'Căn hộ', dat_nen: 'Đất nền',
      biet_thu: 'Biệt thự', nha_mat_pho: 'Mặt phố', shophouse: 'Shophouse',
      phong_tro: 'Phòng trọ', van_phong: 'Văn phòng'
    };
    // Get top 5 types by count
    const topTypes = propertyTypes.slice(0, 5).map((p: any) => p._id || p.name);
    const priceByTypeMap: Record<string, Record<string, number>> = {};
    for (const row of priceByTypeRaw) {
      if (!topTypes.includes(row._id.propertyType)) continue;
      const key = `T${row._id.month}/${row._id.year}`;
      if (!priceByTypeMap[key]) priceByTypeMap[key] = { time: key as any };
      priceByTypeMap[key][row._id.propertyType] = Math.round(row.avgPriceM2 / 1000000);
    }
    const priceByType = Object.values(priceByTypeMap).sort((a: any, b: any) => {
      const [am, ay] = (a.time as string).slice(1).split('/').map(Number);
      const [bm, by] = (b.time as string).slice(1).split('/').map(Number);
      return ay !== by ? ay - by : am - bm;
    });

    const responseData = {
      trends: trends.map(t => ({
        time: `T${t._id.month}/${t._id.year}`,
        avgPriceM2: t.avgPriceM2,
        count: t.count
      })),
      overall: overall[0] || { avgPriceM2: 0, avgPrice: 0, totalListings: 0 },
      propertyTypes: propertyTypes.map((p: any) => ({ name: p._id, label: TYPE_LABELS[p._id] || p._id, count: p.count })),
      directions: directions.map((d: any) => ({ name: d._id, count: d.count })),
      priceSegments,
      areaSegments,
      facadeSegments,
      listingModes,
      priceByType,
      topTypes: topTypes.map((t: string) => ({ key: t, label: TYPE_LABELS[t] || t })),
      outlierInfo: {
        mean: distStats[0]?.mean || null,
        stdDev: distStats[0]?.stdDev || null,
        dynamicMin: Math.round(dynamicMin / 1_000_000 * 10) / 10,  // triệu/m²
        dynamicMax: Math.round(dynamicMax / 1_000_000 * 10) / 10,  // triệu/m²
        filteredCount: distStats[0]?.count || 0,
      }
    };

    // Cache cho 1 giờ (3600s)
    await cacheManager.setCache(cacheKey, responseData, 3600);

    return NextResponse.json({
      success: true,
      data: responseData
    });


  } catch (error) {
    console.error('Stats API Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
