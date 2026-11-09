import { sql } from './pg';
import { and, polygonCond, type Doc, type Frag } from './pgUtil';

export interface StatsMatchStage {
  status?: any;
  'adminunit.province'?: string;
  'adminunit.ward'?: string;
  'adminunit.district'?: string;
  loaiDatId?: string;
  totalPrice?: any;
  coordinates?: any;
  [key: string]: any;
}

const statsCache = new Map<string, { data: any; expiresAt: number }>();
const STATS_CACHE_TTL_MS = 15 * 60 * 1000;

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Translate the (Mongo-style) match stage callers pass into parameterized SQL conditions. */
function buildWhere(m: StatsMatchStage): Frag {
  const c: Frag[] = [];
  for (const [key, val] of Object.entries(m || {})) {
    if (val === undefined || val === null) continue;
    switch (key) {
      case 'status':
        if (num(val)) c.push(sql`status = ${val}`);
        else {
          if (num(val.$gte)) c.push(sql`status >= ${val.$gte}`);
          if (num(val.$gt)) c.push(sql`status > ${val.$gt}`);
          if (num(val.$lte)) c.push(sql`status <= ${val.$lte}`);
          if (num(val.$ne)) c.push(sql`status <> ${val.$ne}`);
          if (Array.isArray(val.$in)) c.push(sql`status IN ${sql(val.$in.filter(num))}`);
        }
        break;
      case 'adminunit.province': c.push(sql`province_slug = ${String(val)}`); break;
      case 'adminunit.district': c.push(sql`district_slug = ${String(val)}`); break;
      case 'adminunit.ward': c.push(sql`ward_slug = ${String(val)}`); break;
      case 'propertyType': c.push(sql`property_type = ${String(val)}`); break;
      case 'direction': c.push(sql`direction = ${String(val)}`); break;
      case 'totalPrice':
        if (num(val)) c.push(sql`total_price = ${val}`);
        else {
          if (num(val.$gte)) c.push(sql`total_price >= ${val.$gte}`);
          if (num(val.$lte)) c.push(sql`total_price <= ${val.$lte}`);
        }
        break;
      case 'coordinates': {
        const g = val?.$geoWithin?.$geometry;
        const cond = polygonCond(g);
        if (cond) c.push(cond);
        break;
      }
      default:
        // Unknown keys (e.g. loaiDatId) live in the extra jsonb.
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
          c.push(sql`extra ->> ${key} = ${String(val)}`);
        }
    }
  }
  return and(c);
}

export async function fetchStatistics(matchStage: StatsMatchStage) {
  const cacheKey = JSON.stringify(matchStage || {});
  const cached = statsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const where = buildWhere(matchStage);
  const price = sql`COALESCE(total_price, price)`;
  const priceM2 = sql`CASE WHEN area > 0 AND COALESCE(total_price, price) IS NOT NULL
                      THEN COALESCE(total_price, price) / area END`;

  // Aggregations scan up to ~1M rows: allow more than the pool-wide 10s statement_timeout.
  const [trends, overall, propertyTypes, directions, priceSegmentsData, listingModesData, areaSegmentsData, facadeSegmentsData] =
    await sql.begin(async (tx) => {
      await tx`SET LOCAL statement_timeout = 60000`;
      return Promise.all([
        tx`SELECT date_part('year', created_at AT TIME ZONE 'UTC')::int AS year,
                  date_part('month', created_at AT TIME ZONE 'UTC')::int AS month,
                  avg(${priceM2}) AS avg_price_m2, count(*)::int AS count
           FROM real_estates WHERE ${where} AND ${priceM2} IS NOT NULL
           GROUP BY 1, 2 ORDER BY 1, 2`,
        tx`SELECT avg(${priceM2}) AS avg_price_m2, avg(${price}) AS avg_price, count(*)::int AS total_listings
           FROM real_estates WHERE ${where}`,
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
      ]);
    });

  const find = (rows: Doc[], id: string) => rows.find((d) => d.id === id);

  const segmentOrder = ['< 2 Tỷ', '2 - 5 Tỷ', '5 - 10 Tỷ', '> 10 Tỷ'];
  const priceSegments = segmentOrder.map((seg) => ({ name: seg, count: find(priceSegmentsData, seg)?.count ?? 0 }));

  const areaOrder = ['< 30 m²', '30 - 50 m²', '50 - 100 m²', '100 - 500 m²', '> 500 m²'];
  const areaSegments = areaOrder.map((seg) => ({ name: seg, count: find(areaSegmentsData, seg)?.count ?? 0 }));

  const facadeOrder = ['< 3m (Ngõ nhỏ)', '3 - 5m', '5 - 10m', '> 10m (Mặt tiền lớn)'];
  const facadeSegments = facadeOrder.map((seg) => ({ name: seg, count: find(facadeSegmentsData, seg)?.count ?? 0 }));

  // Mongo code counted 'cho_thue'; the PG schema documents 'thue' -> accept both.
  const listingModes = [
    { name: 'Bán', count: find(listingModesData, 'ban')?.count || 0 },
    { name: 'Cho thuê', count: (find(listingModesData, 'cho_thue')?.count || 0) + (find(listingModesData, 'thue')?.count || 0) },
  ];

  const o = overall[0];
  const result = {
    trends: trends.map((t) => ({
      time: `T${t.month}/${t.year}`,
      avgPriceM2: t.avg_price_m2 as number,
      count: t.count as number,
    })),
    overall: o && o.total_listings > 0
      ? { avgPriceM2: o.avg_price_m2, avgPrice: o.avg_price, totalListings: o.total_listings }
      : { avgPriceM2: 0, avgPrice: 0, totalListings: 0 },
    propertyTypes: propertyTypes.map((p) => ({ name: p.id, count: p.count })),
    directions: directions.map((d) => ({ name: d.id, count: d.count })),
    priceSegments,
    areaSegments,
    facadeSegments,
    listingModes,
  };

  statsCache.set(cacheKey, { data: result, expiresAt: Date.now() + STATS_CACHE_TTL_MS });
  return result;
}
