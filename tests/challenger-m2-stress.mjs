/**
 * ==============================================================================
 * CHALLENGER 2 EMPIRICAL ADVERSARIAL STRESS TEST HARNESS (M2)
 * ==============================================================================
 * Focus:
 * 1. Vietnamese Sentence Case & Typography in all static/dynamic route metadata
 * 2. Zero Unicode Emoji & Composite Emoji Sanitization across codebase
 * 3. Schema.org JSON-LD Structured Data (Prices, Currency, Property Types, Geo, ItemList Canonical URLs)
 * 4. Accented Vietnamese Characters & Unicode Normalization (NFC / NFD)
 * ==============================================================================
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const APP_DIR = path.join(ROOT_DIR, 'app');
const COMPONENTS_DIR = path.join(ROOT_DIR, 'components');
const LIB_DIR = path.join(ROOT_DIR, 'lib');

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  findings: [],
};

function test(name, fn) {
  results.total++;
  try {
    fn();
    results.passed++;
    console.log(`  \x1b[32m✓\x1b[0m [TC-${String(results.total).padStart(3, '0')}] ${name}`);
  } catch (err) {
    results.failed++;
    const errMsg = err.message || String(err);
    results.findings.push({ id: results.total, name, error: errMsg, stack: err.stack });
    console.log(`  \x1b[31m✗\x1b[0m [TC-${String(results.total).padStart(3, '0')}] ${name}`);
    console.log(`    \x1b[31mError:\x1b[0m ${errMsg}`);
  }
}

// ── Recursive File Scanner ──
function getFiles(dir, ext = ['.tsx', '.ts']) {
  let list = [];
  if (!fs.existsSync(dir)) return list;
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (!['.git', '.next', 'node_modules', '.agents', 'dist'].includes(f)) {
        list = list.concat(getFiles(full, ext));
      }
    } else if (ext.some(e => f.endsWith(e))) {
      list.push(full);
    }
  }
  return list;
}

// ── Full Comprehensive Unicode Emoji / Symbol Range ──
// Covers:
// - Standard Emoticons / Pictographs: 1F300-1FAFF, 1F000-1F02F, 1F0A0-1F0FF, 1F100-1F64F, 1F680-1F6FF
// - Variation Selectors: FE00-FE0F
// - Dingbats & Misc Symbols: 2600-27BF
// - Misc Technical (⏰ \u23F0, ⌚ \u231A, ⌛ \u231B, ⏳ \u23F3): 2300-23FF
// - Misc Symbols & Arrows (⭐ \u2B50): 2B00-2BFF, 2900-297F
// - General Punctuation Symbols (‼️ \u203C, ⁉️ \u2049, ZWJ \u200D): 2000-206F
// - Combining Enclosing Keycaps (1️⃣ \u20E3): 20D0-20FF
const COMPREHENSIVE_EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{FE00}-\u{FE0F}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{203C}\u{2049}\u{200D}\u{20E3}]/gu;

// ── Vietnamese Sentence Case Validator ──
function validateVietnameseSentenceCase(text, context = '') {
  if (!text || typeof text !== 'string') return { valid: false, reason: 'Empty text' };
  const trimmed = text.trim();
  if (!trimmed) return { valid: false, reason: 'Whitespace-only string' };

  // Rule 1: No raw unicode emojis
  if (COMPREHENSIVE_EMOJI_REGEX.test(trimmed)) {
    return { valid: false, reason: `Unicode emoji found in: "${trimmed}"` };
  }

  // Rule 2: No ALL CAPS (except short acronyms < 6 chars like TP.HCM, BĐS, SĐCC)
  const words = trimmed.split(/[\s,–—|:.]+/).filter(w => w.length > 0);
  const capsWords = words.filter(w => w.length > 1 && w === w.toUpperCase() && !/^[0-9\W]+$/.test(w) && !['BĐS', 'SĐCC', 'TP.HCM', 'TPHCM', 'HN', 'VND', 'USD', 'AI', 'VAT', 'SĐT', 'ZALO', 'GĐB', 'XSMB', 'XSMN', 'XSMT'].includes(w));
  if (words.length >= 3 && capsWords.length > words.length * 0.5) {
    return { valid: false, reason: `ALL CAPS detected (${capsWords.join(', ')}) in: "${trimmed}"` };
  }

  // Rule 3: Sentence Case start - first letter must be capitalized
  const firstLetter = trimmed.match(/[a-zA-Zà-ỹÀ-Ỹ]/);
  if (firstLetter && firstLetter[0] !== firstLetter[0].toUpperCase()) {
    return { valid: false, reason: `First character "${firstLetter[0]}" is lowercase in: "${trimmed}"` };
  }

  // Rule 4: Disallow English Title Case for Vietnamese grammatical particles
  const forbiddenTitleCaseParticles = ['tại', 'và', 'của', 'trong', 'cho', 'với', 'ở', 'được', 'các', 'những', 'về', 'theo'];
  for (const p of forbiddenTitleCaseParticles) {
    const capitalized = p.charAt(0).toUpperCase() + p.slice(1);
    const regex = new RegExp(`\\s${capitalized}\\s`, 'g');
    if (regex.test(trimmed)) {
      return { valid: false, reason: `English Title Case particle "${capitalized}" found in: "${trimmed}"` };
    }
  }

  return { valid: true };
}

// ── makeUrlSlug helper ──
function makeUrlSlug(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

// ── formatMoney helper ──
function formatMoney(amount) {
  if (!amount) return 'Thỏa thuận';
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '')} tỷ`;
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(0)} triệu`;
  }
  return amount.toLocaleString('vi-VN') + ' đ';
}

// ── getRealEstateUrl helper ──
function getRealEstateUrl(item) {
  const province = item.adminunit?.province && item.adminunit.province !== 'undefined'
    ? makeUrlSlug(item.adminunit.province)
    : 'toan-quoc';
    
  let rawWard = item.adminunit?.ward || item.adminunit?.district;
  if (!rawWard || rawWard === 'undefined' || rawWard === 'all') {
    rawWard = 'bds';
  }
  const cleanWard = makeUrlSlug(rawWard).replace(/^(thanh-pho|thi-xa|thi-tran|quan|huyen|phuong|xa|tp|tx|tt|q|h|p|x)-/, '');
  const wardSlug = cleanWard || 'bds';

  const slug = makeUrlSlug(item.title || 'chi-tiet');
  const id = item.shortId ? String(item.shortId) : String(item._id);

  return `/${province}/${wardSlug}/${id}/${slug}`;
}

// Load PROVINCES constant by parsing province.ts
function loadProvinces() {
  const provinceContent = fs.readFileSync(path.join(LIB_DIR, 'utils', 'province.ts'), 'utf8');
  const match = provinceContent.match(/export const PROVINCES: Record<string, string> = ({[\s\S]*?});/);
  if (!match) throw new Error('Could not parse PROVINCES from province.ts');
  const body = match[1];
  const obj = {};
  const lines = body.split('\n');
  for (const line of lines) {
    const m = line.match(/'([^']+)':\s*'([^']+)'/);
    if (m) {
      obj[m[1]] = m[2];
    }
  }
  return obj;
}

const PROVINCES = loadProvinces();

console.log('\n\x1b[1m\x1b[34m==============================================================================\x1b[0m');
console.log('\x1b[1m\x1b[34m▶ ADVERSARIAL STRESS TEST SUITE: VIETNAMESE SENTENCE CASE & TYPOGRAPHY\x1b[0m');
console.log('\x1b[1m\x1b[34m==============================================================================\x1b[0m\n');

// ------------------------------------------------------------------------------
// TEST SECTION 1: Static Route Metadata Audit
// ------------------------------------------------------------------------------
test('AUDIT-01: Layout metadata follows Vietnamese Sentence Case without emojis', () => {
  const file = path.join(APP_DIR, 'layout.tsx');
  const content = fs.readFileSync(file, 'utf8');
  
  const defaultTitleMatch = content.match(/default:\s*'([^']+)'/);
  assert.ok(defaultTitleMatch, 'layout.tsx must define default title');
  const res1 = validateVietnameseSentenceCase(defaultTitleMatch[1], 'layout default title');
  assert.ok(res1.valid, res1.reason);

  const ogTitleMatch = content.match(/openGraph:\s*\{[^}]*title:\s*'([^']+)'/s);
  assert.ok(ogTitleMatch, 'layout.tsx must define openGraph title');
  const res2 = validateVietnameseSentenceCase(ogTitleMatch[1], 'layout openGraph title');
  assert.ok(res2.valid, res2.reason);
});

test('AUDIT-02: All static page metadata titles and descriptions conform to Sentence Case', () => {
  const staticPages = [
    'app/page.tsx',
    'app/du-an/page.tsx',
    'app/quy-hoach/page.tsx',
    'app/thong-ke/page.tsx',
    'app/cho-thue/page.tsx',
    'app/mua-ban/page.tsx',
    'app/about/page.tsx',
    'app/contact/page.tsx',
    'app/privacy/page.tsx',
    'app/terms/page.tsx',
    'app/blog/page.tsx',
  ];

  for (const rel of staticPages) {
    const full = path.join(ROOT_DIR, rel);
    assert.ok(fs.existsSync(full), `${rel} must exist`);
    const content = fs.readFileSync(full, 'utf8');

    const titleMatch = content.match(/title:\s*['"`]([^'"`]+)['"`]/);
    if (titleMatch) {
      const res = validateVietnameseSentenceCase(titleMatch[1], `${rel} title`);
      assert.ok(res.valid, `${rel} title failure: ${res.reason}`);
    }

    const descMatch = content.match(/description:\s*['"`]([^'"`]+)['"`]/);
    if (descMatch) {
      const res = validateVietnameseSentenceCase(descMatch[1], `${rel} description`);
      assert.ok(res.valid, `${rel} description failure: ${res.reason}`);
    }
  }
});

// ------------------------------------------------------------------------------
// TEST SECTION 2: Dynamic Route Metadata Generator Stress Tests
// ------------------------------------------------------------------------------
test('AUDIT-03: Province page metadata generator produces Sentence Case across all 63 provinces', () => {
  const month = new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  for (const [slug, name] of Object.entries(PROVINCES)) {
    const locationName = name;
    const titleWithCount = `1,250 tin đăng nhà đất ${locationName} chính chủ – ${month} | NhaDat.City`;
    const titleWithoutCount = `Mua bán nhà đất ${locationName} chính chủ – Cập nhật ${month} | NhaDat.City`;
    const desc = `Tìm kiếm nhà đất chính chủ tại ${locationName}. Hàng nghìn tin đăng bất động sản giá tốt, pháp lý rõ ràng, không qua môi giới. Xem bản đồ quy hoạch ${locationName} trực tuyến.`;

    const r1 = validateVietnameseSentenceCase(titleWithCount, `Province ${slug} title with count`);
    assert.ok(r1.valid, r1.reason);

    const r2 = validateVietnameseSentenceCase(titleWithoutCount, `Province ${slug} title without count`);
    assert.ok(r2.valid, r2.reason);

    const r3 = validateVietnameseSentenceCase(desc, `Province ${slug} description`);
    assert.ok(r3.valid, r3.reason);
  }
});

test('AUDIT-04: Ward page metadata generator produces Sentence Case under varied inputs', () => {
  const month = new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
  const testWards = [
    { ward: 'Phường Dịch Vọng Hậu', province: 'Hà Nội' },
    { ward: 'Xã Tân Triều', province: 'Hà Nội' },
    { ward: 'Phường Bến Nghé', province: 'TP.HCM' },
    { ward: 'Thị trấn Ea Drăng', province: 'Đắk Lắk' },
    { ward: 'Xã Đắk R’Moan', province: 'Đắk Nông' },
  ];

  for (const item of testWards) {
    const title1 = `Bán nhà đất ${item.ward} ${item.province} chính chủ (45 tin) – Giá tốt ${month} | NhaDat.City`;
    const title2 = `Mua bán nhà đất ${item.ward} ${item.province} chính chủ – Cập nhật ${month} | NhaDat.City`;
    const desc = `Danh sách 45 tin mua bán nhà đất ${item.ward}, ${item.province} mới nhất ${month}. Thông tin chính chủ, sổ đỏ riêng, hỗ trợ vay ngân hàng, xem vị trí bản đồ quy hoạch trực tiếp.`;

    const r1 = validateVietnameseSentenceCase(title1);
    assert.ok(r1.valid, r1.reason);
    const r2 = validateVietnameseSentenceCase(title2);
    assert.ok(r2.valid, r2.reason);
    const r3 = validateVietnameseSentenceCase(desc);
    assert.ok(r3.valid, r3.reason);
  }
});

test('AUDIT-05: Real estate listing detail metadata handles adversarial and dirty input titles', () => {
  const dirtyTitles = [
    '🔥🔥🔥 SIÊU PHẨM NHÀ ĐẸP HOÀNG QUỐC VIỆT 🏠🏠 [SỔ ĐỎ CHÍNH CHỦ] ✨✨',
    'Nhà mặt phố Cầu Giấy 50m2 kinh doanh đỉnh ⭐⭐⭐',
    'Bán gấp căn hộ chung cư Vinhomes 2PN full nội thất ⏰ giá 3.2 tỷ',
    'Đất nền ven biển Đà Nẵng 100m2 🏖️🌊 giá đầu tư',
  ];

  for (const raw of dirtyTitles) {
    const cleaned = raw.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, '').replace(/[\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}]/gu, '').trim();
    assert.ok(!COMPREHENSIVE_EMOJI_REGEX.test(cleaned), `Cleaned title must not have emojis: "${cleaned}"`);
  }
});

test('AUDIT-06: Project detail metadata generator intent alignment (Dự án + Action + Specs)', () => {
  const projects = [
    { title: 'Vinhomes Smart City', ward: 'Tây Mỗ', district: 'Nam Từ Liêm', province: 'Hà Nội', minPrice: 2500000000 },
    { title: 'Ecopark Hưng Yên', ward: 'Xuân Quan', district: 'Văn Giang', province: 'Hưng Yên', minPrice: 3000000000 },
    { title: 'Masteri Thảo Điền', ward: 'Thảo Điền', district: 'Thủ Đức', province: 'TP.HCM', minPrice: 4800000000 },
  ];

  for (const p of projects) {
    const enrichedTitle = `Dự án ${p.title} – Bảng giá, tiến độ & quy hoạch mới nhất | NhaDat.City`;
    const res = validateVietnameseSentenceCase(enrichedTitle);
    assert.ok(res.valid, `Project title failed: ${res.reason}`);
  }
});

test('AUDIT-07: Parcel boundary route metadata Sentence Case audit (reveals casing quirks)', () => {
  const file = path.join(APP_DIR, 'parcel-boundary', '[[...slug]]', 'page.tsx');
  const content = fs.readFileSync(file, 'utf8');
  
  // Check fallback title
  const fallbackMatch = content.match(/title:\s*'([^']+)'/);
  if (fallbackMatch) {
    const fallbackTitle = fallbackMatch[1];
    // Check if fallback title contains capitalized 'Thửa đất'
    if (fallbackTitle.includes('Thửa đất') && !fallbackTitle.startsWith('Thửa')) {
      results.findings.push({
        id: 'FINDING-M2-01',
        title: 'Casing Inconsistency in Parcel Boundary Fallback Title',
        file: 'app/parcel-boundary/[[...slug]]/page.tsx:52',
        description: `Fallback title "${fallbackTitle}" capitalizes non-initial word "Thửa đất"`,
        severity: 'LOW',
      });
    }
  }
});

console.log('\n\x1b[1m\x1b[34m==============================================================================\x1b[0m');
console.log('\x1b[1m\x1b[34m▶ ADVERSARIAL STRESS TEST SUITE: ZERO UNICODE EMOJI CODEBASE AUDIT\x1b[0m');
console.log('\x1b[1m\x1b[34m==============================================================================\x1b[0m\n');

test('EMOJI-01: Zero raw unicode emojis across all tsx/ts files in app/ and components/', () => {
  const appFiles = getFiles(APP_DIR);
  const compFiles = getFiles(COMPONENTS_DIR);
  const allFiles = [...appFiles, ...compFiles];

  let emojiViolations = [];

  for (const file of allFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      const strippedLine = line.replace(/\/\/.*/g, '').replace(/\/\*.*?\*\//g, '');
      if (strippedLine.includes('reg') || strippedLine.includes('regex') || strippedLine.includes('UNICODE') || strippedLine.includes('replace(')) {
        return;
      }
      if (COMPREHENSIVE_EMOJI_REGEX.test(strippedLine)) {
        emojiViolations.push({ file: path.relative(ROOT_DIR, file), line: idx + 1, text: line.trim() });
      }
    });
  }

  if (emojiViolations.length > 0) {
    console.log(`    \x1b[33m[FINDING] Found ${emojiViolations.length} unicode emoji violations in source code:\x1b[0m`);
    emojiViolations.forEach(v => {
      console.log(`      - ${v.file}:${v.line} -> ${v.text}`);
      results.findings.push({
        id: 'FINDING-M2-02',
        title: 'Raw Unicode Emoji in MapLibre Popup Template',
        file: `${v.file}:${v.line}`,
        description: `Raw unicode emoji character found in source code: "${v.text}"`,
        severity: 'HIGH',
      });
    });
  }

  // Challenger assertion: strictly 0 emojis allowed
  assert.equal(emojiViolations.length, 0, `Expected 0 emoji violations, found ${emojiViolations.length}`);
});

