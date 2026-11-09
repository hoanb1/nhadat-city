import { sql } from '../pg';
import type { Doc } from '../pgUtil';

/** districts row -> legacy Mongo `districts` document shape. */
function mapDistrictRow(r: Doc): Doc {
  return {
    _id: r.mongo_id ?? String(r.id),
    Code: r.code,
    Type: r.type,
    Name: r.name,
    CodeName: r.code_name,
    ProvinceCode: r.province_code,
    ProvinceCodeName: r.province_code_name,
  };
}

export async function getDistrict(provinceSlug: string, districtSlug: string): Promise<Doc | null> {
  const rows = await sql`
    SELECT * FROM districts WHERE province_code_name = ${provinceSlug} AND code_name = ${districtSlug} LIMIT 1`;
  return rows.length ? mapDistrictRow(rows[0]) : null;
}

/** Districts of a province sorted by Name (binary collation, as Mongo did). */
export async function listDistrictsByProvince(
  provinceSlug: string,
  opts: { excludeSlug?: string; limit?: number } = {}
): Promise<Doc[]> {
  const rows = await sql`
    SELECT * FROM districts
    WHERE province_code_name = ${provinceSlug}
      ${opts.excludeSlug ? sql`AND code_name <> ${opts.excludeSlug}` : sql``}
    ORDER BY name COLLATE "C", id
    ${opts.limit ? sql`LIMIT ${opts.limit}` : sql``}`;
  return rows.map(mapDistrictRow);
}

/** Public listing count for a province (status >= 1, no image requirement - same as before). */
export async function countListingsByProvince(provinceSlug: string): Promise<number> {
  const [{ n }] = await sql`
    SELECT COUNT(*)::int AS n FROM real_estates WHERE province_slug = ${provinceSlug} AND status >= 1`;
  return n;
}

/** Wards of a province (ward2025 replacement) for SEO link blocks. */
export async function listWardsByProvince(provinceSlug: string, limit?: number): Promise<Doc[]> {
  const rows = await sql`
    SELECT * FROM wards_2025 WHERE province_slug = ${provinceSlug} ORDER BY id
    ${limit ? sql`LIMIT ${limit}` : sql``}`;
  return rows.map((r) => ({
    _id: String(r.id),
    Name: r.name,
    CodeName: r.slug,
    ProvinceCodeName: r.province_slug,
    ProvinceName: r.province_name,
    Code: r.ma_xa,
  }));
}

// ---------------------------------------------------------------------------
// province2025 / ward2025 replacements (Mongo-shaped documents)
// ---------------------------------------------------------------------------

export function mapProvinceRow(r: Doc): Doc {
  return {
    _id: String(r.id),
    CodeName: r.slug,
    Name: r.name,
    maTinh: r.ma_tinh,
    maTinh_BNV: r.ma_tinh_bnv,
    dienTich: r.area_km2,
    danSo: r.population,
    oldcodename: r.legacy_slugs ?? [],
    lat: r.lat,
    lon: r.lon,
    Location: { type: 'Point', coordinates: [r.lon, r.lat] },
  };
}

export function mapWardRow(r: Doc): Doc {
  return {
    _id: String(r.id),
    CodeName: r.slug,
    Name: r.name,
    tenXa: r.name,
    ProvinceCodeName: r.province_slug,
    tenTinh: r.province_name,
    maXa: r.ma_xa,
    maXa_BNV: r.ma_xa_bnv,
    dienTich: r.area_km2,
    danSo: r.population,
    nghiQuyet: r.resolution_no,
    ghiChu: r.merged_from,
    oldcodename: r.legacy_slugs ?? [],
    lat: r.lat,
    lon: r.lon,
    Location: { type: 'Point', coordinates: [r.lon, r.lat] },
  };
}

/** Province by current slug, falling back to legacy (pre-merger) slug. */
export async function findProvince(slug: string): Promise<Doc | null> {
  const rows = await sql`
    SELECT * FROM provinces_2025 WHERE slug = ${slug} OR ${slug} = ANY(legacy_slugs)
    ORDER BY (slug = ${slug}) DESC, id LIMIT 1`;
  return rows.length ? mapProvinceRow(rows[0]) : null;
}

export async function findWard(candidateCodes: string[], provinceSlugs?: string[]): Promise<Doc | null> {
  const rows = await sql`
    SELECT * FROM wards_2025
    WHERE (slug IN ${sql(candidateCodes)} OR legacy_slugs && ${sql.array(candidateCodes)}::text[])
      ${provinceSlugs?.length ? sql`AND province_slug IN ${sql(provinceSlugs)}` : sql``}
    ORDER BY (slug IN ${sql(candidateCodes)}) DESC, id LIMIT 1`;
  return rows.length ? mapWardRow(rows[0]) : null;
}

export async function findWardByMaXaBnv(maXaBnv: string): Promise<Doc | null> {
  const rows = await sql`SELECT * FROM wards_2025 WHERE ma_xa_bnv = ${maXaBnv} LIMIT 1`;
  return rows.length ? mapWardRow(rows[0]) : null;
}

/** District by slug only, optionally restricted to province slugs. */
export async function findDistrictBySlugs(codes: string[], provinceSlugs?: string[]): Promise<Doc | null> {
  const rows = await sql`
    SELECT * FROM districts WHERE code_name IN ${sql(codes)}
    ${provinceSlugs?.length ? sql`AND province_code_name IN ${sql(provinceSlugs)}` : sql``}
    ORDER BY id LIMIT 1`;
  return rows.length ? mapDistrictRow(rows[0]) : null;
}

export async function listWardNamesByProvince(provinceSlugs: string[], limit: number): Promise<Doc[]> {
  const rows = await sql`
    SELECT name, slug FROM wards_2025 WHERE province_slug IN ${sql(provinceSlugs)}
    ORDER BY name COLLATE "C", id LIMIT ${limit}`;
  return rows.map((r) => ({ Name: r.name, CodeName: r.slug, tenXa: r.name }));
}

/** GeoJSON FeatureCollection from wards_2025 / provinces_2025 geometry (no geoFeatures table in PG). */
export async function fetchGeoFeatureCollection(province: string, ward?: string) {
  const rows = ward
    ? await sql`
        SELECT province_slug, slug, name, ST_AsGeoJSON(geom)::json AS geometry FROM wards_2025
        WHERE province_slug = ${province} AND slug = ${ward} AND geom IS NOT NULL LIMIT 1`
    : await sql`
        SELECT slug AS province_slug, NULL::text AS slug, name, ST_AsGeoJSON(geom)::json AS geometry
        FROM provinces_2025
        WHERE (slug = ${province} OR ${province} = ANY(legacy_slugs)) AND geom IS NOT NULL
        ORDER BY (slug = ${province}) DESC LIMIT 1`;
  if (!rows.length) return null;
  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      geometry: r.geometry,
      properties: { provinceCodeName: r.province_slug, wardCodeName: r.slug ?? undefined, name: r.name },
    })),
  };
}
