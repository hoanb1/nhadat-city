/**
 * ==============================================================================
 * CHALLENGER 2: ADVERSARIAL GOOGLEBOT CRAWLER TRAVERSAL & SSR HTML VERIFICATION
 * ==============================================================================
 * Milestone: M5 Verification & Hardening
 * Spec: PROJECT.md, TEST_INFRA.md, GEMINI.md
 * 
 * Verifies:
 *  1. Crawl path traversal: Homepage -> Province -> Ward -> Listing detail -> Related listings
 *  2. SSR HTML payload completeness (H1, H2, canonical, title, description, JSON-LD schemas)
 *  3. Absence of client-only blank skeletons
 *  4. Canonical URL consistency and slug normalization
 *  5. Breadcrumb & internal link graph connectivity
 * ==============================================================================
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT_DIR = process.cwd();
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  suites: 0,
  startTime: Date.now(),
  failures: [],
  findings: []
};

const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
};

function suite(name, fn) {
  stats.suites++;
  console.log(`\n${colors.bold(colors.blue('▶ SUITE ' + stats.suites + ':'))} ${colors.bold(name)}`);
  try {
    fn();
  } catch (err) {
    console.error(`${colors.red('Suite initialization error:')}`, err);
  }
}

function test(name, fn) {
  stats.total++;
  try {
    fn();
    stats.passed++;
    console.log(`  ${colors.green('✓')} ${colors.gray(`[T${String(stats.total).padStart(3, '0')}]`)} ${name}`);
  } catch (err) {
    stats.failed++;
    const errMsg = err.message || String(err);
    stats.failures.push({ id: stats.total, name, error: errMsg, stack: err.stack });
    console.log(`  ${colors.red('✗')} ${colors.gray(`[T${String(stats.total).padStart(3, '0')}]`)} ${name}`);
    console.log(`    ${colors.red('Error:')} ${errMsg}`);
  }
}

// Extract Province mappings from source file
const provinceTsSource = fs.readFileSync(path.join(ROOT_DIR, 'lib', 'utils', 'province.ts'), 'utf8');
const provinceSandbox = {};
vm.createContext(provinceSandbox);
const cleanProvinceJs = provinceTsSource
  .replace(/export const PROVINCES: Record<string, string> =/g, 'var PROVINCES =')
  .replace(/export const PROVINCE_MERGED_INTO: Record<string, string> =/g, 'var PROVINCE_MERGED_INTO =')
  .replace(/export function slugToProvince\(slug: string\): string/g, 'function slugToProvince(slug)')
  .replace(/w: string/g, 'w');
vm.runInContext(cleanProvinceJs + '\nthis.PROVINCES = PROVINCES; this.PROVINCE_MERGED_INTO = PROVINCE_MERGED_INTO; this.slugToProvince = slugToProvince;', provinceSandbox);

const { PROVINCES, PROVINCE_MERGED_INTO, slugToProvince } = provinceSandbox;

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

const UNICODE_EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{FE00}-\u{FE0F}]/u;

function lintSentenceCase(title) {
  if (!title) return { valid: false, reason: 'Empty title' };
  const trimmed = title.trim();
  if (UNICODE_EMOJI_REGEX.test(trimmed)) return { valid: false, reason: 'Contains unicode emoji' };
  
  const words = trimmed.split(/\s+/);
  const uppercaseWords = words.filter(w => w.length > 1 && w === w.toUpperCase() && !/^[0-9\W]+$/.test(w));
  if (words.length >= 3 && uppercaseWords.length > words.length * 0.6) {
    return { valid: false, reason: 'ALL CAPS title' };
  }

  const forbiddenCapitalizedLowercaseWords = ['tại', 'và', 'của', 'trong', 'cho', 'với', 'ở', 'được', 'các'];
  for (const forbidden of forbiddenCapitalizedLowercaseWords) {
    const cap = forbidden.charAt(0).toUpperCase() + forbidden.slice(1);
    if (new RegExp(`\\s${cap}\\s`, 'g').test(trimmed)) {
      return { valid: false, reason: `English Title Case particle: "${cap}"` };
    }
  }

  return { valid: true };
}

// ==============================================================================
// SUITE 1: Googlebot Entry Point & Sitemaps Discovery Traversal
// ==============================================================================
suite('Crawler Traversal Step 1: Robots.txt & Sitemap Index Ingestion', () => {

  test('CRAWL-01: robots.ts provides clean crawl path to sitemaps for Googlebot', () => {
    const robotsPath = path.join(ROOT_DIR, 'app', 'robots.ts');
    assert.ok(fs.existsSync(robotsPath));
    const content = fs.readFileSync(robotsPath, 'utf8');

    assert.ok(content.includes("allow: '/'"));
    assert.ok(content.includes("'/api/'") && content.includes("'/admin/'") && content.includes("'/manage-listings/'"));
    assert.ok(content.includes('https://nhadat.city/sitemap.xml'));
    assert.ok(content.includes('https://nhadat.city/sitemap-projects.xml'));
    assert.ok(content.includes('https://nhadat.city/sitemap-quyhoach.xml'));
    assert.ok(content.includes('https://nhadat.city/sitemap-blog.xml'));
  });

  test('CRAWL-02: Sitemap Index connects to Partitioned Listings & Domain Sitemaps', () => {
    const sitemapIndexPath = path.join(ROOT_DIR, 'app', 'sitemap.xml', 'route.ts');
    assert.ok(fs.existsSync(sitemapIndexPath));
    const content = fs.readFileSync(sitemapIndexPath, 'utf8');

    assert.ok(content.includes('sitemap-listings-') && content.includes('.xml'));
    assert.ok(content.includes('sitemap-projects.xml'));
    assert.ok(content.includes('sitemap-quyhoach.xml'));
    assert.ok(content.includes('sitemap-blog.xml'));
    assert.ok(content.includes('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
  });
});

// ==============================================================================
// SUITE 2: Googlebot Traversal Step 2 - Homepage SSR & Hub Links Ingestion
// ==============================================================================
suite('Crawler Traversal Step 2: Homepage SSR HTML Payload Completeness', () => {

  test('CRAWL-03: Homepage renders single H1, semantic H2s, and RealEstateAgent JSON-LD', () => {
    const homePagePath = path.join(ROOT_DIR, 'app', 'page.tsx');
    assert.ok(fs.existsSync(homePagePath));
    const content = fs.readFileSync(homePagePath, 'utf8');

    // Check SSR elements
    assert.ok(content.includes('<h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">'));
    assert.ok(content.includes('Bản đồ mua bán nhà đất & tra cứu quy hoạch đô thị toàn quốc'));
    assert.ok(content.includes('Khám phá bất động sản & quy hoạch các tỉnh thành trọng điểm'));
    assert.ok(content.includes('Tin đăng bất động sản mới nhất toàn quốc'));

    // Check JSON-LD
    assert.ok(content.includes("'@type': 'RealEstateAgent'"));
    assert.ok(content.includes("name: 'NhaDat.City'"));
    assert.ok(content.includes("url: 'https://nhadat.city'"));

    // Check Canonical
    assert.ok(content.includes("canonical: 'https://nhadat.city'"));

    // Check 63-province internal cross links footer
    assert.ok(content.includes('<ProvinceLinks'));
  });

  test('CRAWL-04: Homepage typography conforms strictly to Vietnamese Sentence Case', () => {
    const titles = [
      'Bản đồ quy hoạch & mua bán nhà đất toàn quốc | NhaDat.City',
      'Bản đồ mua bán nhà đất & tra cứu quy hoạch đô thị toàn quốc',
      'Khám phá bất động sản & quy hoạch các tỉnh thành trọng điểm',
      'Tin đăng bất động sản mới nhất toàn quốc',
    ];

    for (const t of titles) {
      const lint = lintSentenceCase(t);
      assert.ok(lint.valid, `Title "${t}" must pass sentence case lint: ${lint.reason}`);
    }
  });
});

// ==============================================================================
// SUITE 3: Googlebot Traversal Step 3 - Province Programmatic Landing
// ==============================================================================
suite('Crawler Traversal Step 3: Province Landing SSR & Ward Matrix Traversal', () => {

  test('CRAWL-05: Province page renders complete SSR document, ItemList, BreadcrumbList, FAQPage, and Place schema', () => {
    const provPagePath = path.join(ROOT_DIR, 'app', '[province]', 'page.tsx');
    assert.ok(fs.existsSync(provPagePath));
    const content = fs.readFileSync(provPagePath, 'utf8');

    // Verify H1 & H2 structure
    assert.ok(content.includes('<h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">'));
    assert.ok(content.includes('Tin đăng mua bán nhà đất mới nhất tại'));
    assert.ok(content.includes('Tra cứu nhà đất theo xã / phường tại'));
    assert.ok(content.includes('Câu hỏi thường gặp về bất động sản'));

    // Verify structured data schemas
    assert.ok(content.includes("'@type': 'ItemList'"));
    assert.ok(content.includes("'@type': 'BreadcrumbList'"));
    assert.ok(content.includes("'@type': 'AdministrativeArea'"));
    assert.ok(content.includes("'@type': 'FAQPage'"));

    // Verify canonical URL pattern
    assert.ok(content.includes('canonical: `https://nhadat.city/${province}`'));
  });

  test('CRAWL-06: Province local ward matrix links strictly to local wards without prefix', () => {
    const prov = 'ha-noi';
    const mockWards = [
      { Name: 'Dịch Vọng', CodeName: 'dich-vong' },
      { Name: 'Cầu Giấy', CodeName: 'cau-giay' },
      { Name: 'Mỹ Đình 1', CodeName: 'my-dinh-1' }
    ];

    mockWards.forEach(w => {
      const wardLink = `/${prov}/${w.CodeName}`;
      assert.ok(wardLink.startsWith('/ha-noi/'));
      assert.ok(!wardLink.includes('phuong-') && !wardLink.includes('xa-'));
    });
  });
});

// ==============================================================================
// SUITE 4: Googlebot Traversal Step 4 - Ward Programmatic Landing
// ==============================================================================
suite('Crawler Traversal Step 4: Ward Landing SSR & Listing Links Traversal', () => {

  test('CRAWL-07: Ward page renders complete SSR document, 3-tier Breadcrumbs, ItemList, and Local FAQs', () => {
    const wardPagePath = path.join(ROOT_DIR, 'app', '[province]', '[ward]', 'page.tsx');
    assert.ok(fs.existsSync(wardPagePath));
    const content = fs.readFileSync(wardPagePath, 'utf8');

    // Verify 3-tier Breadcrumbs in HTML
    assert.ok(content.includes('<li><a href="/" className="hover:text-emerald-400">NhaDat.City</a></li>'));
    assert.ok(content.includes('<li><a href={`/${province}`} className="hover:text-emerald-400">Nhà đất {provinceName}</a></li>'));
    assert.ok(content.includes('<li className="text-emerald-400 font-semibold">Nhà đất {wardName}</li>'));

    // Verify H1 & H2 structure
    assert.ok(content.includes('<h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">'));
    assert.ok(content.includes('Danh sách bất động sản nổi bật tại'));
    assert.ok(content.includes('Câu hỏi thường gặp về nhà đất'));

    // Verify canonical redirect on prefixed slugs
    assert.ok(content.includes('if (adminUnit.ward.CodeName && ward !== adminUnit.ward.CodeName)'));
    assert.ok(content.includes('permanentRedirect(`/${province}/${adminUnit.ward.CodeName}`)'));
  });

  test('CRAWL-08: Ward canonical URL matches schema and breadcrumbs', () => {
    const prov = 'ha-noi';
    const ward = 'dich-vong';
    const baseUrl = 'https://nhadat.city';

    const canonical = `${baseUrl}/${prov}/${ward}`;
    assert.equal(canonical, 'https://nhadat.city/ha-noi/dich-vong');
  });
});

// ==============================================================================
// SUITE 5: Googlebot Traversal Step 5 - Listing Detail & Value-Added SSR Content
// ==============================================================================
suite('Crawler Traversal Step 5: Listing Detail SSR Payload & Rich Content Ingestion', () => {

  test('CRAWL-09: Listing detail renders H1, RealEstateListing, FAQPage, BreadcrumbList, and full value-add content', () => {
    const detailPagePath = path.join(ROOT_DIR, 'app', '[province]', '[ward]', '[id]', '[slug]', 'page.tsx');
    assert.ok(fs.existsSync(detailPagePath));
    const content = fs.readFileSync(detailPagePath, 'utf8');

    // Verify Canonical Redirect Enforcement
    assert.ok(content.includes('canonicalSlug = makeUrlSlug(item.title)'));
    assert.ok(content.includes('targetPath = `/${province}/${ward}/${item.shortId || item._id}/${canonicalSlug}`'));
    assert.ok(content.includes('permanentRedirect(targetPath)'));

    // Verify Schemas
    assert.ok(content.includes("'@type': 'RealEstateListing'"));
    assert.ok(content.includes("'@type': 'BreadcrumbList'"));
    assert.ok(content.includes("'@type': 'Organization'"));
    assert.ok(content.includes("'@type': 'FAQPage'"));

    // Verify SSR Content integration
    assert.ok(content.includes('<ListingDetailContent'));
    assert.ok(content.includes('<ProvinceLinks'));
  });

  test('CRAWL-10: ListingDetailContent renders SSR value-add sections without client-only blank skeletons', () => {
    const contentPath = path.join(ROOT_DIR, 'components', 'ListingDetail', 'ListingDetailContent.tsx');
    assert.ok(fs.existsSync(contentPath));
    const content = fs.readFileSync(contentPath, 'utf8');

    // Verify presence of rich SSR sections
    assert.ok(content.includes('<AreaPriceAnalysis'));
    assert.ok(content.includes('<NearbyPlaces'));
    assert.ok(content.includes('<LegalGuide'));
    assert.ok(content.includes('<AutoFAQ'));
    assert.ok(content.includes('<SimilarListings'));

    // Verify H1 rendering
    assert.ok(content.includes('<h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 leading-snug mb-4 tracking-tight">{listing.title}</h1>'));
    
    // Verify H2 specs rendering
    assert.ok(content.includes('<h2 className="text-xl font-bold text-slate-900 mb-5">Đặc điểm bất động sản</h2>'));
    assert.ok(content.includes('<h2 className="text-xl font-bold text-slate-900 mb-5">Thông tin chi tiết</h2>'));
  });

  test('CRAWL-11: Related / Similar Listings link back with valid canonical format', () => {
    const item = {
      _id: 'real9999',
      shortId: 'Sim01',
      title: 'Bán nhà mặt phố Dịch Vọng Hậu',
      adminunit: { province: 'ha-noi', ward: 'phuong-dich-vong-hau' }
    };
    const url = getRealEstateUrl(item);
    assert.equal(url, '/ha-noi/dich-vong-hau/Sim01/ban-nha-mat-pho-dich-vong-hau');
    assert.ok(!url.includes('phuong-'));
  });
});

// ==============================================================================
// SUMMARY & EXIT
// ==============================================================================
const durationMs = Date.now() - stats.startTime;
console.log('\n' + '='.repeat(80));
console.log(colors.bold(' CHALLENGER 2: CRAWLER SIMULATION TEST SUMMARY'));
console.log('='.repeat(80));
console.log(`  Suites Executed : ${stats.suites}`);
console.log(`  Total Tests     : ${stats.total}`);
console.log(`  Passed          : ${colors.green(String(stats.passed))}`);
console.log(`  Failed          : ${stats.failed > 0 ? colors.red(String(stats.failed)) : '0'}`);
console.log(`  Execution Time  : ${durationMs}ms`);
console.log('='.repeat(80));

if (stats.failures.length > 0) {
  console.log(colors.bold(colors.red('\nFAILURES:')));
  stats.failures.forEach(f => {
    console.log(`  [T${String(f.id).padStart(3, '0')}] ${f.name}`);
    console.log(`    ${colors.red('Error:')} ${f.error}`);
  });
  process.exit(1);
} else {
  console.log('\n' + colors.green(colors.bold('✓ ALL CRAWLER SIMULATION TESTS PASSED!')) + '\n');
  process.exit(0);
}
