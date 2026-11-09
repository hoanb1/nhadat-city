import { sql } from './pg';
import { and, escapeLike, polygonCond, put, type Doc, type Frag } from './pgUtil';
import { mapProjectRow } from './project';

export interface RealEstateFilters {
  province?: string;
  district?: string;
  ward?: string;
  totalPriceRange?: [number | null, number | null];
  pricePerM2Range?: [number | null, number | null];
  areaRange?: [number | null, number | null];
  propertyType?: string[];
  direction?: string[];
  dateRange?: number | 'all';
  showClassifieds?: boolean;
}

export interface GeoPolygon {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][];
}

const PUBLIC_STATUS = 1; // Meteor publicStatus constant

// ---------------------------------------------------------------------------
// Row -> Mongo-shaped document mappers
// ---------------------------------------------------------------------------

/**
 * Map a real_estates row (any subset of columns) to the legacy Mongo document shape.
 * `extra` jsonb is spread first so typed columns always win.
 */
export function mapRealEstateRow(r: Doc): Doc & { _id: any } {
  const d: Doc & { _id: any } = r.extra && typeof r.extra === 'object' ? { _id: null, ...r.extra } : { _id: null };
  if (r.id !== undefined || r.mongo_id !== undefined) {
    d._id = r.mongo_id ?? String(r.id);
  }
  put(d, 'shortId', r.short_id);
  put(d, 'slug', r.slug);
  put(d, 'status', r.status);
  put(d, 'listingMode', r.listing_mode);
  put(d, 'propertyType', r.property_type);
  put(d, 'title', r.title);
  put(d, 'description', r.description);
  put(d, 'area', r.area);
  put(d, 'price', r.price);
  put(d, 'totalPrice', r.total_price);
  put(d, 'pricePerM2', r.price_per_m2);
  put(d, 'legalDocs', r.legal_docs);
  put(d, 'direction', r.direction);
  put(d, 'address', r.address);
  put(d, 'thumbnailUrl', r.thumbnail_url);
  put(d, 'images', r.images);
  put(d, 'contact', r.contact);
  put(d, 'userType', r.user_type);
  put(d, 'isScraped', r.is_scraped);
  put(d, 'views', r.views);
  put(d, 'postDuration', r.post_duration);
  put(d, 'dynamicFields', r.dynamic_fields);
  put(d, 'createdAt', r.created_at);
  put(d, 'updatedAt', r.updated_at);
  put(d, 'postedAt', r.posted_at);
  put(d, 'publishedAt', r.published_at);
  put(d, 'expireAt', r.expire_at);
  put(d, 'userId', r.user_mongo_id);
  put(d, 'oldaddress', r.old_address);

  if ('province_slug' in r || 'district_slug' in r || 'ward_slug' in r) {
    d.adminunit = {
      ...(d.adminunit || {}),
      ...(r.province_slug != null ? { province: r.province_slug } : {}),
      ...(r.district_slug != null ? { district: r.district_slug } : {}),
      ...(r.ward_slug != null ? { ward: r.ward_slug } : {}),
    };
  }
  if (r.old_province_slug != null || r.old_district_slug != null || r.old_ward_slug != null) {
    d.oldadminunit = {
      ...(d.oldadminunit || {}),
      ...(r.old_province_slug != null ? { province: r.old_province_slug } : {}),
      ...(r.old_district_slug != null ? { district: r.old_district_slug } : {}),
      ...(r.old_ward_slug != null ? { ward: r.old_ward_slug } : {}),
    };
  }
  if (r.longitude != null && r.latitude != null) {
    d.coordinates = [r.longitude, r.latitude];
  }
  if (r.source_mongo_id != null || r.source_url != null || r.source_type != null || r.source_code != null) {
    d.source = {
      ...(d.source || {}),
      ...(r.source_mongo_id != null ? { _id: r.source_mongo_id } : {}),
      ...(r.source_url != null ? { url: r.source_url } : {}),
      ...(r.source_type != null ? { type: r.source_type } : {}),
      ...(r.source_code != null ? { code: Number(r.source_code) } : {}),
    };
  }
  return d;
}

