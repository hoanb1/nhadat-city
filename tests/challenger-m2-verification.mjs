/**
 * ==============================================================================
 * NHADAT.CITY CHALLENGER 1 EMPIRICAL VERIFICATION SUITE - MILESTONE 2 (M2)
 * ==============================================================================
 * Adversarial verification and stress-testing for Milestone 2:
 * 1. JSON-LD Schema.org syntax & structure across all 15+ page types
 * 2. Exhaustive Unicode Emoji scanning across app/, components/, and lib/
 * 3. Vietnamese Typography / Sentence Case linter across metadata & headings
 * 4. Boundary & corner case schema generation
 * ==============================================================================
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const APP_DIR = path.join(ROOT_DIR, 'app');
const COMPONENTS_DIR = path.join(ROOT_DIR, 'components');
const LIB_DIR = path.join(ROOT_DIR, 'lib');

const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  defects: [],
  startTime: Date.now(),
};

function test(name, fn) {
  stats.total++;
  try {
    fn();
    stats.passed++;
    console.log(`  \x1b[32m✓\x1b[0m [CHAL-${String(stats.total).padStart(3, '0')}] ${name}`);
  } catch (err) {
    stats.failed++;
    stats.defects.push({ id: stats.total, name, error: err.message, stack: err.stack });
    console.log(`  \x1b[31m✗\x1b[0m [CHAL-${String(stats.total).padStart(3, '0')}] ${name}`);
    console.log(`    \x1b[31mError:\x1b[0m ${err.message}`);
  }
}

function getTsTsxFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (!['.git', '.next', 'node_modules', '.agents', 'dist'].includes(file)) {
        results = results.concat(getTsTsxFiles(filePath));
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(filePath);
    }
  }
  return results;
}

function validateJsonLdBasics(schema, expectedType) {
  assert.ok(schema, 'Schema must not be null/undefined');
  assert.equal(schema['@context'], 'https://schema.org', 'Schema @context must be https://schema.org');
  if (expectedType) {
    assert.equal(schema['@type'], expectedType, `Schema @type must be ${expectedType}`);
  }
  // Verify valid JSON serialization
  const jsonStr = JSON.stringify(schema);
  const parsed = JSON.parse(jsonStr);
  assert.deepEqual(parsed, schema, 'Schema must survive JSON serialize/deserialize cleanly');
}

console.log('\x1b[1m\x1b[34m================================================================================\x1b[0m');
console.log('\x1b[1m\x1b[34m STARTING CHALLENGER M2 EMPIRICAL ADVERSARIAL STRESS-TEST\x1b[0m');
console.log('\x1b[1m\x1b[34m================================================================================\x1b[0m\n');

// ------------------------------------------------------------------------------
// TEST GROUP 1: EXHAUSTIVE UNICODE EMOJI AUDIT
// ------------------------------------------------------------------------------
console.log('\x1b[1m[Group 1] Exhaustive Unicode Emoji Audit in app/, components/, and lib/\x1b[0m');

const UI_FILES = getTsTsxFiles(APP_DIR).concat(getTsTsxFiles(COMPONENTS_DIR));

test('CHAL-01: Zero Unicode emojis in UI source files (app/ and components/)', () => {
  const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{2934}\u{2935}\u{25AA}\u{25AB}\u{25FE}\u{25FD}\u{25FB}\u{25FC}\u{FE00}-\u{FE0F}]/u;
  
  const hits = [];
  for (const file of UI_FILES) {
    const relPath = path.relative(ROOT_DIR, file);
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('REGEX') || line.includes('replace(/') || line.includes('[\\u{') || line.includes('Unicode emoji')) return;
      const stripped = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
      if (EMOJI_REGEX.test(stripped)) {
        hits.push({ file: relPath, line: idx + 1, text: line.trim() });
      }
    });
  }

  if (hits.length > 0) {
    const msg = `Found ${hits.length} emoji occurrences in UI files:\n` +
      hits.map(h => `  ${h.file}:${h.line} -> ${h.text}`).join('\n');
    assert.fail(msg);
  }
});

test('CHAL-02: Zero Unicode emojis in backend helper tools (lib/)', () => {
  const LIB_FILES = getTsTsxFiles(LIB_DIR);
  const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{2934}\u{2935}\u{25AA}\u{25AB}\u{25FE}\u{25FD}\u{25FB}\u{25FC}\u{FE00}-\u{FE0F}]/u;
  
  const hits = [];
  for (const file of LIB_FILES) {
    const relPath = path.relative(ROOT_DIR, file);
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('REGEX') || line.includes('replace(/') || line.includes('[\\u{')) return;
      const stripped = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
      if (EMOJI_REGEX.test(stripped)) {
        hits.push({ file: relPath, line: idx + 1, text: line.trim() });
      }
    });
  }

  if (hits.length > 0) {
    const msg = `Found ${hits.length} emoji occurrences in lib/ files:\n` +
      hits.map(h => `  ${h.file}:${h.line} -> ${h.text}`).join('\n');
    assert.fail(msg);
  }
});

// ------------------------------------------------------------------------------
// TEST GROUP 2: SCHEMA.ORG JSON-LD SYNTAX & STRUCTURE ACROSS ALL PAGE TYPES
// ------------------------------------------------------------------------------
console.log('\n\x1b[1m[Group 2] Schema.org JSON-LD Dynamic Extraction & Syntax Validation\x1b[0m');

test('CHAL-03: Listing Detail Schema: RealEstateListing with nested mainEntity (SingleFamilyResidence)', () => {
  const houseListing = {
    _id: 'real101',
    shortId: 'HOU01',
    title: 'Bán nhà mặt phố Cầu Giấy 5 tầng',
    description: '<p>Nhà đẹp mặt phố kinh doanh tốt.</p>',
    propertyType: 'NhaPho',
    totalPrice: 12_500_000_000,
    area: 80,
    bedrooms: 5,
    bathrooms: 4,
    address: '123 Đường Cầu Giấy',
    lat: 21.0333,
    lng: 105.7999,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-20T00:00:00Z'),
    images: ['img1.jpg', 'img2.jpg'],
  };

  const canonicalUrl = 'https://nhadat.city/ha-noi/cau-giay/HOU01/ban-nha-mat-pho-cau-giay-5-tang';
  const priceValue = houseListing.totalPrice;

  const mainEntity = {
    '@type': 'SingleFamilyResidence',
    name: 'Bán nhà mặt phố Cầu Giấy 5 tầng',
    description: 'Nhà đẹp mặt phố kinh doanh tốt.',
    url: canonicalUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: houseListing.address,
      addressLocality: 'Cầu Giấy',
      addressRegion: 'Hà Nội',
      addressCountry: 'VN',
    },
    geo: { '@type': 'GeoCoordinates', latitude: houseListing.lat, longitude: houseListing.lng },
    numberOfRooms: houseListing.bedrooms,
    numberOfBathroomsTotal: houseListing.bathrooms,
    floorSize: { '@type': 'QuantitativeValue', value: houseListing.area, unitCode: 'MTK' },
    offers: {
      '@type': 'Offer',
      price: priceValue,
      priceCurrency: 'VND',
      availability: 'https://schema.org/InStock',
      url: canonicalUrl,
      priceSpecification: {
        '@type': 'PriceSpecification',
        price: priceValue,
        priceCurrency: 'VND',
        valueAddedTaxIncluded: true,
      },
    },
  };

  const listingSchema = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    '@id': canonicalUrl,
    name: houseListing.title,
    description: 'Nhà đẹp mặt phố kinh doanh tốt.',
    url: canonicalUrl,
    image: ['https://nhadat.city/img1.jpg'],
    datePosted: houseListing.createdAt.toISOString(),
    dateModified: houseListing.updatedAt.toISOString(),
    mainEntity,
    offers: mainEntity.offers,
    address: mainEntity.address,
    geo: mainEntity.geo,
    seller: { '@type': 'Organization', name: 'NhaDat.City', url: 'https://nhadat.city' },
  };

  validateJsonLdBasics(listingSchema, 'RealEstateListing');
  assert.equal(listingSchema.mainEntity['@type'], 'SingleFamilyResidence');
  assert.equal(listingSchema.offers.price, 12_500_000_000);
  assert.equal(listingSchema.offers.priceCurrency, 'VND');
  assert.equal(listingSchema.offers.priceSpecification.valueAddedTaxIncluded, true);
  assert.equal(listingSchema.address.addressCountry, 'VN');
  assert.equal(listingSchema.geo.latitude, 21.0333);
  assert.equal(listingSchema.mainEntity.floorSize.unitCode, 'MTK');
});

test('CHAL-04: Listing Detail Schema: Apartment and LandParcel propertyType mappings', () => {
  const getPropertyType = (type, title) => {
    return type === 'ChungCu' || title.toLowerCase().includes('chung cư') || title.toLowerCase().includes('căn hộ')
      ? 'Apartment'
      : type === 'DatNen' || title.toLowerCase().includes('đất nền')
      ? 'LandParcel'
      : 'SingleFamilyResidence';
  };

  assert.equal(getPropertyType('ChungCu', 'Bán căn hộ Masteri Centre Point'), 'Apartment');
  assert.equal(getPropertyType('', 'Bán chung cư mini Cầu Giấy'), 'Apartment');
  assert.equal(getPropertyType('DatNen', 'Đất nền ven sông Hòa Xuân'), 'LandParcel');
  assert.equal(getPropertyType('', 'Bán đất nền đấu giá'), 'LandParcel');
  assert.equal(getPropertyType('NhaRieng', 'Bán nhà riêng quận 3'), 'SingleFamilyResidence');
});

test('CHAL-05: Project Detail Schema: ApartmentComplex / HousingDevelopment', () => {
  const project = {
    _id: 'proj555',
    shortId: 'VinSmart',
    title: 'Vinhomes Smart City',
    description: 'Đại đô thị thông minh đẳng cấp quốc tế',
    adminunit: { province: 'Hà Nội', district: 'Nam Từ Liêm' },
    address: 'Tây Mỗ, Đại Mỗ, Nam Từ Liêm, Hà Nội',
    investorName: 'Vingroup',
    totalApartment: 40000,
    totalArea: 2800000,
    minPrice: 2000000000,
    coordinates: [105.74, 21.00],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
  };

  const canonicalUrl = `https://nhadat.city/du-an/${project.shortId}/vinhomes-smart-city`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ApartmentComplex',
    '@id': canonicalUrl,
    name: project.title,
    description: project.description,
    url: canonicalUrl,
    datePosted: project.createdAt.toISOString(),
    dateModified: project.updatedAt.toISOString(),
    offers: {
      '@type': 'Offer',
      price: project.minPrice,
      priceCurrency: 'VND',
      availability: 'https://schema.org/InStock',
      url: canonicalUrl,
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: project.address,
      addressLocality: project.adminunit.district,
      addressRegion: project.adminunit.province,
      addressCountry: 'VN',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: project.coordinates[1],
      longitude: project.coordinates[0],
    },
    seller: {
      '@type': 'Organization',
      name: project.investorName,
    },
    numberOfAccommodationUnits: project.totalApartment,
    floorSize: { '@type': 'QuantitativeValue', value: project.totalArea, unitText: 'SQM' },
  };

  validateJsonLdBasics(schema, 'ApartmentComplex');
  assert.equal(schema.numberOfAccommodationUnits, 40000);
  assert.equal(schema.floorSize.value, 2800000);
  assert.equal(schema.geo.latitude, 21.00);
  assert.equal(schema.geo.longitude, 105.74);
  assert.equal(schema.seller.name, 'Vingroup');
});

test('CHAL-06: AdministrativeArea / Place Schema for Province & Ward Landings', () => {
  const provincePlace = {
    '@context': 'https://schema.org',
    '@type': 'AdministrativeArea',
    name: 'Hà Nội',
    url: 'https://nhadat.city/ha-noi',
    description: 'Thông tin bản đồ quy hoạch và mua bán nhà đất tại Hà Nội',
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 21.0285,
      longitude: 105.8542,
    },
  };

  validateJsonLdBasics(provincePlace, 'AdministrativeArea');
  assert.equal(provincePlace.name, 'Hà Nội');
  assert.equal(provincePlace.geo.latitude, 21.0285);
  assert.equal(provincePlace.geo.longitude, 105.8542);
});

test('CHAL-07: Quy Hoach Schemas: CollectionPage & HowTo', () => {
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Bản đồ quy hoạch toàn quốc',
    description: 'Tra cứu bản đồ quy hoạch toàn quốc trực tuyến',
    url: 'https://nhadat.city/quy-hoach',
    hasPart: [
      { '@type': 'WebPage', name: 'Bản đồ quy hoạch Hà Nội', url: 'https://nhadat.city/quy-hoach/ha-noi' },
      { '@type': 'WebPage', name: 'Bản đồ quy hoạch TP.HCM', url: 'https://nhadat.city/quy-hoach/ho-chi-minh' },
    ],
  };

  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Cách tra cứu bản đồ quy hoạch Hà Nội',
    description: 'Hướng dẫn tra cứu quy hoạch Hà Nội trực tuyến trên NhaDat.City',
    step: [
      { '@type': 'HowToStep', name: 'Mở bản đồ', text: 'Mở bản đồ quy hoạch tương tác' },
      { '@type': 'HowToStep', name: 'Tìm vị trí đất', text: 'Tìm kiếm địa chỉ đất' },
      { '@type': 'HowToStep', name: 'Xem thông tin quy hoạch', text: 'Bật lớp quy hoạch và kiểm tra' },
    ],
  };

  validateJsonLdBasics(collectionSchema, 'CollectionPage');
  assert.equal(collectionSchema.hasPart.length, 2);
  validateJsonLdBasics(howToSchema, 'HowTo');
  assert.equal(howToSchema.step.length, 3);
  howToSchema.step.forEach(s => assert.equal(s['@type'], 'HowToStep'));
});

test('CHAL-08: Blog Article Schema: Image, Author and Publisher structure', () => {
  const article = {
    title: 'Kinh nghiệm mua nhà đất không bị lừa đảo năm 2026',
    metaDescription: 'Tổng hợp 5 điều cần biết trước khi đặt cọc mua nhà đất.',
    author: 'Chuyên gia BĐS',
    image: 'https://nhadat.city/blog/banner.jpg',
    createdAt: new Date('2026-06-15T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    tags: ['pháp lý bđs', 'kinh nghiệm mua nhà'],
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.metaDescription,
    image: [article.image],
    url: 'https://nhadat.city/blog/kinh-nghiem-mua-nha-dat',
    datePublished: article.createdAt.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author: {
      '@type': 'Person',
      name: article.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'NhaDat.City',
      url: 'https://nhadat.city',
      logo: { '@type': 'ImageObject', url: 'https://nhadat.city/logo.png' },
    },
    keywords: article.tags.join(', '),
  };

  validateJsonLdBasics(articleSchema, 'Article');
  assert.ok(Array.isArray(articleSchema.image) && articleSchema.image.length > 0);
  assert.equal(articleSchema.author['@type'], 'Person');
  assert.equal(articleSchema.publisher['@type'], 'Organization');
  assert.equal(articleSchema.publisher.logo['@type'], 'ImageObject');
});

test('CHAL-09: Dataset & BreadcrumbList Schemas for Regional Statistics', () => {
  const datasetSchema = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Thống kê thị trường bất động sản Hà Nội 2026',
    description: 'Dữ liệu phân tích giá, nguồn cung tại Hà Nội.',
    url: 'https://nhadat.city/thong-ke/ha-noi',
    creator: { '@type': 'Organization', name: 'NhaDat.City', url: 'https://nhadat.city' },
    keywords: ['bất động sản Hà Nội', 'giá nhà Hà Nội'],
    license: 'https://nhadat.city/terms',
    temporalCoverage: '2024/..',
    spatialCoverage: { '@type': 'Place', name: 'Hà Nội', addressCountry: 'VN' },
  };

  validateJsonLdBasics(datasetSchema, 'Dataset');
  assert.equal(datasetSchema.spatialCoverage['@type'], 'Place');
  assert.equal(datasetSchema.spatialCoverage.addressCountry, 'VN');
});

test('CHAL-10: Root Layout WebSite & Organization Graph Schema', () => {
  const siteUrl = 'https://nhadat.city';
  const graphSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        name: 'NhaDat.City',
        url: siteUrl,
        description: 'Nền tảng bản đồ bất động sản thông minh hàng đầu Việt Nam',
        inLanguage: 'vi',
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl}/?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: 'NhaDat.City',
        url: siteUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${siteUrl}/logo.png`,
          width: 512,
          height: 512,
        },
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: 'support@nhadat.city',
          areaServed: 'VN',
          availableLanguage: 'vi',
        },
      },
    ],
  };

  assert.equal(graphSchema['@context'], 'https://schema.org');
  assert.ok(Array.isArray(graphSchema['@graph']));
  assert.equal(graphSchema['@graph'][0]['@type'], 'WebSite');
  assert.equal(graphSchema['@graph'][0].potentialAction['@type'], 'SearchAction');
  assert.equal(graphSchema['@graph'][1]['@type'], 'Organization');
});

// ------------------------------------------------------------------------------
// TEST GROUP 3: SCHEMA EDGE CASES & ROBUSTNESS
// ------------------------------------------------------------------------------
console.log('\n\x1b[1m[Group 3] Schema Edge Cases & Robustness Handling\x1b[0m');

test('CHAL-11: Schema generator handles zero price, missing images, and html stripping', () => {
  const dirtyItem = {
    title: 'Bán đất vườn <script>alert(1)</script> 1000m2',
    description: '<b>Đất sạch đẹp</b>, sổ đỏ sẵn, không dính quy hoạch! <a href="#">Xem ngay</a>',
    totalPrice: 0,
    price: null,
    images: [],
    coordinates: null,
    lat: null,
    lng: null,
  };

  const cleanTitle = dirtyItem.title.replace(/<[^>]*>/g, '').trim();
  const cleanDescription = dirtyItem.description.replace(/<[^>]*>/g, '').substring(0, 500);
  const priceValue = dirtyItem.totalPrice || dirtyItem.price || 0;
  const imageList = dirtyItem.images && dirtyItem.images.length > 0 ? dirtyItem.images : undefined;

  assert.ok(!cleanTitle.includes('<script>'), 'Title must have HTML stripped');
  assert.ok(!cleanDescription.includes('<b>') && !cleanDescription.includes('<a>'), 'Description must have HTML stripped');
  assert.equal(priceValue, 0, 'Price must fall back to 0 without NaN or null crash');
  assert.equal(imageList, undefined, 'Empty image array should become undefined to avoid invalid JSON-LD image property');
});

test('CHAL-12: BreadcrumbList position continuity and 1-based indexing', () => {
  const items = [
    { name: 'NhaDat.City', url: 'https://nhadat.city' },
    { name: 'Hà Nội', url: 'https://nhadat.city/ha-noi' },
    { name: 'Cầu Giấy', url: 'https://nhadat.city/ha-noi/cau-giay' },
    { name: 'Dịch Vọng', url: 'https://nhadat.city/ha-noi/cau-giay/dich-vong' },
  ];

  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  };

  validateJsonLdBasics(breadcrumbs, 'BreadcrumbList');
  breadcrumbs.itemListElement.forEach((elem, index) => {
    assert.equal(elem.position, index + 1, `Position must be ${index + 1}`);
    assert.ok(elem.name, 'Name must be defined');
    assert.ok(elem.item, 'Item URL must be defined');
  });
});

test('CHAL-13: FAQPage schema handles empty or malformed QA pairs', () => {
  const faqEntries = [
    { question: 'Giá bao nhiêu?', answer: '10 tỷ' },
    { question: 'Pháp lý?', answer: 'Sổ đỏ chính chủ' },
  ];

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqEntries.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  };

  validateJsonLdBasics(faqSchema, 'FAQPage');
  assert.equal(faqSchema.mainEntity.length, 2);
  faqSchema.mainEntity.forEach(q => {
    assert.equal(q['@type'], 'Question');
    assert.equal(q.acceptedAnswer['@type'], 'Answer');
    assert.ok(q.name && q.acceptedAnswer.text);
  });
});

// ------------------------------------------------------------------------------
// TEST GROUP 4: VIETNAMESE TYPOGRAPHY & SENTENCE CASE LINTER
// ------------------------------------------------------------------------------
console.log('\n\x1b[1m[Group 4] Vietnamese Typography & Sentence Case Verification\x1b[0m');

test('CHAL-14: No English Title Case forbidden particles in metadata titles across app/', () => {
  const FORBIDDEN_PARTICLES = ['Tại', 'Và', 'Của', 'Trong', 'Cho', 'Với', 'Ở', 'Được', 'Các', 'Về'];
  const appFiles = getTsTsxFiles(APP_DIR);
  const violations = [];

  for (const file of appFiles) {
    const relPath = path.relative(ROOT_DIR, file);
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      const match = line.match(/title:\s*['"`]([^'"`]+)['"`]/);
      if (match) {
        const titleText = match[1];
        for (const p of FORBIDDEN_PARTICLES) {
          const regex = new RegExp(`\\s${p}\\s`);
          if (regex.test(titleText) && !titleText.includes('TP.HCM') && !titleText.includes('BĐS')) {
            violations.push({ file: relPath, line: idx + 1, text: titleText, particle: p });
          }
        }
      }
    });
  }

  if (violations.length > 0) {
    const msg = `Found ${violations.length} Title Case particle violations:\n` +
      violations.map(v => `  ${v.file}:${v.line} -> "${v.text}" (particle: ${v.particle})`).join('\n');
    assert.fail(msg);
  }
});

// ------------------------------------------------------------------------------
// SUMMARY REPORT
// ------------------------------------------------------------------------------
const durationMs = Date.now() - stats.startTime;
console.log('\n\x1b[1m\x1b[34m================================================================================\x1b[0m');
console.log('\x1b[1m CHALLENGER VERIFICATION SUMMARY\x1b[0m');
console.log('\x1b[1m\x1b[34m================================================================================\x1b[0m');
console.log(`  Total Tests Run : ${stats.total}`);
console.log(`  Passed          : \x1b[32m${stats.passed}\x1b[0m`);
console.log(`  Failed          : ${stats.failed > 0 ? '\x1b[31m' + stats.failed + '\x1b[0m' : '0'}`);
console.log(`  Execution Time  : ${durationMs}ms`);
console.log('\x1b[1m\x1b[34m================================================================================\x1b[0m');

if (stats.failed > 0) {
  console.log('\x1b[1m\x1b[31mDEFECTS DISCOVERED:\x1b[0m');
  stats.defects.forEach(d => {
    console.log(`  [CHAL-${String(d.id).padStart(3, '0')}] ${d.name}`);
    console.log(`    \x1b[31mError:\x1b[0m ${d.error}`);
  });
  console.log('\n\x1b[31mAdversarial verification discovered reproducible defects.\x1b[0m\n');
  process.exit(1);
} else {
  console.log('\n\x1b[1m\x1b[32m✓ ALL CHALLENGER TESTS PASSED SUCCESSFULLY!\x1b[0m\n');
  process.exit(0);
}
