import { sql } from './pg';
import { and, polygonCond, put, type Doc, type Frag } from './pgUtil';
import type { GeoPolygon } from './realEstate';

export interface ProjectFilters {
  province?: string;
  district?: string;
  ward?: string;
  status?: number[];
}

export const PROJECT_LIST_PROJECTION = {
  _id: 1,
  title: 1,
  description: 1,
  images: 1,
  price: 1,
  area: 1,
  status: 1,
  address: 1,
  adminunit: 1,
  shortId: 1,
  createdAt: 1,
  coordinates: 1,
};

/**
 * Map a projects row to the legacy Mongo document shape.
 * `extra` jsonb (price, minPrice, maxPrice, totalArea, investorLogo ...) is spread first; typed columns win.
 */
export function mapProjectRow(r: Doc): Doc & { _id: any } {
  const d: Doc & { _id: any } = r.extra && typeof r.extra === 'object' ? { _id: null, ...r.extra } : { _id: null };
  d._id = r.mongo_id ?? String(r.id);
  put(d, 'shortId', r.short_id);
  put(d, 'slug', r.slug);
  put(d, 'title', r.title);
  put(d, 'tradeName', r.trade_name);
  put(d, 'description', r.description);
  put(d, 'address', r.address);
  put(d, 'streetName', r.street_name);
  put(d, 'investorName', r.investor_name);
  put(d, 'investorDescription', r.investor_description);
  put(d, 'investorLogo', r.investor_logo_url);
  put(d, 'projectType', r.project_type);
  put(d, 'projectTypes', r.project_types);
  put(d, 'totalApartment', r.total_apartments);
  put(d, 'totalBuilding', r.total_buildings);
  put(d, 'totalFloor', r.total_floors);
  put(d, 'totalArea', r.total_area_text);
  put(d, 'buildingDensity', r.building_density);
  put(d, 'ownership', r.ownership);
  put(d, 'banner', r.banner_url);
  put(d, 'logo', r.logo_url);
  put(d, 'utilitiesSummary', r.utilities_summary);
  put(d, 'locationSummary', r.location_summary);
  put(d, 'legalSummary', r.legal_summary);
  put(d, 'refPriceM2', r.ref_price_m2);
  put(d, 'images', r.images);
  put(d, 'originalImages', r.original_images);
  put(d, 'sourceUrl', r.source_url);
  put(d, 'sourceType', r.source_type);
  put(d, 'propertyType', r.property_type);
  put(d, 'isScraped', r.is_scraped);
  put(d, 'completionTime', r.completion_time);
  put(d, 'startTime', r.start_time);
  put(d, 'constructionProgress', r.construction_progress);
  put(d, 'salePolicy', r.sale_policy);
  put(d, 'juridical', r.juridical);
  put(d, 'createdAt', r.created_at);
  put(d, 'updatedAt', r.updated_at);
  put(d, 'publishedAt', r.published_at);
  if (r.status != null) d.status = /^\d+$/.test(String(r.status)) ? Number(r.status) : r.status;

  d.adminunit = {
    ...(d.adminunit || {}),
    ...((r.legacy_province_slug ?? r.province_slug) != null
      ? { province: r.legacy_province_slug ?? r.province_slug } : {}),
    ...(r.district_slug ? { district: r.district_slug } : {}),
    ...(r.ward_slug ? { ward: r.ward_slug } : {}),
  };
  // 001 defaults lat/lon to 0 when unknown -> treat (0,0) as "no coordinates"
  if (r.lon != null && r.lat != null && !(Number(r.lon) === 0 && Number(r.lat) === 0)) {
    d.coordinates = [Number(r.lon), Number(r.lat)];
  }
  return d;
}