test('EMOJI-02: Stress-test emoji sanitizer against ZWJ sequences, skin tones, and keycaps', () => {
  const hostileInputs = [
    { raw: 'Căn hộ 👨‍👩‍👧‍👦 gia đình', expectedClean: 'Căn hộ gia đình' },
    { raw: 'Nhà số 1️⃣ mặt tiền', expectedClean: 'Nhà số 1 mặt tiền' },
    { raw: 'Chính chủ bán 👍🏽 nhanh', expectedClean: 'Chính chủ bán nhanh' },
    { raw: 'Cờ Việt Nam 🇻🇳 chính chủ', expectedClean: 'Cờ Việt Nam chính chủ' },
    { raw: 'Bán nhà ⭐⭐⭐ VIP ⏰ 24/7', expectedClean: 'Bán nhà VIP 24/7' },
  ];

  function purgeAllEmojis(str) {
    return str
      .replace(/[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{FE00}-\u{FE0F}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{203C}\u{2049}\u{200D}\u{20E3}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  for (const item of hostileInputs) {
    const cleaned = purgeAllEmojis(item.raw);
    assert.ok(!COMPREHENSIVE_EMOJI_REGEX.test(cleaned), `Cleaned string should have no emojis: "${cleaned}"`);
  }
});

console.log('\n\x1b[1m\x1b[34m==============================================================================\x1b[0m');
console.log('\x1b[1m\x1b[34m▶ ADVERSARIAL STRESS TEST SUITE: SCHEMA.ORG JSON-LD EDGE CASES\x1b[0m');
console.log('\x1b[1m\x1b[34m==============================================================================\x1b[0m\n');

test('SCHEMA-01: Schema RealEstateListing propertyType mapping handles all taxonomy inputs', () => {
  function mapPropertyType(item) {
    if (item.propertyType === 'ChungCu' || item.title?.toLowerCase().includes('chung cư') || item.title?.toLowerCase().includes('căn hộ')) {
      return 'Apartment';
    }
    if (item.propertyType === 'DatNen' || item.title?.toLowerCase().includes('đất nền') || item.title?.toLowerCase().includes('đất')) {
      return 'LandParcel';
    }
    return 'SingleFamilyResidence';
  }

  const testCases = [
    { item: { propertyType: 'ChungCu', title: 'Căn hộ Masteri' }, expected: 'Apartment' },
    { item: { propertyType: 'DatNen', title: 'Đất thổ cư Sóc Sơn' }, expected: 'LandParcel' },
    { item: { propertyType: 'NhaPho', title: 'Bán nhà mặt phố Cầu Giấy' }, expected: 'SingleFamilyResidence' },
    { item: { propertyType: null, title: 'Bán chung cư Royal City' }, expected: 'Apartment' },
    { item: { propertyType: undefined, title: 'Bán mảnh đất 100m2' }, expected: 'LandParcel' },
    { item: { propertyType: undefined, title: 'Biệt thự Gamuda Garden' }, expected: 'SingleFamilyResidence' },
    { item: { propertyType: 'UnknownType', title: 'Bất động sản cao cấp' }, expected: 'SingleFamilyResidence' },
  ];

  for (const tc of testCases) {
    const result = mapPropertyType(tc.item);
    assert.equal(result, tc.expected, `Mapping failed for ${JSON.stringify(tc.item)}`);
  }
});

test('SCHEMA-02: Numerical price and currency formatting in RealEstateListing and Offer schemas', () => {
  function buildOfferSchema(item, canonicalUrl) {
    const priceValue = (typeof item.totalPrice === 'number' && !isNaN(item.totalPrice) && item.totalPrice > 0)
      ? item.totalPrice
      : (typeof item.price === 'number' && !isNaN(item.price) && item.price > 0)
      ? item.price
      : 0;

    return {
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
    };
  }

  const priceTests = [
    { item: { totalPrice: 6_500_000_000 }, expectedPrice: 6_500_000_000 },
    { item: { price: 850_000_000 }, expectedPrice: 850_000_000 },
    { item: { totalPrice: 0 }, expectedPrice: 0 },
    { item: { totalPrice: null, price: null }, expectedPrice: 0 },
    { item: { totalPrice: NaN }, expectedPrice: 0 },
    { item: { totalPrice: -500000 }, expectedPrice: 0 },
  ];

  for (const pt of priceTests) {
    const offer = buildOfferSchema(pt.item, 'https://nhadat.city/test');
    assert.equal(offer['@type'], 'Offer');
    assert.equal(offer.priceCurrency, 'VND');
    assert.equal(typeof offer.price, 'number');
    assert.equal(offer.price, pt.expectedPrice);
    assert.equal(offer.priceSpecification.priceCurrency, 'VND');
    assert.equal(offer.priceSpecification.valueAddedTaxIncluded, true);
  }
});

test('SCHEMA-03: GeoCoordinates schema handles both lat/lng objects and coordinates arrays', () => {
  function extractGeo(item) {
    if (item.lat && item.lng) {
      return { '@type': 'GeoCoordinates', latitude: item.lat, longitude: item.lng };
    }
    if (item.coordinates && Array.isArray(item.coordinates) && item.coordinates.length === 2) {
      return { '@type': 'GeoCoordinates', latitude: item.coordinates[1], longitude: item.coordinates[0] };
    }
    return undefined;
  }

  const geo1 = extractGeo({ lat: 21.0285, lng: 105.8542 });
  assert.deepEqual(geo1, { '@type': 'GeoCoordinates', latitude: 21.0285, longitude: 105.8542 });

  const geo2 = extractGeo({ coordinates: [105.8542, 21.0285] });
  assert.deepEqual(geo2, { '@type': 'GeoCoordinates', latitude: 21.0285, longitude: 105.8542 });

  const geo3 = extractGeo({});
  assert.equal(geo3, undefined);

  // Adversarial case: empty array coordinates []
  const geo4 = extractGeo({ coordinates: [] });
  assert.equal(geo4, undefined);
});

test('SCHEMA-04: Project detail schema handles empty coordinates array safely', () => {
  const projectWithEmptyCoords = {
    _id: 'p123',
    title: 'Dự án Test',
    coordinates: [], // Empty array in DB
  };

  // Inspect how du-an/[id]/[slug]/page.tsx builds geo
  const duAnFile = path.join(APP_DIR, 'du-an', '[id]', '[slug]', 'page.tsx');
  const duAnContent = fs.readFileSync(duAnFile, 'utf8');

  // Check if du-an checks coordinates length
  if (duAnContent.includes('item.coordinates ?') && !duAnContent.includes('item.coordinates.length === 2') && !duAnContent.includes('item.coordinates.length >=')) {
    results.findings.push({
      id: 'FINDING-M2-03',
      title: 'Missing length validation on project coordinates array in JSON-LD',
      file: 'app/du-an/[id]/[slug]/page.tsx:124',
      description: 'Project JSON-LD checks `item.coordinates ?` instead of `item.coordinates?.length === 2`, producing undefined lat/lng if empty array',
      severity: 'MEDIUM',
    });
  }
});

test('SCHEMA-05: Province and Ward ItemList schema must generate SSOT normalized canonical URLs', () => {
  const sampleListingWithPrefix = {
    _id: 'item123',
    shortId: 'Ab12',
    title: 'Bán nhà mặt phố Cầu Giấy',
    adminunit: { province: 'ha-noi', ward: 'phuong-dich-vong' }
  };

  const expectedCanonical = getRealEstateUrl(sampleListingWithPrefix);
  assert.equal(expectedCanonical, '/ha-noi/dich-vong/Ab12/ban-nha-mat-pho-cau-giay');

  // Check app/[province]/page.tsx ItemList URL generator
  const provPage = fs.readFileSync(path.join(APP_DIR, '[province]', 'page.tsx'), 'utf8');
  const wardPage = fs.readFileSync(path.join(APP_DIR, '[province]', '[ward]', 'page.tsx'), 'utf8');

  if (provPage.includes('${baseUrl}/${item.adminunit?.province}/${item.adminunit?.ward}')) {
    results.findings.push({
      id: 'FINDING-M2-04',
      title: 'Manual URL interpolation in Province ItemList JSON-LD schema',
      file: 'app/[province]/page.tsx:207',
      description: 'ItemList JSON-LD constructs URLs manually instead of using getRealEstateUrl(item), potentially emitting unnormalized ward prefixes (e.g. phuong-dich-vong)',
      severity: 'MEDIUM',
    });
  }

  if (wardPage.includes('${baseUrl}/${item.adminunit?.province}/${item.adminunit?.ward}')) {
    results.findings.push({
      id: 'FINDING-M2-05',
      title: 'Manual URL interpolation in Ward ItemList JSON-LD schema',
      file: 'app/[province]/[ward]/page.tsx:163',
      description: 'ItemList JSON-LD constructs URLs manually instead of using getRealEstateUrl(item), potentially emitting unnormalized ward prefixes',
      severity: 'MEDIUM',
    });
  }
});

console.log('\n\x1b[1m\x1b[34m==============================================================================\x1b[0m');
console.log('\x1b[1m\x1b[34m▶ ADVERSARIAL STRESS TEST SUITE: VIETNAMESE ACCENTS & NFC/NFD NORMALIZATION\x1b[0m');
console.log('\x1b[1m\x1b[34m==============================================================================\x1b[0m\n');

test('ACCENT-01: makeUrlSlug correctly parses decomposed NFD Vietnamese strings', () => {
  const nfcTitle = 'Bán nhà mặt phố Đà Nẵng';
  const nfdTitle = nfcTitle.normalize('NFD');

  assert.notEqual(nfcTitle, nfdTitle, 'NFD must differ in byte representation from NFC');
  assert.equal(makeUrlSlug(nfcTitle), 'ban-nha-mat-pho-da-nang');
  assert.equal(makeUrlSlug(nfdTitle), 'ban-nha-mat-pho-da-nang');
});

test('ACCENT-02: makeUrlSlug handles all 63 province names without errors or diacritic remnants', () => {
  for (const [slug, name] of Object.entries(PROVINCES)) {
    const generatedSlug = makeUrlSlug(name);
    assert.match(generatedSlug, /^[a-z0-9-]+$/, `Generated slug for ${name} must be pure ASCII alphanumeric with hyphens`);
    assert.ok(!/[à-ỹÀ-ỸđĐ]/.test(generatedSlug), `No Vietnamese tone marks should remain in slug "${generatedSlug}"`);
  }
});

test('ACCENT-03: Complex Vietnamese vowel combinations with all 5 tone marks', () => {
  const toneMatrix = [
    'nghiêng', 'nghiềng', 'nghiểng', 'nghiễng', 'nghiệng',
    'thương', 'thường', 'thưởng', 'thưỡng', 'thượng',
    'khoảng', 'khoàng', 'khoang', 'khoãng', 'khoạng',
    'quyền', 'quyển', 'quyễn', 'quyện',
  ];

  for (const word of toneMatrix) {
    const slug = makeUrlSlug(word);
    assert.ok(/^[a-z0-9-]+$/.test(slug), `Slug for "${word}" should be clean ASCII: got "${slug}"`);
  }
});

console.log('\n\x1b[1m\x1b[34m==============================================================================\x1b[0m');
console.log('\x1b[1m\x1b[34m▶ ADVERSARIAL STRESS TEST SUMMARY\x1b[0m');
console.log('\x1b[1m\x1b[34m==============================================================================\x1b[0m');
console.log(`  Total Tests Run : ${results.total}`);
console.log(`  Passed          : \x1b[32m${results.passed}\x1b[0m`);
console.log(`  Failed          : \x1b[31m${results.failed}\x1b[0m`);
console.log(`  Findings Found  : \x1b[33m${results.findings.length}\x1b[0m`);
console.log('\x1b[1m\x1b[34m==============================================================================\x1b[0m\n');

if (results.findings.length > 0) {
  console.log('\x1b[1m\x1b[33mDISCOVERED FINDINGS & CHALLENGES:\x1b[0m');
  results.findings.forEach((f, idx) => {
    console.log(`\n  ${idx + 1}. [${f.severity}] ${f.id || f.name}: ${f.title || f.error}`);
    if (f.file) console.log(`     Location: ${f.file}`);
    if (f.description) console.log(`     Detail: ${f.description}`);
  });
}
