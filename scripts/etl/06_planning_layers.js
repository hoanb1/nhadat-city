/**
 * ETL Script: Task 8 - Populate planning_layers (all 32 documents from mapLayers)
 */
const { MongoClient } = require('mongodb');
const { Client } = require('pg');

const MONGO_URI = require('./_env').need('MONGODB_URI');
const PG_URI = require('./_env').need('DATABASE_URL');

function inferProvince(name, url) {
  const text = `${name || ''} ${url || ''}`.toLowerCase();
  if (text.includes('hanoi') || text.includes('hà nội')) return 'ha-noi';
  if (text.includes('hcm') || text.includes('hồ chí minh') || text.includes('hóc môn')) return 'ho-chi-minh';
  if (text.includes('binhduong') || text.includes('bình dương')) return 'ho-chi-minh';
  if (text.includes('vungtau') || text.includes('vũng tàu')) return 'ho-chi-minh';
  if (text.includes('binhphuoc') || text.includes('bình phước')) return 'dong-nai';
  if (text.includes('danang') || text.includes('đà nẵng')) return 'da-nang';
  if (text.includes('cantho') || text.includes('cần thơ')) return 'can-tho';
  if (text.includes('hungyen') || text.includes('hưng yên')) return 'hung-yen';
  if (text.includes('bacgiang') || text.includes('bắc giang')) return 'bac-ninh';
  if (text.includes('khanhhoa') || text.includes('khánh hòa')) return 'khanh-hoa';
  if (text.includes('longan') || text.includes('long an')) return 'tay-ninh';
  if (text.includes('ninhbinh') || text.includes('ninh bình')) return 'ninh-binh';
  return 'toan-quoc';
}

function inferLayerType(name, url) {
  const text = `${name || ''} ${url || ''}`.toLowerCase();
  if (text.includes('satellite') || text.includes('google map') || text.includes('open street')) return 've-tinh';
  if (text.includes('ranhthua') || text.includes('thửa đất') || text.includes('goonranh')) return 'ranh-thua';
  if (text.includes('adminunit') || text.includes('địa giới') || text.includes('địa chính')) return 'hanh-chinh';
  return 'quy-hoach';
}

async function run() {
  const mClient = new MongoClient(MONGO_URI);
  await mClient.connect();
  const db = mClient.db();

  const pClient = new Client({ connectionString: PG_URI });
  await pClient.connect();

  console.log('=== Step 8: Populating planning_layers ===');
  const mongoLayers = await db.collection('mapLayers').find().toArray();
  console.log(`Fetched ${mongoLayers.length} layers from MongoDB mapLayers.`);

  await pClient.query('TRUNCATE TABLE planning_layers RESTART IDENTITY CASCADE;');

  for (const doc of mongoLayers) {
    const id = doc._id.toString();
    const name = doc.name || 'Lớp bản đồ';
    const tile_url = doc.url || '';
    const province_slug = inferProvince(name, tile_url);
    const layer_type = inferLayerType(name, tile_url);
    const format = doc.format || 'raster';
    const min_zoom = typeof doc.zoomMin === 'number' ? doc.zoomMin : 0;
    const max_zoom = typeof doc.zoomMax === 'number' ? doc.zoomMax : 22;
    const bbox = JSON.stringify(doc.boundingBox || {});
    const active = doc.active !== false;

    await pClient.query(`
      INSERT INTO planning_layers (
        id, name, province_slug, layer_type, format,
        tile_url, min_zoom, max_zoom, bbox, active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        province_slug = EXCLUDED.province_slug,
        layer_type = EXCLUDED.layer_type,
        format = EXCLUDED.format,
        tile_url = EXCLUDED.tile_url,
        min_zoom = EXCLUDED.min_zoom,
        max_zoom = EXCLUDED.max_zoom,
        bbox = EXCLUDED.bbox,
        active = EXCLUDED.active;
    `, [
      id, name, province_slug, layer_type, format,
      tile_url, min_zoom, max_zoom, bbox, active
    ]);
  }

  const lRes = await pClient.query('SELECT COUNT(*) FROM planning_layers;');
  console.log(`planning_layers total row count: ${lRes.rows[0].count}`);

  await mClient.close();
  await pClient.end();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