function buildWhere(filters: ProjectFilters | null, polygon: GeoPolygon | null = null): Frag {
  // Mongo: status != 0 (also matched string statuses like "handedOver")
  const c: Frag[] = [sql`status IS DISTINCT FROM '0'`];
  const g = polygonCond(polygon);
  if (g) c.push(g);
  if (filters) {
    if (filters.province) {
      c.push(sql`(legacy_province_slug = ${filters.province} OR (legacy_province_slug IS NULL AND province_slug = ${filters.province}))`);
    }
    if (filters.district) c.push(sql`district_slug = ${filters.district}`);
    if (filters.ward) c.push(sql`ward_slug = ${filters.ward}`);
    if (filters.status && filters.status.length > 0) {
      c.push(sql`status IN ${sql(filters.status.map(String))}`);
    }
  }
  return and(c);
}

function pickProjection(d: Doc): Doc {
  const o: Doc = {};
  for (const k of Object.keys(PROJECT_LIST_PROJECTION)) if (d[k] !== undefined) o[k] = d[k];
  return o;
}

export async function searchProjects(
  query: string,
  filters: ProjectFilters | null,
  polygon: GeoPolygon | null,
  limit = 30,
  offset = 0
) {
  const q = (query || '').trim();
  const where = buildWhere(filters, polygon);
  let rows;
  if (!q) {
    rows = await sql`SELECT * FROM projects WHERE ${where}
      ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  } else if (q.length >= 3) {
    rows = await sql`SELECT * FROM projects
      WHERE ${where} AND search_tsv @@ websearch_to_tsquery('simple', f_unaccent(${q}))
      ORDER BY ts_rank(search_tsv, websearch_to_tsquery('simple', f_unaccent(${q}))) DESC, created_at DESC
      LIMIT ${limit} OFFSET ${offset}`;
  } else {
    const like = `%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
    rows = await sql`SELECT * FROM projects
      WHERE ${where} AND f_unaccent(title) ILIKE f_unaccent(${like})
      ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  }
  return rows.map((r) => pickProjection(mapProjectRow(r)));
}

export async function getAggregatedProjectMapClusters(
  polygon: GeoPolygon | null,
  filters: ProjectFilters | null,
  limit = 2000
) {
  let precision = 4;
  if (polygon && (polygon.type === 'Polygon' || polygon.type === 'MultiPolygon')) {
    try {
      const coords = (polygon.type === 'Polygon' ? polygon.coordinates[0] : (polygon.coordinates as unknown as number[][][][])[0][0]) as number[][];
      const lats = coords.map((c) => c[1]);
      const lngs = coords.map((c) => c[0]);
      const maxDiff = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
      if (maxDiff > 0.4) precision = 1;
      else if (maxDiff > 0.08) precision = 2;
      else if (maxDiff > 0.015) precision = 3;
      else if (maxDiff > 0.003) precision = 4;
      else precision = -1;
    } catch {}
  }

  const rows = await sql`SELECT * FROM projects WHERE ${buildWhere(filters, polygon)} LIMIT ${limit}`;
  const items = rows.map(mapProjectRow);

  if (precision === -1) {
    return items.map((item) => ({
      _id: String(item._id),
      title: item.title,
      images: item.images,
      price: item.price,
      status: item.status,
      count: 1,
      coordinates: item.coordinates,
      adminunit: item.adminunit,
      shortId: item.shortId,
    }));
  }

  const clusters = new Map<string, Doc>();
  const precisionFactor = Math.pow(10, precision);

  for (const item of items) {
    if (!item.coordinates || item.coordinates.length < 2) continue;
    const [lng, lat] = item.coordinates;
    const roundLng = Math.round(lng * precisionFactor) / precisionFactor;
    const roundLat = Math.round(lat * precisionFactor) / precisionFactor;
    const cellKey = `${roundLng},${roundLat}`;
    const existing = clusters.get(cellKey);
    if (!existing) {
      clusters.set(cellKey, {
        _id: String(item._id),
        title: item.title,
        images: item.images,
        price: item.price,
        status: item.status,
        count: 1,
        coordinates: [roundLng, roundLat],
        adminunit: item.adminunit,
        shortId: item.shortId,
        slug: item.slug,
      });
    } else {
      existing.count += 1;
    }
  }

  return Array.from(clusters.values());
}
