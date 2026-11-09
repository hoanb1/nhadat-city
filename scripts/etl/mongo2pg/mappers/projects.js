'use strict';
const c = require('../lib/coerce');
const KNOWN = new Set(['_id', 'title', 'tradeName', 'description', 'address', 'streetName', 'coordinates', 'adminunit', 'images', 'banner', 'logo', 'slug', 'shortId',
  'investorName', 'investorDescription', 'investorLogo', 'projectTypes', 'totalApartment', 'totalBuilding', 'totalFloor', 'totalArea', 'buildingDensity', 'ownership',
  'status', 'completionTime', 'startTime', 'utilitiesDescription', 'locationDescription', 'constructionProgress', 'salePolicy', 'juridical', 'sourceUrl', 'sourceType',
  'propertyType', 'createdAt', 'publishedAt', 'updatedAt', 'isScraped', 'originalImages']);
const t = (v) => { const s = c.str(v); return s === null ? '' : s; };

module.exports = {
  collection: 'projects', table: 'projects', key: 'mongo_id', shortId: true, geom: true,
  columns: {
    mongo_id: 'text', short_id: 'text', slug: 'text', title: 'text', trade_name: 'text', province_slug: 'text', ward_slug: 'text', address: 'text', street_name: 'text',
    investor_name: 'text', investor_description: 'text', project_type: 'text', total_apartments: 'text', total_buildings: 'text', total_floors: 'text', total_area_text: 'text',
    building_density: 'text', ownership: 'text', status: 'text', banner_url: 'text', utilities_summary: 'text', location_summary: 'text', legal_summary: 'text',
    ref_price_m2: 'double precision', lat: 'double precision', lon: 'double precision', created_at: 'timestamptz',
    description: 'text', district_slug: 'text', legacy_province_slug: 'text', project_types: 'text[]', logo_url: 'text', investor_logo_url: 'text',
    images: 'text[]', original_images: 'text[]', source_url: 'text', source_type: 'text', property_type: 'text', is_scraped: 'boolean', completion_time: 'text', start_time: 'text',
    construction_progress: 'jsonb', sale_policy: 'jsonb', juridical: 'jsonb', published_at: 'timestamptz', updated_at: 'timestamptz', extra: 'jsonb',
  },
  defaults: { lat: '0', lon: '0', created_at: 'now()', description: "''", project_types: "'{}'::text[]", images: "'{}'::text[]", original_images: "'{}'::text[]", is_scraped: 'false',
    construction_progress: "'{}'::jsonb", sale_policy: "'{}'::jsonb", juridical: "'{}'::jsonb", extra: "'{}'::jsonb" },
  noUpdate: ['slug'], // keep slugs already published by scripts/etl/04 (SEO URLs)
  async prepare(ctx) {
    const r = await ctx.pg.query('SELECT slug, legacy_slugs FROM provinces_2025');
    const map = new Map([['tphcm', 'ho-chi-minh'], ['tp-ho-chi-minh', 'ho-chi-minh'], ['thua-thien-hue', 'hue']]);
    for (const p of r.rows) { map.set(p.slug, p.slug); for (const o of p.legacy_slugs || []) map.set(o, p.slug); }
    ctx.provMap = map; ctx.seenSlugs = new Set();
  },
  // adopt rows loaded earlier by scripts/etl/04 (mongo_id NULL) by short_id, so the upsert updates them in place
  async beforeBatch(pg, rows) {
    await pg.query(`UPDATE projects p SET mongo_id = v.mongo_id
      FROM jsonb_to_recordset($1::jsonb) AS v(mongo_id text, short_id text)
      WHERE p.short_id = v.short_id AND p.mongo_id IS NULL AND v.short_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM projects q WHERE q.mongo_id = v.mongo_id)`, [JSON.stringify(rows.map((r) => ({ mongo_id: r.mongo_id, short_id: r.short_id })))]);
  },
  fixConflict(row, col) { if (col !== 'slug') return false; row.slug = `${row.slug}-${row.short_id || row.mongo_id.slice(-6)}`; return true; },
  map(d, ctx) {
    const mid = c.id(d._id);
    const shortId = c.str(d.shortId) || mid.slice(-6);
    let slug = (c.str(d.slug) || '').trim();
    if (!slug) slug = c.slugify(d.title) || `du-an-${shortId}`;
    if (ctx.seenSlugs.has(slug)) slug = `${slug}-${shortId}`;
    ctx.seenSlugs.add(slug);
    const au = c.obj(d.adminunit);
    let raw = c.str(au.province);
    const addr = c.str(d.address) || '';
    if (!raw && addr) { if (addr.includes('Hải Phòng')) raw = 'hai-phong'; else if (addr.includes('Hồ Chí Minh') || addr.includes('Bình Dương')) raw = 'ho-chi-minh'; else if (addr.includes('Hà Nội')) raw = 'ha-noi'; }
    let ll = null;
    if (Array.isArray(d.coordinates)) {
      let a = c.dbl(d.coordinates[0]), b = c.dbl(d.coordinates[1]);
      if (a !== null && b !== null && a < 30 && b > 100) [a, b] = [b, a]; // swapped [lat,lng] fix (same as 04)
      ll = c.lngLat(a, b);
    }
    const pt = c.strArr(d.projectTypes);
    const jur = c.obj(d.juridical);
    // non-typed fields keep ORIGINAL camelCase keys (P3 contract): price, minPrice, maxPrice, totalArea, ...
    const extra = c.rest(d, KNOWN);
    if (d.totalArea !== undefined) extra.totalArea = d.totalArea;
    const mapped = {
      mongo_id: mid, short_id: shortId, slug, title: t(d.title) || 'Dự án', trade_name: t(d.tradeName),
      province_slug: ctx.provMap.get(raw) || 'toan-quoc', ward_slug: t(au.ward), address: addr, street_name: t(d.streetName),
      investor_name: t(d.investorName), investor_description: t(d.investorDescription),
      project_type: pt.length ? pt.join(', ') : (c.str(d.propertyType) || 'Khu đô thị / Dự án'),
      total_apartments: t(d.totalApartment), total_buildings: t(d.totalBuilding), total_floors: t(d.totalFloor),
      total_area_text: t(d.totalArea) || (d.area ? `${d.area} m²` : ''), building_density: t(d.buildingDensity),
      ownership: c.str(d.ownership) || 'Sổ hồng lâu dài', status: c.str(d.status) || 'Đang cập nhật', banner_url: t(d.banner),
      utilities_summary: t(d.utilitiesDescription), location_summary: t(d.locationDescription), legal_summary: t(jur.description),
      ref_price_m2: c.dbl(d.price) || c.dbl(d.refPrice) || 0, lat: ll ? ll.lat : 0, lon: ll ? ll.lng : 0, _lng: ll ? ll.lng : null, _lat: ll ? ll.lat : null,
      created_at: c.date(d.createdAt), description: t(d.description), district_slug: c.str(au.district), legacy_province_slug: raw,
      project_types: pt, logo_url: c.str(d.logo), investor_logo_url: c.str(d.investorLogo), images: c.strArr(d.images), original_images: c.strArr(d.originalImages),
      source_url: c.str(d.sourceUrl), source_type: c.str(d.sourceType), property_type: c.str(d.propertyType), is_scraped: c.bool(d.isScraped),
      completion_time: c.str(d.completionTime), start_time: c.str(d.startTime), construction_progress: c.obj(d.constructionProgress), sale_policy: c.obj(d.salePolicy),
      juridical: jur, published_at: c.date(d.publishedAt), updated_at: c.date(d.updatedAt), extra,
    };
    const ar = c.omit(au, ['province', 'district', 'ward']); if (!c.isEmpty(ar)) extra.adminunit_rest = ar;
    return mapped;
  },
};