// Column lists (fragments are built per call; never contain user input)
const cols = {
  list: () => sql`id, mongo_id, title, total_price, created_at, images[1:1] AS images, address,
    longitude, latitude, province_slug, district_slug, ward_slug, contact, area, property_type, short_id, slug`,
  mini: () => sql`id, mongo_id, short_id, title, total_price, price, area, price_per_m2,
    images[1:1] AS images, province_slug, district_slug, ward_slug, property_type`,
  detail: () => sql`id, mongo_id, short_id, slug, status, listing_mode, property_type, title, description,
    area, price, total_price, price_per_m2, legal_docs, direction, address,
    province_slug, district_slug, ward_slug, old_address, old_province_slug, old_district_slug, old_ward_slug,
    longitude, latitude, images, thumbnail_url, contact, user_mongo_id, source_mongo_id, source_url,
    source_type, source_code, user_type, is_scraped, views, post_duration, dynamic_fields,
    created_at, updated_at, posted_at, published_at, expire_at, extra`,
};

// ---------------------------------------------------------------------------
// WHERE builder
// ---------------------------------------------------------------------------

function rangeConds(col: string, range: [number | null, number | null] | undefined): Frag[] {
  const out: Frag[] = [];
  if (range?.length === 2) {
    const [min, max] = range;
    if (min !== null && min !== undefined) out.push(sql`${sql(col)} >= ${min}`);
    if (max !== null && max !== undefined) out.push(sql`${sql(col)} <= ${max}`);
  }
  return out;
}

function buildWhere(
  filters: RealEstateFilters | null,
  polygon: GeoPolygon | null = null,
  opts: { requireImage?: boolean; skipGeo?: boolean } = {}
): Frag {
  const { requireImage = true, skipGeo = false } = opts;
  const c: Frag[] = [sql`status >= ${PUBLIC_STATUS}`];
  if (requireImage) c.push(sql`first_image IS NOT NULL`);

  if (!skipGeo) {
    const g = polygonCond(polygon);
    if (g) c.push(g);
  }

  if (filters) {
    if (filters.province) c.push(sql`province_slug = ${filters.province}`);
    if (filters.district) c.push(sql`district_slug = ${filters.district}`);
    if (filters.ward) c.push(sql`ward_slug = ${filters.ward}`);
    c.push(...rangeConds('total_price', filters.totalPriceRange));
    c.push(...rangeConds('price_per_m2', filters.pricePerM2Range));
    c.push(...rangeConds('area', filters.areaRange));
    if (filters.propertyType && filters.propertyType.length > 0) {
      c.push(sql`property_type IN ${sql(filters.propertyType)}`);
    }
    if (filters.direction && filters.direction.length > 0) {
      c.push(sql`direction IN ${sql(filters.direction)}`);
    }
    if (typeof filters.dateRange === 'number' && filters.dateRange > 0) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - filters.dateRange);
      c.push(sql`created_at >= ${startDate} AND created_at <= ${endDate}`);
    }
  }
  return and(c);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get list of real estates in a polygon or by province/ward filters.
 */
export async function getRealEstatesInPolygon(
  polygon: GeoPolygon | null,
  filters: RealEstateFilters | null,
  limit = 30
) {
  const rows = await sql`
    SELECT ${cols.list()} FROM real_estates
    WHERE ${buildWhere(filters, polygon)}
    ORDER BY created_at DESC LIMIT ${limit}`;
  return rows.map(mapRealEstateRow);
}

/**
 * Get single real estate by ID: mongo_id first, then short_id
 * (internal numeric id only for rows created natively in PG without mongo_id).
 */
