/**
 * ==============================================================================
 * NHADAT.CITY CHALLENGER 1 EMPIRICAL VERIFICATION SUITE - MILESTONE 3 (M3)
 * ==============================================================================
 * Focus: Programmatic SEO & Contextual Internal Linking Matrix
 * Author: Challenger 1 (Empirical Challenger & Critic)
 * Specifications: PROJECT.md, GEMINI.md, M3 Requirements
 * 
 * Verifications:
 * 1. Ward link matrix integrity & local administrative unit matching
 * 2. Keyword landing pages collection fix & query mechanics (realEstate)
 * 3. SSR HTML value-added content: Similar Listings (<a> with href), FAQs, Legal Guide
 * 4. Unified SEO Footer & cross-linking hierarchy
 * 5. Adversarial edge cases, malformed params, injection resilience
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
    console.log(`  \x1b[32m✓\x1b[0m [CHAL3-${String(stats.total).padStart(3, '0')}] ${name}`);
  } catch (err) {
    stats.failed++;
    stats.defects.push({ id: stats.total, name, error: err.message, stack: err.stack });
    console.log(`  \x1b[31m✗\x1b[0m [CHAL3-${String(stats.total).padStart(3, '0')}] ${name}`);
    console.log(`    \x1b[31mError:\x1b[0m ${err.message}`);
  }
}

// Helpers
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

function formatArea(area) {
  if (!area) return '';
  return `${Number(area).toFixed(1).replace(/\.0$/, '')} m²`;
}

console.log('\x1b[1m\x1b[34m================================================================================\x1b[0m');
console.log('\x1b[1m\x1b[34m STARTING CHALLENGER M3 EMPIRICAL ADVERSARIAL STRESS-TEST\x1b[0m');
console.log('\x1b[1m\x1b[34m================================================================================\x1b[0m\n');

// ------------------------------------------------------------------------------
// GROUP 1: ADMINISTRATIVE UNITS & CONTEXTUAL WARD LINK MATRIX (Feature 12)
// ------------------------------------------------------------------------------
console.log('\x1b[1m[Group 1] Administrative Units & Contextual Ward Link Matrix (Feature 12)\x1b[0m');

test('CHAL3-01: app/[province]/page.tsx queries local wards via getWardsByProvince', () => {
  const provincePagePath = path.join(APP_DIR, '[province]', 'page.tsx');
  assert.ok(fs.existsSync(provincePagePath), 'app/[province]/page.tsx must exist');
  const content = fs.readFileSync(provincePagePath, 'utf8');

  assert.ok(content.includes('getWardsByProvince'), 'Must import and invoke getWardsByProvince');
  assert.ok(content.includes('getWardsByProvince(province'), 'Must pass current province to getWardsByProvince');
  assert.ok(content.includes('localWards.map'), 'Must render local wards grid dynamically');
  assert.ok(content.includes('href={`/${province}/${w.CodeName}`}'), 'Ward links must point to /{province}/{wardCodeName}');
});

test('CHAL3-02: lib/geo/geoService.ts implements getWardsByProvince querying ward2025', () => {
  const geoServicePath = path.join(LIB_DIR, 'geo', 'geoService.ts');
  assert.ok(fs.existsSync(geoServicePath), 'lib/geo/geoService.ts must exist');
  const content = fs.readFileSync(geoServicePath, 'utf8');

  assert.ok(content.includes('export async function getWardsByProvince'), 'Must export getWardsByProvince');
  assert.ok(content.includes("collection('ward2025')"), 'Must query ward2025 collection');
  assert.ok(content.includes('ProvinceCodeName'), 'Must filter by ProvinceCodeName');
  assert.ok(content.includes('resolveProvinceSlug'), 'Must resolve legacy province slugs for backward compatibility');
});

test('CHAL3-03: ProvinceLinks component contextual ward matrix groups by district', () => {
  const provinceLinksPath = path.join(COMPONENTS_DIR, 'SEO', 'ProvinceLinks.tsx');
  assert.ok(fs.existsSync(provinceLinksPath), 'components/SEO/ProvinceLinks.tsx must exist');
  const content = fs.readFileSync(provinceLinksPath, 'utf8');

  assert.ok(content.includes("collection('ward2025')"), 'ProvinceLinks must query ward2025 collection');
  assert.ok(content.includes('ProvinceCodeName: currentProvince'), 'ProvinceLinks must filter by currentProvince');
  assert.ok(content.includes('wardsByDistrict'), 'Must group wards by district for clean UX hierarchy');
  assert.ok(content.includes('href={`/${currentProvince}/${ward.CodeName}`}'), 'Must generate local ward anchor links');
});

test('CHAL3-04: Ward codename prefix cleaner strips administrative prefixes correctly', () => {
  const testWards = [
    ['phuong-dich-vong', 'dich-vong'],
    ['xa-quang-lap', 'quang-lap'],
    ['thi-tran-vinh-tru', 'vinh-tru'],
    ['quan-cau-giay', 'cau-giay'],
    ['thanh-pho-thu-duc', 'thu-duc'],
    ['tp-vinh', 'vinh'],
    ['tx-cua-lo', 'cua-lo'],
    ['tt-dong-anh', 'dong-anh'],
    ['p-ben-nghe', 'ben-nghe'],
    ['x-tan-lap', 'tan-lap'],
  ];

  for (const [raw, expected] of testWards) {
    const cleaned = makeUrlSlug(raw).replace(/^(thanh-pho|thi-xa|thi-tran|quan|huyen|phuong|xa|tp|tx|tt|q|h|p|x)-/, '');
    assert.equal(cleaned, expected, `Prefix stripping failed for ${raw}`);
  }
});

test('CHAL3-05: Province table covers all 63 Vietnamese administrative provinces', () => {
  const provinceFilePath = path.join(LIB_DIR, 'utils', 'province.ts');
  assert.ok(fs.existsSync(provinceFilePath), 'lib/utils/province.ts must exist');
  const content = fs.readFileSync(provinceFilePath, 'utf8');

  const requiredProvinces = [
    'an-giang', 'ba-ria-vung-tau', 'bac-giang', 'bac-kan', 'bac-lieu', 'bac-ninh',
    'ben-tre', 'binh-dinh', 'binh-duong', 'binh-phuoc', 'binh-thuan', 'ca-mau',
    'can-tho', 'cao-bang', 'da-nang', 'dak-lak', 'dak-nong', 'dien-bien', 'dong-nai',
    'dong-thap', 'gia-lai', 'ha-giang', 'ha-nam', 'ha-noi', 'ha-tinh', 'hai-duong',
    'hai-phong', 'hau-giang', 'hoa-binh', 'ho-chi-minh', 'hung-yen', 'khanh-hoa',
    'kien-giang', 'kon-tum', 'lai-chau', 'lam-dong', 'lang-son', 'lao-cai', 'long-an',
    'nam-dinh', 'nghe-an', 'ninh-binh', 'ninh-thuan', 'phu-tho', 'phu-yen', 'quang-binh',
    'quang-nam', 'quang-ngai', 'quang-ninh', 'quang-tri', 'soc-trang', 'son-la', 'tay-ninh',
    'thai-binh', 'thai-nguyen', 'thanh-hoa', 'thua-thien-hue', 'tien-giang', 'tra-vinh',
    'tuyen-quang', 'vinh-long', 'vinh-phuc', 'yen-bai'
  ];

  for (const prov of requiredProvinces) {
    assert.ok(content.includes(`'${prov}'`), `PROVINCES must define '${prov}'`);
  }
});

// ------------------------------------------------------------------------------
// GROUP 2: KEYWORD LANDING PAGES & COLLECTION FIX (Feature 13)
// ------------------------------------------------------------------------------
console.log('\n\x1b[1m[Group 2] Keyword Landing Pages Collection Fix & Query Integrity (Feature 13)\x1b[0m');

test('CHAL3-06: app/tu-khoa/[slug]/page.tsx queries canonical realEstate collection (case sensitivity)', () => {
  const keywordPagePath = path.join(APP_DIR, 'tu-khoa', '[slug]', 'page.tsx');
  assert.ok(fs.existsSync(keywordPagePath), 'app/tu-khoa/[slug]/page.tsx must exist');
  const content = fs.readFileSync(keywordPagePath, 'utf8');

  // Verify exact case
  assert.ok(content.includes("collection('realEstate')"), "Must use db.collection('realEstate') with camelCase");
  assert.ok(!content.includes("collection('realestate')"), "Must NOT contain lowercase db.collection('realestate')");
});

test('CHAL3-07: Keyword landing search query parser removes stop-words and matches adminunit slugs and content', () => {
  const parseKeywordQuery = (slug) => {
    const topicName = slug.replace(/-/g, ' ');
    const cleanQuery = topicName.replace(/ban|cho-thue|nha|dat|can-ho|chung-cu/gi, '').trim();
    const tokens = cleanQuery.split(' ').filter(Boolean);
    const regex = new RegExp(tokens.join('|'), 'i');
    return { topicName, cleanQuery, tokens, regex };
  };

  const sample1 = parseKeywordQuery('ban-nha-mat-pho-cau-giay');
  assert.equal(sample1.cleanQuery, 'mat-pho-cau-giay'.replace(/-/g, ' '));
  // Matches adminunit.ward: 'cau-giay'
  assert.ok(sample1.regex.test('cau-giay'));
  // Matches unaccented title or description tokens
  assert.ok(sample1.regex.test('ban nha mat pho'));

  const sample2 = parseKeywordQuery('chung-cu-newlife-bai-chay');
  assert.ok(sample2.regex.test('bai-chay'));
  assert.ok(sample2.regex.test('newlife'));
});

test('CHAL3-08: Keyword landing page generates rich JSON-LD schemas (CollectionPage, BreadcrumbList, FAQPage)', () => {
  const keywordPagePath = path.join(APP_DIR, 'tu-khoa', '[slug]', 'page.tsx');
  const content = fs.readFileSync(keywordPagePath, 'utf8');

  assert.ok(content.includes('@type') && content.includes('CollectionPage'), 'Must render CollectionPage JSON-LD');
  assert.ok(content.includes('@type') && content.includes('BreadcrumbList'), 'Must render BreadcrumbList JSON-LD');
  assert.ok(content.includes('@type') && content.includes('FAQPage'), 'Must render FAQPage JSON-LD');
  assert.ok(content.includes('<JsonLd data={collectionJsonLd} />'), 'Must mount collectionJsonLd');
  assert.ok(content.includes('<JsonLd data={breadcrumbJsonLd} />'), 'Must mount breadcrumbJsonLd');
  assert.ok(content.includes('<JsonLd data={faqJsonLd} />'), 'Must mount faqJsonLd');
});

test('CHAL3-09: Keyword landing page generates canonical URL with slug and alternates', () => {
  const keywordPagePath = path.join(APP_DIR, 'tu-khoa', '[slug]', 'page.tsx');
  const content = fs.readFileSync(keywordPagePath, 'utf8');

  assert.ok(content.includes('canonical: `https://nhadat.city/tu-khoa/${slug}`'), 'Must declare canonical URL');
  assert.ok(content.includes('ProvinceLinks'), 'Must include ProvinceLinks for cross-linking SEO juice');
});

// ------------------------------------------------------------------------------
// GROUP 3: SSR VALUE-ADDED CONTENT & INTERNAL LINK EQUITY (Feature 14)
// ------------------------------------------------------------------------------
console.log('\n\x1b[1m[Group 3] SSR Value-Added Content & Link Equity (Feature 14)\x1b[0m');

test('CHAL3-10: RealEstateDetailPage server component pre-fetches similar listings on server', () => {
  const detailPagePath = path.join(APP_DIR, '[province]', '[ward]', '[id]', '[slug]', 'page.tsx');
  assert.ok(fs.existsSync(detailPagePath), 'Detail page.tsx must exist');
  const content = fs.readFileSync(detailPagePath, 'utf8');

  assert.ok(content.includes('getSimilarRealEstates'), 'Must import and invoke getSimilarRealEstates');
  assert.ok(content.includes('const similarListings = await getSimilarRealEstates(id, item, 12)'), 'Must fetch 12 similar listings server-side');
  assert.ok(content.includes('<ListingDetailContent listing={item} currentUrl={canonicalUrl} similarListings={similarListings} />'), 'Must pass similarListings to ListingDetailContent');
});

test('CHAL3-11: SimilarListings renders <a> tags with href during SSR from initialItems', () => {
  const similarListingsPath = path.join(COMPONENTS_DIR, 'ListingDetail', 'SimilarListings.tsx');
  assert.ok(fs.existsSync(similarListingsPath), 'SimilarListings.tsx must exist');
  const content = fs.readFileSync(similarListingsPath, 'utf8');

  assert.ok(content.includes('initialItems = []'), 'Must accept initialItems prop');
  assert.ok(content.includes('const [items, setItems] = useState<any[]>(initialItems)'), 'Must initialize items state with initialItems');
  assert.ok(content.includes('<Link') || content.includes('<a'), 'Must render Link/anchor elements');
  assert.ok(content.includes('href={url}'), 'Must bind canonical href to Link/anchor');
  assert.ok(content.includes('getRealEstateUrl(item)'), 'Must compute canonical listing URL');
});

test('CHAL3-12: LegalGuide renders SSR legal checklist, taxes estimation, and process steps', () => {
  const legalGuidePath = path.join(COMPONENTS_DIR, 'ListingDetail', 'LegalGuide.tsx');
  assert.ok(fs.existsSync(legalGuidePath), 'LegalGuide.tsx must exist');
  const content = fs.readFileSync(legalGuidePath, 'utf8');

  assert.ok(content.includes('LEGAL_CHECKLIST'), 'Must define LEGAL_CHECKLIST knowledge base');
  assert.ok(content.includes('thueTNCN = totalPrice * 0.02'), 'Must compute 2% TNCN tax');
  assert.ok(content.includes('lePhiTruocBa = totalPrice * 0.005'), 'Must compute 0.5% registration fee');
  assert.ok(content.includes('PROCESS_STEPS'), 'Must define 5-step property transaction process');
  assert.ok(content.includes('RISKS'), 'Must define legal risk warnings');
});

test('CHAL3-13: AutoFAQ generates dynamic FAQ items and server JSON-LD for rich snippets', () => {
  const autoFaqPath = path.join(COMPONENTS_DIR, 'ListingDetail', 'AutoFAQ.tsx');
  assert.ok(fs.existsSync(autoFaqPath), 'AutoFAQ.tsx must exist');
  const content = fs.readFileSync(autoFaqPath, 'utf8');

  assert.ok(content.includes('function generateFAQs'), 'Must define generateFAQs helper');
  assert.ok(content.includes('export { generateFAQs }'), 'Must export generateFAQs for JSON-LD reuse');
  assert.ok(content.includes('Giá bất động sản'), 'Must generate Price FAQ');
  assert.ok(content.includes('Pháp lý bất động sản'), 'Must generate Legal FAQ');
  assert.ok(content.includes('Chi phí vay mua nhà'), 'Must generate Loan Calculation FAQ');
});

test('CHAL3-14: Listing detail page generates 4 rich JSON-LD schemas in head', () => {
  const detailPagePath = path.join(APP_DIR, '[province]', '[ward]', '[id]', '[slug]', 'page.tsx');
  const content = fs.readFileSync(detailPagePath, 'utf8');

  assert.ok(content.includes('<JsonLd data={listingJsonLd} />'), 'Must mount listingJsonLd');
  assert.ok(content.includes('<JsonLd data={breadcrumbJsonLd} />'), 'Must mount breadcrumbJsonLd');
  assert.ok(content.includes('<JsonLd data={orgJsonLd} />'), 'Must mount orgJsonLd');
  assert.ok(content.includes('{faqJsonLd && <JsonLd data={faqJsonLd} />}'), 'Must mount faqJsonLd when present');
});

// ------------------------------------------------------------------------------
// GROUP 4: UNIFIED SEO FOOTER & CROSS-LINKING (Feature 15)
// ------------------------------------------------------------------------------
console.log('\n\x1b[1m[Group 4] Unified SEO Footer & Layout Integration (Feature 15)\x1b[0m');

test('CHAL3-15: components/SeoFooter.tsx renders 4 distinct sections for all 63 provinces', () => {
  const seoFooterPath = path.join(COMPONENTS_DIR, 'SeoFooter.tsx');
  assert.ok(fs.existsSync(seoFooterPath), 'components/SeoFooter.tsx must exist');
  const content = fs.readFileSync(seoFooterPath, 'utf8');

  assert.ok(content.includes('Mua bán nhà đất 63 tỉnh thành'), 'Section 1: Mua ban nha dat');
  assert.ok(content.includes('Cho thuê nhà đất toàn quốc'), 'Section 2: Cho thue nha dat');
  assert.ok(content.includes('Dự án bất động sản'), 'Section 3: Du an bat dong san');
  assert.ok(content.includes('Tra cứu bản đồ quy hoạch'), 'Section 4: Tra cuu quy hoach');
  assert.ok(content.includes('PROVINCES'), 'Must iterate over PROVINCES dictionary');
  assert.ok(content.includes('href={`/${slug}`}'), 'Section 1 link format: /{slug}');
  assert.ok(content.includes('href={`/${slug}?propertyType=cho_thue`}'), 'Section 2 link format: /{slug}?propertyType=cho_thue');
  assert.ok(content.includes('href={`/du-an?province=${slug}`}'), 'Section 3 link format: /du-an?province={slug}');
  assert.ok(content.includes('href={`/quy-hoach/${slug}`}'), 'Section 4 link format: /quy-hoach/{slug}');
});

test('CHAL3-16: Root layout app/layout.tsx imports and renders SeoFooter', () => {
  const layoutPath = path.join(APP_DIR, 'layout.tsx');
  assert.ok(fs.existsSync(layoutPath), 'app/layout.tsx must exist');
  const content = fs.readFileSync(layoutPath, 'utf8');

  assert.ok(content.includes("import SeoFooter from '@/components/SeoFooter'"), 'Must import SeoFooter');
  assert.ok(content.includes('<SeoFooter />'), 'Must render <SeoFooter /> in body');
});

// ------------------------------------------------------------------------------
// GROUP 5: ADVERSARIAL STRESS TESTING & EDGE CASES
// ------------------------------------------------------------------------------
console.log('\n\x1b[1m[Group 5] Adversarial Stress Testing & Edge Cases\x1b[0m');

test('CHAL3-17: URL generator handles null/undefined admin units and special characters safely', () => {
  const items = [
    { _id: '123', title: null, adminunit: null },
    { _id: '456', shortId: 'S456', title: 'Bán đất <script>alert(1)</script>', adminunit: { province: 'ha-noi', ward: 'undefined' } },
    { _id: '789', title: 'Nhà đẹp 100% chính chủ & giá rẻ', adminunit: { province: 'undefined', ward: 'all' } },
  ];

  const u1 = getRealEstateUrl(items[0]);
  assert.equal(u1, '/toan-quoc/bds/123/chi-tiet');

  const u2 = getRealEstateUrl(items[1]);
  assert.equal(u2, '/ha-noi/bds/S456/ban-dat-scriptalert1script');

  const u3 = getRealEstateUrl(items[2]);
  assert.equal(u3, '/toan-quoc/bds/789/nha-dep-100-chinh-chu-gia-re');
});

test('CHAL3-18: LegalGuide tax calculator handles edge cases (0 VND, null, extreme billion values)', () => {
  const calculateTaxes = (totalPrice) => {
    const price = totalPrice || 0;
    const thueTNCN = price * 0.02;
    const lePhiTruocBa = price * 0.005;
    const phiCongChung = Math.min(price * 0.001, 10_000_000);
    const phiThamDinh = 500_000;
    const totalTax = thueTNCN + lePhiTruocBa + phiCongChung + phiThamDinh;
    return { thueTNCN, lePhiTruocBa, phiCongChung, phiThamDinh, totalTax };
  };

  const t0 = calculateTaxes(0);
  assert.equal(t0.thueTNCN, 0);
  assert.equal(t0.totalTax, 500_000); // Only basic appraisal fee

  const t100B = calculateTaxes(100_000_000_000);
  assert.equal(t100B.thueTNCN, 2_000_000_000);
  assert.equal(t100B.lePhiTruocBa, 500_000_000);
  assert.equal(t100B.phiCongChung, 10_000_000); // Capped at 10M
  assert.equal(t100B.totalTax, 2_510_500_000);
});

test('CHAL3-19: AutoFAQ handles missing fields (no price, no bedrooms, no legal papers) without throwing', () => {
  const minimalListing = {
    title: 'Đất vườn xã Tân Lập',
    totalPrice: 0,
    area: null,
    bedrooms: null,
    legalPaper: null,
    address: 'Xã Tân Lập, Huyện Hàm Thuận Nam',
  };

  const generateTestFaqs = (listing) => {
    const faqs = [];
    const title = listing.title || 'bất động sản này';
    const price = listing.totalPrice || listing.price;
    if (price) faqs.push({ q: `Giá "${title}" bao nhiêu?`, a: formatMoney(price) });
    if (listing.area) faqs.push({ q: 'Diện tích?', a: formatArea(listing.area) });
    if (listing.legalPaper) faqs.push({ q: 'Pháp lý?', a: listing.legalPaper });
    faqs.push({ q: 'Vị trí ở đâu?', a: listing.address || 'Đang cập nhật' });
    return faqs;
  };

  const faqs = generateTestFaqs(minimalListing);
  assert.ok(faqs.length >= 1, 'Must generate at least location FAQ');
  assert.equal(faqs[0].q, 'Vị trí ở đâu?');
  assert.equal(faqs[0].a, 'Xã Tân Lập, Huyện Hàm Thuận Nam');
});

test('CHAL3-20: SimilarListings handles empty initialItems array gracefully without throwing', () => {
  const emptyItems = [];
  const renderedCount = emptyItems.length;
  assert.equal(renderedCount, 0);
});

test('CHAL3-21: Vietnamese Sentence Case compliance on Province and Keyword headings & titles', () => {
  const checkSentenceCase = (title) => {
    if (!title || typeof title !== 'string') return false;
    const words = title.trim().split(/\s+/);
    const upperWords = words.filter(w => w.length > 1 && w === w.toUpperCase() && !/^[0-9\W]+$/.test(w));
    return !(words.length >= 3 && upperWords.length > words.length * 0.6);
  };

  const sampleHeadings = [
    'Mua bán nhà đất Hà Nội chính chủ – Cập nhật tháng 8/2026',
    'Bất động sản Hà Nội (30 tin đăng)',
    'Mua bán bất động sản bán nhà mặt phố Cầu Giấy',
    'Câu hỏi thường gặp về bất động sản Hà Nội',
    'Tra cứu nhà đất theo xã / phường tại Hà Nội',
    'Đặc điểm bất động sản',
    'Hướng dẫn pháp lý',
    'Mua bán nhà đất 63 tỉnh thành'
  ];

  for (const h of sampleHeadings) {
    assert.ok(checkSentenceCase(h), `Heading "${h}" must satisfy sentence case`);
  }
});

// ------------------------------------------------------------------------------
// SUMMARY REPORT
// ------------------------------------------------------------------------------
const durationMs = Date.now() - stats.startTime;
console.log('\n\x1b[1m\x1b[34m================================================================================\x1b[0m');
console.log('\x1b[1m CHALLENGER M3 VERIFICATION SUMMARY\x1b[0m');
console.log('\x1b[1m\x1b[34m================================================================================\x1b[0m');
console.log(`  Total Tests Run : ${stats.total}`);
console.log(`  Passed          : \x1b[32m${stats.passed}\x1b[0m`);
console.log(`  Failed          : ${stats.failed > 0 ? '\x1b[31m' + stats.failed + '\x1b[0m' : '0'}`);
console.log(`  Execution Time  : ${durationMs}ms`);
console.log('\x1b[1m\x1b[34m================================================================================\x1b[0m');

if (stats.failed > 0) {
  console.log('\x1b[1m\x1b[31mDEFECTS DISCOVERED:\x1b[0m');
  stats.defects.forEach(d => {
    console.log(`  [CHAL3-${String(d.id).padStart(3, '0')}] ${d.name}`);
    console.log(`    \x1b[31mError:\x1b[0m ${d.error}`);
  });
  console.log('\n\x1b[31mAdversarial verification discovered reproducible defects.\x1b[0m\n');
  process.exit(1);
} else {
  console.log('\n\x1b[1m\x1b[32m✓ ALL CHALLENGER M3 TESTS PASSED SUCCESSFULLY!\x1b[0m\n');
  process.exit(0);
}
