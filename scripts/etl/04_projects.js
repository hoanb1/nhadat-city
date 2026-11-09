/**
 * ETL Script: Task 6 - Populate projects (all 4,551 documents)
 */
const { MongoClient } = require('mongodb');
const { Client } = require('pg');

const MONGO_URI = require('./_env').need('MONGODB_URI');
const PG_URI = require('./_env').need('DATABASE_URL');

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function run() {
  const mClient = new MongoClient(MONGO_URI);
  await mClient.connect();
  const db = mClient.db();

  const pClient = new Client({ connectionString: PG_URI });
  await pClient.connect();

  console.log('=== Step 6: Populating projects ===');

  // Load legacy to 2025 province slug mapping from PostgreSQL
  const provRows = await pClient.query('SELECT slug, legacy_slugs FROM provinces_2025;');
  const legacyTo2025Map = new Map();
  for (const row of provRows.rows) {
    legacyTo2025Map.set(row.slug, row.slug);
    for (const old of (row.legacy_slugs || [])) {
      legacyTo2025Map.set(old, row.slug);
    }
  }
  // Extra aliases
  legacyTo2025Map.set('tphcm', 'ho-chi-minh');
  legacyTo2025Map.set('tp-ho-chi-minh', 'ho-chi-minh');
  legacyTo2025Map.set('thua-thien-hue', 'hue');

  const mongoProjects = await db.collection('projects').find().toArray();
  console.log(`Fetched ${mongoProjects.length} projects from MongoDB.`);

  await pClient.query('TRUNCATE TABLE projects RESTART IDENTITY CASCADE;');

  const seenSlugs = new Set();
  let duplicateSlugCount = 0;

  const batchSize = 100;
  for (let i = 0; i < mongoProjects.length; i += batchSize) {
    const chunk = mongoProjects.slice(i, i + batchSize);

    for (const doc of chunk) {
      let slug = doc.slug;
      const shortId = doc.shortId || doc._id.toString().slice(-6);

      if (!slug || slug.trim() === '') {
        slug = slugify(doc.title) || `du-an-${shortId}`;
      }

      if (seenSlugs.has(slug)) {
        duplicateSlugCount++;
        slug = `${slug}-${shortId}`;
      }
      seenSlugs.add(slug);

      const title = doc.title || 'Dự án';
      const trade_name = doc.tradeName || '';

      // Province slug resolution
      let rawProv = doc.adminunit?.province;
      if (!rawProv && doc.address) {
        if (doc.address.includes('Hải Phòng')) rawProv = 'hai-phong';
        else if (doc.address.includes('Hồ Chí Minh') || doc.address.includes('Bình Dương')) rawProv = 'ho-chi-minh';
        else if (doc.address.includes('Hà Nội')) rawProv = 'ha-noi';
      }
      const province_slug = legacyTo2025Map.get(rawProv) || 'toan-quoc';
      const ward_slug = doc.adminunit?.ward || '';
      const address = doc.address || '';
      const street_name = doc.streetName || '';
      const investor_name = doc.investorName || '';
      const investor_description = doc.investorDescription || '';

      let project_type = 'Khu đô thị / Dự án';
      if (Array.isArray(doc.projectTypes) && doc.projectTypes.length > 0) {
        project_type = doc.projectTypes.join(', ');
      } else if (doc.propertyType) {
        project_type = String(doc.propertyType);
      }

      const total_apartments = doc.totalApartment ? String(doc.totalApartment) : '';
      const total_buildings = doc.totalBuilding ? String(doc.totalBuilding) : '';
      const total_floors = doc.totalFloor ? String(doc.totalFloor) : '';
      const total_area_text = doc.totalArea ? String(doc.totalArea) : (doc.area ? `${doc.area} m²` : '');
      const building_density = doc.buildingDensity ? String(doc.buildingDensity) : '';
      const ownership = doc.ownership || 'Sổ hồng lâu dài';
      const status = doc.status || 'Đang cập nhật';
      const banner_url = doc.banner || '';
      const utilities_summary = doc.utilitiesDescription || '';
      const location_summary = doc.locationDescription || '';
      const legal_summary = doc.juridical || '';
      const ref_price_m2 = Number(doc.price) || Number(doc.refPrice) || 0;

      // Extract coords: [lon, lat]
      let lon = 0;
      let lat = 0;
      if (Array.isArray(doc.coordinates) && doc.coordinates.length >= 2) {
        let c0 = Number(doc.coordinates[0]);
        let c1 = Number(doc.coordinates[1]);

        // Fix swapped coordinates if necessary
        if (c0 < 30 && c1 > 100) {
          lat = c0;
          lon = c1;
        } else {
          lon = c0;
          lat = c1;
        }
      }

      await pClient.query(`
        INSERT INTO projects (
          slug, short_id, title, trade_name, province_slug, ward_slug,
          address, street_name, investor_name, investor_description,
          project_type, total_apartments, total_buildings, total_floors,
          total_area_text, building_density, ownership, status, banner_url,
          utilities_summary, location_summary, legal_summary, ref_price_m2,
          lat, lon, geom
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21, $22, $23,
          $24, $25,
          ST_SetSRID(ST_MakePoint($25, $24), 4326)
        )
      `, [
        slug, shortId, title, trade_name, province_slug, ward_slug,
        address, street_name, investor_name, investor_description,
        project_type, total_apartments, total_buildings, total_floors,
        total_area_text, building_density, ownership, status, banner_url,
        utilities_summary, location_summary, legal_summary, ref_price_m2,
        lat, lon
      ]);
    }

    if ((i + chunk.length) % 500 === 0 || i + chunk.length === mongoProjects.length) {
      console.log(`Inserted ${i + chunk.length} / ${mongoProjects.length} projects...`);
    }
  }

  const pRes = await pClient.query('SELECT COUNT(*) FROM projects;');
  console.log(`Disambiguated duplicate slugs: ${duplicateSlugCount}`);
  console.log(`projects total row count: ${pRes.rows[0].count}`);

  await mClient.close();
  await pClient.end();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
