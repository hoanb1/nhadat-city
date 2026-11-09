/**
 * ETL Script: Task 3 - Populate wards_2025 (all 3,322 documents)
 */
const { MongoClient } = require('mongodb');
const { Client } = require('pg');

const MONGO_URI = require('./_env').need('MONGODB_URI');
const PG_URI = require('./_env').need('DATABASE_URL');

async function run() {
  const mClient = new MongoClient(MONGO_URI);
  await mClient.connect();
  const db = mClient.db();

  const pClient = new Client({ connectionString: PG_URI });
  await pClient.connect();

  console.log('=== Step 3: Populating wards_2025 ===');
  const mongoWards = await db.collection('ward2025').find().toArray();
  console.log(`Fetched ${mongoWards.length} wards from MongoDB ward2025.`);

  // Clean table first to ensure exact count without stale data
  await pClient.query('TRUNCATE TABLE wards_2025 RESTART IDENTITY CASCADE;');

  const seenKeys = new Set();
  let disambiguatedCount = 0;

  // Insert in batches
  const batchSize = 100;
  for (let i = 0; i < mongoWards.length; i += batchSize) {
    const chunk = mongoWards.slice(i, i + batchSize);
    
    for (const doc of chunk) {
      const province_slug = doc.ProvinceCodeName;
      const province_name = doc.tenTinh || '';
      let slug = doc.CodeName;
      const name = doc.Name || doc.tenXa || '';
      const ma_xa = doc.maXa || null;
      const ma_xa_bnv = doc.maXa_BNV || null;
      const area_km2 = Number(doc.dienTich) || 0;
      const population = parseInt(doc.danSo, 10) || 0;
      const resolution_no = doc.nghiQuyet || '';
      const merged_from = doc.ghiChu || '';
      let legacy_slugs = Array.isArray(doc.oldcodename) ? [...doc.oldcodename] : [];

      const key = `${province_slug}::${slug}`;
      if (seenKeys.has(key)) {
        disambiguatedCount++;
        legacy_slugs.push(slug);
        slug = `${slug}-${ma_xa_bnv || ma_xa || disambiguatedCount}`;
      }
      seenKeys.add(`${province_slug}::${slug}`);

      const lat = Number(doc.lat) || 0;
      const lon = Number(doc.lon) || 0;

      await pClient.query(`
        INSERT INTO wards_2025 (
          province_slug, province_name, slug, name, ma_xa, ma_xa_bnv,
          area_km2, population, resolution_no, merged_from, legacy_slugs,
          lat, lon, geom
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          ST_SetSRID(ST_MakePoint($13, $12), 4326)
        )
      `, [
        province_slug, province_name, slug, name, ma_xa, ma_xa_bnv,
        area_km2, population, resolution_no, merged_from, legacy_slugs,
        lat, lon
      ]);
    }

    if ((i + chunk.length) % 500 === 0 || i + chunk.length === mongoWards.length) {
      console.log(`Inserted ${i + chunk.length} / ${mongoWards.length} wards...`);
    }
  }

  const wRes = await pClient.query('SELECT COUNT(*) FROM wards_2025;');
  console.log(`Disambiguated duplicate slugs: ${disambiguatedCount}`);
  console.log(`wards_2025 total row count: ${wRes.rows[0].count}`);

  await mClient.close();
  await pClient.end();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
