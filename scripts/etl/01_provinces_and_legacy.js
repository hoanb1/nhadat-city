/**
 * ETL Script: Tasks 1 & 2 - Populate provinces_2025 and legacy_provinces_63
 */
const { MongoClient } = require('mongodb');
const { Client } = require('pg');

const MONGO_URI = require('./_env').need('MONGODB_URI');
const PG_URI = require('./_env').need('DATABASE_URL');

// 63 Legacy Provinces definitions SSOT
const LEGACY_63_PROVINCES = [
  // Miền Bắc (25)
  { slug: 'ha-noi', name: 'Hà Nội', cm: 105.0, region: 'Miền Bắc', lat: 21.0285, lon: 105.8542 },
  { slug: 'ha-nam', name: 'Hà Nam', cm: 105.5, region: 'Miền Bắc', lat: 20.5835, lon: 105.9234 },
  { slug: 'hai-duong', name: 'Hải Dương', cm: 105.5, region: 'Miền Bắc', lat: 20.9373, lon: 106.3145 },
  { slug: 'hai-phong', name: 'Hải Phòng', cm: 105.75, region: 'Miền Bắc', lat: 20.8449, lon: 106.6881 },
  { slug: 'hung-yen', name: 'Hưng Yên', cm: 105.5, region: 'Miền Bắc', lat: 20.6464, lon: 106.0511 },
  { slug: 'nam-dinh', name: 'Nam Định', cm: 106.0, region: 'Miền Bắc', lat: 20.4382, lon: 106.1783 },
  { slug: 'ninh-binh', name: 'Ninh Bình', cm: 105.75, region: 'Miền Bắc', lat: 20.2506, lon: 105.9745 },
  { slug: 'thai-binh', name: 'Thái Bình', cm: 106.5, region: 'Miền Bắc', lat: 20.4463, lon: 106.3365 },
  { slug: 'vinh-phuc', name: 'Vĩnh Phúc', cm: 105.0, region: 'Miền Bắc', lat: 21.3609, lon: 105.5474 },
  { slug: 'bac-giang', name: 'Bắc Giang', cm: 107.0, region: 'Miền Bắc', lat: 21.2731, lon: 106.1946 },
  { slug: 'bac-kan', name: 'Bắc Kạn', cm: 105.75, region: 'Miền Bắc', lat: 22.1470, lon: 105.8348 },
  { slug: 'cao-bang', name: 'Cao Bằng', cm: 105.75, region: 'Miền Bắc', lat: 22.6663, lon: 106.2573 },
  { slug: 'ha-giang', name: 'Hà Giang', cm: 105.0, region: 'Miền Bắc', lat: 22.8233, lon: 104.9839 },
  { slug: 'lang-son', name: 'Lạng Sơn', cm: 107.25, region: 'Miền Bắc', lat: 21.8537, lon: 106.7615 },
  { slug: 'phu-tho', name: 'Phú Thọ', cm: 104.75, region: 'Miền Bắc', lat: 21.3228, lon: 105.2280 },
  { slug: 'quang-ninh', name: 'Quảng Ninh', cm: 107.75, region: 'Miền Bắc', lat: 21.0069, lon: 107.2925 },
  { slug: 'thai-nguyen', name: 'Thái Nguyên', cm: 105.75, region: 'Miền Bắc', lat: 21.5674, lon: 105.8252 },
  { slug: 'tuyen-quang', name: 'Tuyên Quang', cm: 105.0, region: 'Miền Bắc', lat: 21.8238, lon: 105.2180 },
  { slug: 'yen-bai', name: 'Yên Bái', cm: 104.75, region: 'Miền Bắc', lat: 21.7168, lon: 104.8974 },
  { slug: 'dien-bien', name: 'Điện Biên', cm: 103.0, region: 'Miền Bắc', lat: 21.3860, lon: 103.0230 },
  { slug: 'hoa-binh', name: 'Hòa Bình', cm: 105.0, region: 'Miền Bắc', lat: 20.8172, lon: 105.3376 },
  { slug: 'lai-chau', name: 'Lai Châu', cm: 103.0, region: 'Miền Bắc', lat: 22.3964, lon: 103.4582 },
  { slug: 'lao-cai', name: 'Lào Cai', cm: 104.0, region: 'Miền Bắc', lat: 22.4856, lon: 103.9707 },
  { slug: 'son-la', name: 'Sơn La', cm: 104.0, region: 'Miền Bắc', lat: 21.3283, lon: 103.9148 },
  { slug: 'bac-ninh', name: 'Bắc Ninh', cm: 105.5, region: 'Miền Bắc', lat: 21.1861, lon: 106.0763 },

  // Miền Trung & Tây Nguyên (19)
  { slug: 'thanh-hoa', name: 'Thanh Hóa', cm: 105.0, region: 'Miền Trung', lat: 19.8067, lon: 105.7852 },
  { slug: 'nghe-an', name: 'Nghệ An', cm: 104.75, region: 'Miền Trung', lat: 18.6734, lon: 105.6813 },
  { slug: 'ha-tinh', name: 'Hà Tĩnh', cm: 105.5, region: 'Miền Trung', lat: 18.3560, lon: 105.9000 },
  { slug: 'quang-binh', name: 'Quảng Bình', cm: 106.0, region: 'Miền Trung', lat: 17.4690, lon: 106.6225 },
  { slug: 'quang-tri', name: 'Quảng Trị', cm: 106.25, region: 'Miền Trung', lat: 16.8163, lon: 107.1004 },
  { slug: 'thua-thien-hue', name: 'Thừa Thiên Huế', cm: 107.0, region: 'Miền Trung', lat: 16.4637, lon: 107.5909 },
  { slug: 'da-nang', name: 'Đà Nẵng', cm: 107.75, region: 'Miền Trung', lat: 16.0544, lon: 108.2022 },
  { slug: 'quang-nam', name: 'Quảng Nam', cm: 107.75, region: 'Miền Trung', lat: 15.5394, lon: 108.0263 },
  { slug: 'quang-ngai', name: 'Quảng Ngãi', cm: 108.5, region: 'Miền Trung', lat: 15.1205, lon: 108.7923 },
  { slug: 'binh-dinh', name: 'Bình Định', cm: 108.25, region: 'Miền Trung', lat: 14.1667, lon: 109.0000 },
  { slug: 'phu-yen', name: 'Phú Yên', cm: 108.5, region: 'Miền Trung', lat: 13.0882, lon: 109.0929 },
  { slug: 'khanh-hoa', name: 'Khánh Hòa', cm: 108.25, region: 'Miền Trung', lat: 12.2388, lon: 109.1967 },
  { slug: 'ninh-thuan', name: 'Ninh Thuận', cm: 108.75, region: 'Miền Trung', lat: 11.6853, lon: 108.8974 },
  { slug: 'binh-thuan', name: 'Bình Thuận', cm: 108.5, region: 'Miền Trung', lat: 10.9333, lon: 108.1000 },
  { slug: 'kon-tum', name: 'Kon Tum', cm: 107.5, region: 'Tây Nguyên', lat: 14.3545, lon: 108.0076 },
  { slug: 'gia-lai', name: 'Gia Lai', cm: 108.5, region: 'Tây Nguyên', lat: 13.9833, lon: 108.0000 },
  { slug: 'dak-lak', name: 'Đắk Lắk', cm: 108.5, region: 'Tây Nguyên', lat: 12.6667, lon: 108.0500 },
  { slug: 'dak-nong', name: 'Đắk Nông', cm: 108.5, region: 'Tây Nguyên', lat: 12.0041, lon: 107.6875 },
  { slug: 'lam-dong', name: 'Lâm Đồng', cm: 107.75, region: 'Tây Nguyên', lat: 11.9404, lon: 108.4583 },

  // Miền Nam (19)
  { slug: 'ho-chi-minh', name: 'TP. Hồ Chí Minh', cm: 105.75, region: 'Miền Nam', lat: 10.8231, lon: 106.6297 },
  { slug: 'ba-ria-vung-tau', name: 'Bà Rịa - Vũng Tàu', cm: 107.5, region: 'Miền Nam', lat: 10.5420, lon: 107.2429 },
  { slug: 'binh-duong', name: 'Bình Dương', cm: 105.75, region: 'Miền Nam', lat: 11.1667, lon: 106.6667 },
  { slug: 'binh-phuoc', name: 'Bình Phước', cm: 106.25, region: 'Miền Nam', lat: 11.7512, lon: 106.9079 },
  { slug: 'dong-nai', name: 'Đồng Nai', cm: 107.75, region: 'Miền Nam', lat: 11.0500, lon: 107.1667 },
  { slug: 'tay-ninh', name: 'Tây Ninh', cm: 105.5, region: 'Miền Nam', lat: 11.3667, lon: 106.1167 },
  { slug: 'an-giang', name: 'An Giang', cm: 104.5, region: 'Miền Nam', lat: 10.5216, lon: 105.1259 },
  { slug: 'bac-lieu', name: 'Bạc Liêu', cm: 105.0, region: 'Miền Nam', lat: 9.2941, lon: 105.7278 },
  { slug: 'ben-tre', name: 'Bến Tre', cm: 105.75, region: 'Miền Nam', lat: 10.2433, lon: 106.3756 },
  { slug: 'ca-mau', name: 'Cà Mau', cm: 104.5, region: 'Miền Nam', lat: 9.1769, lon: 105.1500 },
  { slug: 'can-tho', name: 'Cần Thơ', cm: 105.0, region: 'Miền Nam', lat: 10.0452, lon: 105.7469 }, // Fixed to 105.0
  { slug: 'dong-thap', name: 'Đồng Tháp', cm: 105.0, region: 'Miền Nam', lat: 10.4500, lon: 105.6333 },
  { slug: 'hau-giang', name: 'Hậu Giang', cm: 105.5, region: 'Miền Nam', lat: 9.7844, lon: 105.4701 },
  { slug: 'kien-giang', name: 'Kiên Giang', cm: 104.5, region: 'Miền Nam', lat: 10.0139, lon: 105.0809 },
  { slug: 'long-an', name: 'Long An', cm: 105.75, region: 'Miền Nam', lat: 10.5366, lon: 106.4093 },
  { slug: 'soc-trang', name: 'Sóc Trăng', cm: 105.3, region: 'Miền Nam', lat: 9.6033, lon: 105.9800 },
  { slug: 'tien-giang', name: 'Tiền Giang', cm: 105.75, region: 'Miền Nam', lat: 10.4333, lon: 106.3333 },
  { slug: 'tra-vinh', name: 'Trà Vinh', cm: 105.5, region: 'Miền Nam', lat: 9.9347, lon: 106.3455 },
  { slug: 'vinh-long', name: 'Vĩnh Long', cm: 105.5, region: 'Miền Nam', lat: 10.2537, lon: 105.9722 },
];