export async function getRealEstateById(id: string) {
  try {
    const pub = sql`status >= ${PUBLIC_STATUS} AND first_image IS NOT NULL`;
    let rows = await sql`SELECT ${cols.detail()} FROM real_estates WHERE mongo_id = ${id} AND ${pub} LIMIT 1`;
    if (!rows.length) {
      rows = await sql`SELECT ${cols.detail()} FROM real_estates WHERE short_id = ${id} AND ${pub} LIMIT 1`;
    }
    if (!rows.length && /^\d{1,15}$/.test(id)) {
      rows = await sql`SELECT ${cols.detail()} FROM real_estates
        WHERE mongo_id IS NULL AND id = ${Number(id)} AND ${pub} LIMIT 1`;
    }
    return rows.length ? mapRealEstateRow(rows[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Full-text search real estates.
 * >=3 chars: unaccented tsvector match (websearch syntax), ranked then newest.
 * shorter queries: ILIKE on unaccented title.
 */
export async function searchRealEstates(
  query: string,
  filters: RealEstateFilters | null,
  polygon: GeoPolygon | null,
  limit = 30
) {
  const q = (query || '').trim();
  const where = buildWhere(filters, polygon);
  let rows;
  if (!q) {
    rows = await sql`SELECT ${cols.list()} FROM real_estates WHERE ${where}
      ORDER BY created_at DESC LIMIT ${limit}`;
  } else if (q.length >= 3) {
    rows = await sql`SELECT ${cols.list()} FROM real_estates
      WHERE ${where} AND search_tsv @@ websearch_to_tsquery('simple', f_unaccent(${q}))
      ORDER BY ts_rank(search_tsv, websearch_to_tsquery('simple', f_unaccent(${q}))) DESC, created_at DESC
      LIMIT ${limit}`;
  } else {
    const like = `%${escapeLike(q)}%`;
    rows = await sql`SELECT ${cols.list()} FROM real_estates
      WHERE ${where} AND f_unaccent(title) ILIKE f_unaccent(${like})
      ORDER BY created_at DESC LIMIT ${limit}`;
  }
  return rows.map(mapRealEstateRow);
}

/**
 * Get real estates posted by a specific user (no image requirement, as before)
 */
export async function getRealEstatesByUser(userId: string, limit = 50) {
  const rows = await sql`
    SELECT ${cols.list()} FROM real_estates
    WHERE (user_mongo_id = ${userId}) AND status >= ${PUBLIC_STATUS}
    ORDER BY created_at DESC LIMIT ${limit}`;
  return rows.map(mapRealEstateRow);
}

const countCache = new Map<string, { count: number; expiresAt: number }>();
const COUNT_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Count real estates by query (for pagination and SEO metadata)
 */
export async function countRealEstates(
  filters: RealEstateFilters | null,
  polygon: GeoPolygon | null = null
) {
  const cacheKey = !polygon ? JSON.stringify(filters || {}) : null;
  if (cacheKey) {
    const cached = countCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.count;
    }
  }

  // As before: image requirement is only applied when counting inside a polygon.
  const where = buildWhere(filters, polygon, { requireImage: !!polygon });
  const [row] = await sql`SELECT count(*)::int AS n FROM real_estates WHERE ${where}`;
  const count: number = row.n;

  if (cacheKey) {
    countCache.set(cacheKey, { count, expiresAt: Date.now() + COUNT_CACHE_TTL_MS });
  }
  return count;
}

/**
 * Lightweight coordinate data for client-side clustering
 */
export async function getMapClusters(
  polygon: GeoPolygon | null,
  filters: RealEstateFilters | null,
  clusterRadius = 50,
  limit = 200
) {
  void clusterRadius;
  const rows = await sql`
    SELECT id, mongo_id, longitude, latitude, total_price FROM real_estates
    WHERE ${buildWhere(filters, polygon)} LIMIT ${limit}`;
  return rows.map(mapRealEstateRow);
}

function polygonBounds(polygon: GeoPolygon) {
  const coords = (polygon.type === 'Polygon' ? polygon.coordinates[0] : (polygon.coordinates as unknown as number[][][][])[0][0]) as number[][];
  const lats = coords.map((c) => c[1]);
  const lngs = coords.map((c) => c[0]);
  return {
    west: Math.min(...lngs), east: Math.max(...lngs),
    south: Math.min(...lats), north: Math.max(...lats),
  };
}

/**
 * Aggregated map clusters. Grid size depends on polygon span (same thresholds as the Mongo version);
 * precision -1 = exact-coordinate grouping (each listing returned with stackCount).
 */
export async function getAggregatedMapClusters(
  polygon: GeoPolygon | null,
  filters: RealEstateFilters | null,
  limit = 2000
) {
  let precision = 4;
  let bounds: ReturnType<typeof polygonBounds> | null = null;
  const hasPoly = !!polygon && (polygon.type === 'Polygon' || polygon.type === 'MultiPolygon');
  if (hasPoly) {
    try {
      bounds = polygonBounds(polygon!);
      const maxDiff = Math.max(bounds.north - bounds.south, bounds.east - bounds.west);
      if (maxDiff > 0.4) precision = 1;
      else if (maxDiff > 0.08) precision = 2;
      else if (maxDiff > 0.015) precision = 3;
      else if (maxDiff > 0.003) precision = 4;
      else precision = -1;
    } catch {
      // fallback to 4
    }
  }

  const preScanLimit: number | null =
    precision <= 1 ? 20000 : precision <= 2 ? 20000 : precision <= 3 ? 5000 : null;

  // Small areas: a cheap bbox (&&) is faster than exact ST_Within, as the Mongo version did.
  const useBbox = precision >= 3 && hasPoly && bounds !== null;
  const where = and([
    buildWhere(filters, polygon, { skipGeo: useBbox }),
    sql`longitude IS NOT NULL AND latitude IS NOT NULL`,
    ...(useBbox
      ? [sql`geom && ST_MakeEnvelope(${bounds!.west}, ${bounds!.south}, ${bounds!.east}, ${bounds!.north}, 4326)`]
      : []),
  ]);

  const base = preScanLimit !== null
    ? sql`(SELECT * FROM real_estates WHERE ${where} ORDER BY created_at DESC LIMIT ${preScanLimit}) t`
    : sql`(SELECT * FROM real_estates WHERE ${where}) t`;

  if (precision === -1) {
    const rows = await sql`
      SELECT * FROM (
        SELECT id, mongo_id, longitude, latitude, title, COALESCE(total_price, price) AS total_price, area,
               images[1:1] AS images, province_slug, district_slug, ward_slug, short_id, slug,
               count(*) OVER (PARTITION BY longitude, latitude) AS stack_count,
               row_number() OVER (PARTITION BY longitude, latitude ORDER BY created_at DESC) AS rn
        FROM ${base}
      ) s WHERE rn <= 100 LIMIT ${limit}`;
    return rows.map((r) => ({
      ...mapRealEstateRow(r),
      count: 1,
      stackCount: Number(r.stack_count) || 1,
    }));
  }

  const rows = await sql`
    SELECT * FROM (
      SELECT id, mongo_id, longitude, latitude, title, COALESCE(total_price, price) AS total_price, area,
             images[1:1] AS images, province_slug, district_slug, ward_slug, short_id, slug,
             count(*) OVER w AS cnt,
             row_number() OVER (w ORDER BY created_at DESC) AS rn
      FROM ${base}
      WINDOW w AS (PARTITION BY round(longitude::numeric, ${precision}::int), round(latitude::numeric, ${precision}::int))
    ) s WHERE rn = 1 LIMIT ${limit}`;

  return rows.map((r) => {
    const count = Number(r.cnt) || 1;
    const doc = mapRealEstateRow(r);
    const out: Doc = {
      _id: r.mongo_id ?? (r.id != null ? String(r.id) : 'temp-id'),
      coordinates: doc.coordinates,
      count,
    };
    if (count === 1) {
      for (const k of ['title', 'totalPrice', 'area', 'adminunit', 'shortId', 'slug', 'images']) {
        if (doc[k] !== undefined) out[k] = doc[k];
      }
    }
    return out;
  });
}

// ---------------------------------------------------------------------------
// Projects (legacy helpers kept in this module; see project.ts for the map/list ones)
// ---------------------------------------------------------------------------
export async function getProjectById(id: string) {
  try {
    const rows = await sql`
      SELECT * FROM projects WHERE short_id = ${id} OR mongo_id = ${id}
      ORDER BY (short_id = ${id}) DESC LIMIT 1`;
    return rows.length ? mapProjectRow(rows[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Get paginated projects list with optional filters.
 */
export async function getProjects(
  filters: { province?: string; district?: string; projectType?: string; status?: string } | null = null,
  page = 1,
  limit = 20
) {
  const c: Frag[] = [];
  if (filters) {
    if (filters.province) {
      c.push(sql`(legacy_province_slug = ${filters.province} OR (legacy_province_slug IS NULL AND province_slug = ${filters.province}))`);
    }
    if (filters.district) c.push(sql`district_slug ILIKE ${'%' + escapeLike(filters.district) + '%'}`);
    if (filters.projectType) c.push(sql`${filters.projectType} = ANY(project_types)`);
    if (filters.status) c.push(sql`status = ${String(filters.status)}`);
  }
  const where = and(c);
  const skip = (page - 1) * limit;
  const [rows, [{ n }]] = await Promise.all([
    sql`SELECT * FROM projects WHERE ${where}
        ORDER BY published_at DESC NULLS LAST, created_at DESC LIMIT ${limit} OFFSET ${skip}`,
    sql`SELECT count(*)::int AS n FROM projects WHERE ${where}`,
  ]);
  return { items: rows.map(mapProjectRow), total: n as number, totalPages: Math.ceil(n / limit), page };
}

/**
 * Search projects by text (case/accent-insensitive substring over title, trade name, address, investor).
 */
export async function searchProjects(query: string, limit = 20) {
  const where = query
    ? (() => {
        const like = `%${escapeLike(query)}%`;
        return sql`(f_unaccent(title) ILIKE f_unaccent(${like}) OR f_unaccent(trade_name) ILIKE f_unaccent(${like})
          OR f_unaccent(address) ILIKE f_unaccent(${like}) OR f_unaccent(investor_name) ILIKE f_unaccent(${like}))`;
      })()
    : sql`TRUE`;
  const rows = await sql`SELECT * FROM projects WHERE ${where}
    ORDER BY published_at DESC NULLS LAST LIMIT ${limit}`;
  return rows.map(mapProjectRow);
}

/**
 * Get projects by investor name.
 */
export async function getProjectsByInvestor(investorName: string, limit = 20) {
  const rows = await sql`SELECT * FROM projects
    WHERE f_unaccent(investor_name) ILIKE f_unaccent(${'%' + escapeLike(investorName) + '%'})
    ORDER BY created_at DESC LIMIT ${limit}`;
  return rows.map(mapProjectRow);
}

/**
 * Count projects with optional filters.
 */
export async function countProjects(
  filters: { province?: string; district?: string } | null = null
) {
  const c: Frag[] = [];
  if (filters?.province) {
    c.push(sql`(legacy_province_slug = ${filters.province} OR (legacy_province_slug IS NULL AND province_slug = ${filters.province}))`);
  }
  if (filters?.district) c.push(sql`district_slug ILIKE ${'%' + escapeLike(filters.district) + '%'}`);
  const [row] = await sql`SELECT count(*)::int AS n FROM projects WHERE ${and(c)}`;
  return row.n as number;
}

/**
 * Get similar real estates for detail page SSR and API
 */
export async function getSimilarRealEstates(
  id: string,
  sourceListing?: Doc,
  limit = 12
) {
  try {
    let source: Doc | null | undefined = sourceListing;
    if (!source || !source.adminunit) {
      source = await getRealEstateById(id);
    }
    if (!source) return [];

    const sourceId = String(source._id || id);
    const basePrice = (source.totalPrice || source.price || 0) as number;
    const priceMin = basePrice * 0.7;
    const priceMax = basePrice * 1.3;
    const notThis = sql`COALESCE(mongo_id, id::text) <> ${sourceId}`;
    const pub = sql`status >= ${PUBLIC_STATUS}`;

    const [bySeller, byWard, byDistrict] = await Promise.all([
      source.source?._id
        ? sql`SELECT ${cols.mini()} FROM real_estates
              WHERE source_mongo_id = ${String(source.source._id)} AND ${notThis} AND ${pub}
              ORDER BY created_at DESC LIMIT 6`
        : Promise.resolve([] as Doc[]),
      source.adminunit?.ward
        ? sql`SELECT ${cols.mini()} FROM real_estates
              WHERE ${notThis} AND ${pub} AND ward_slug = ${source.adminunit.ward}
              ${source.propertyType ? sql`AND property_type = ${source.propertyType}` : sql``}
              ORDER BY created_at DESC LIMIT 8`
        : Promise.resolve([] as Doc[]),
      source.adminunit?.district || source.adminunit?.province
        ? sql`SELECT ${cols.mini()} FROM real_estates
              WHERE ${notThis} AND ${pub}
              ${source.adminunit?.district
                ? sql`AND district_slug = ${source.adminunit.district}`
                : sql`AND province_slug = ${source.adminunit?.province}`}
              ${source.propertyType ? sql`AND property_type = ${source.propertyType}` : sql``}
              ${priceMin > 0 ? sql`AND total_price >= ${priceMin} AND total_price <= ${priceMax}` : sql``}
              ORDER BY created_at DESC LIMIT 8`
        : Promise.resolve([] as Doc[]),
    ]);

    const seen = new Set<string>();
    const results: Doc[] = [];
    const addItems = (items: Doc[], tag: string) => {
      for (const row of items) {
        const item = mapRealEstateRow(row);
        const key = String(item._id);
        if (!seen.has(key) && results.length < limit) {
          seen.add(key);
          results.push({ ...item, _similarTag: tag });
        }
      }
    };
    addItems(bySeller, 'same_seller');
    addItems(byWard, 'same_area');
    addItems(byDistrict, 'similar_price');

    return JSON.parse(JSON.stringify(results));
  } catch (err) {
    console.error('[getSimilarRealEstates] Error:', err);
    return [];
  }
}