async function run() {
  const mClient = new MongoClient(MONGO_URI);
  await mClient.connect();
  const db = mClient.db();

  const pClient = new Client({ connectionString: PG_URI });
  await pClient.connect();

  console.log('=== Step 1: Populating provinces_2025 ===');
  const mongoProvinces = await db.collection('province2025').find().toArray();
  console.log(`Fetched ${mongoProvinces.length} provinces from MongoDB province2025.`);

  const legacyToNewMap = new Map();

  for (const doc of mongoProvinces) {
    const slug = doc.CodeName;
    const name = doc.Name || doc.tenTinh || '';
    const ma_tinh = doc.maTinh || null;
    const ma_tinh_bnv = doc.maTinh_BNV || null;
    const area_km2 = Number(doc.dienTich) || 0;
    const population = parseInt(doc.danSo, 10) || 0;
    const merged_from = doc.tptinhtruo || '';
    const admin_center = doc.trungtamhc || '';
    const legacy_slugs = Array.isArray(doc.oldcodename) ? doc.oldcodename : [];
    const crs_proj4 = doc.CRS || '';

    // Central meridian extraction, fixing can-tho to 105.0
    let central_meridian = 105.0;
    if (slug === 'can-tho') {
      central_meridian = 105.0;
    } else if (crs_proj4) {
      const match = crs_proj4.match(/\+lon_0=([0-9.]+)/);
      if (match) central_meridian = parseFloat(match[1]);
    }

    const lat = Number(doc.lat) || 21.0285;
    const lon = Number(doc.lon) || 105.8542;

    // Track legacy mapping
    for (const old of legacy_slugs) {
      legacyToNewMap.set(old, slug);
    }
    legacyToNewMap.set(slug, slug);

    await pClient.query(`
      INSERT INTO provinces_2025 (
        slug, name, ma_tinh, ma_tinh_bnv, area_km2, population,
        merged_from, admin_center, legacy_slugs, crs_proj4, central_meridian,
        lat, lon, geom
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        ST_SetSRID(ST_MakePoint($13, $12), 4326)
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        ma_tinh = EXCLUDED.ma_tinh,
        ma_tinh_bnv = EXCLUDED.ma_tinh_bnv,
        area_km2 = EXCLUDED.area_km2,
        population = EXCLUDED.population,
        merged_from = EXCLUDED.merged_from,
        admin_center = EXCLUDED.admin_center,
        legacy_slugs = EXCLUDED.legacy_slugs,
        crs_proj4 = EXCLUDED.crs_proj4,
        central_meridian = EXCLUDED.central_meridian,
        lat = EXCLUDED.lat,
        lon = EXCLUDED.lon,
        geom = EXCLUDED.geom;
    `, [
      slug, name, ma_tinh, ma_tinh_bnv, area_km2, population,
      merged_from, admin_center, legacy_slugs, crs_proj4, central_meridian,
      lat, lon
    ]);
  }

  const pRes = await pClient.query('SELECT COUNT(*) FROM provinces_2025;');
  console.log(`provinces_2025 row count: ${pRes.rows[0].count}`);

  console.log('=== Step 2: Populating legacy_provinces_63 ===');
  for (const prov of LEGACY_63_PROVINCES) {
    const slug = prov.slug;
    const name = prov.name;
    const cm = (slug === 'can-tho') ? 105.0 : prov.cm;
    const new_province_slug = legacyToNewMap.get(slug) || (slug === 'thua-thien-hue' ? 'hue' : slug);
    const epsg_6deg = (cm >= 108.0) ? 3406 : 3405;
    const epsg_3deg = (cm === 108.0 || cm === 108.25 || cm === 108.5 || cm === 108.75) ? 5898 :
                      (cm === 103.0 || cm === 104.0 || cm === 104.5 || cm === 104.75) ? 5896 : 5897;

    await pClient.query(`
      INSERT INTO legacy_provinces_63 (
        slug, name, new_province_slug, central_meridian,
        epsg_3deg, epsg_6deg, region, lat, lon
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        new_province_slug = EXCLUDED.new_province_slug,
        central_meridian = EXCLUDED.central_meridian,
        epsg_3deg = EXCLUDED.epsg_3deg,
        epsg_6deg = EXCLUDED.epsg_6deg,
        region = EXCLUDED.region,
        lat = EXCLUDED.lat,
        lon = EXCLUDED.lon;
    `, [slug, name, new_province_slug, cm, epsg_3deg, epsg_6deg, prov.region, prov.lat, prov.lon]);
  }

  const lRes = await pClient.query('SELECT COUNT(*) FROM legacy_provinces_63;');
  console.log(`legacy_provinces_63 row count: ${lRes.rows[0].count}`);

  await mClient.close();
  await pClient.end();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
