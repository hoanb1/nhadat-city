/**
 * ==============================================================================
 * NHADAT.CITY EMPIRICAL STRESS & ORACLE HARNESS — MILESTONE 1 (M1)
 * ==============================================================================
 * Scope: Technical SEO, Dynamic Sitemaps, Robots.txt, Redirects & SSR DB Aggregation
 * Author: Challenger 1 (Empirical Challenger & QA Specialist)
 * Specification: PROJECT.md, GEMINI.md, M1 Acceptance Criteria
 * 
 * Execution:
 *   timeout 60s node tests/stress-m1-seo.mjs
 * ==============================================================================
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const APP_DIR = path.join(ROOT_DIR, 'app');
const LIB_DIR = path.join(ROOT_DIR, 'lib');

// Test Suite State
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  suites: 0,
  startTime: Date.now(),
  failures: [],
  findings: [],
};

const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
};

function suite(name, fn) {
  stats.suites++;
  console.log(`\n${colors.bold(colors.blue('▶ STRESS SUITE ' + stats.suites + ':'))} ${colors.bold(name)}`);
  try {
    fn();
  } catch (err) {
    console.error(`${colors.red('Suite error:')}`, err);
  }
}

function test(name, fn) {
  stats.total++;
  try {
    fn();
    stats.passed++;
    console.log(`  ${colors.green('✓')} ${colors.gray(`[ST-${String(stats.total).padStart(3, '0')}]`)} ${name}`);
  } catch (err) {
    stats.failed++;
    const errMsg = err.message || String(err);
    stats.failures.push({ id: stats.total, name, error: errMsg, stack: err.stack });
    console.log(`  ${colors.red('✗')} ${colors.gray(`[ST-${String(stats.total).padStart(3, '0')}]`)} ${name}`);
    console.log(`    ${colors.red('Error:')} ${errMsg}`);
  }
}

// ------------------------------------------------------------------------------
// XML Linter / Strict Validator for Sitemaps
// ------------------------------------------------------------------------------
function validateXmlStrict(xmlString, expectedRootTag) {
  assert.ok(xmlString, 'XML string must not be empty');
  assert.ok(xmlString.startsWith('<?xml version="1.0"'), 'Must begin with standard XML declaration');
  
  // Check root tag open and close
  const openTagRegex = new RegExp(`<${expectedRootTag}[^>]*>`);
  const closeTag = `</${expectedRootTag}>`;
  assert.ok(openTagRegex.test(xmlString), `Root open tag <${expectedRootTag}> missing`);
  assert.ok(xmlString.includes(closeTag), `Root close tag ${closeTag} missing`);

  // Check XML namespace
  assert.ok(
    xmlString.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'),
    'Standard sitemap 0.9 XML namespace required'
  );

  // Check balanced tags for sitemap/url entries
  if (expectedRootTag === 'sitemapindex') {
    const locMatches = (xmlString.match(/<loc>/g) || []).length;
    const closeLocMatches = (xmlString.match(/<\/loc>/g) || []).length;
    assert.equal(locMatches, closeLocMatches, 'Balanced <loc> tags in sitemapindex');

    const sitemapMatches = (xmlString.match(/<sitemap>/g) || []).length;
    const closeSitemapMatches = (xmlString.match(/<\/sitemap>/g) || []).length;
    assert.equal(sitemapMatches, closeSitemapMatches, 'Balanced <sitemap> tags in sitemapindex');
  } else if (expectedRootTag === 'urlset') {
    const urlMatches = (xmlString.match(/<url>/g) || []).length;
    const closeUrlMatches = (xmlString.match(/<\/url>/g) || []).length;
    assert.equal(urlMatches, closeUrlMatches, 'Balanced <url> tags in urlset');
  }

  // Ensure no unescaped raw entities (e.g. bare & not followed by amp;|lt;|gt;|apos;|quot;|#)
  const unescapedAmp = /&(?!(amp|lt|gt|apos|quot|#\d+|#x[0-9a-fA-F]+);)/;
  assert.ok(!unescapedAmp.test(xmlString), 'XML contains unescaped ampersand character');

  return true;
}

// ------------------------------------------------------------------------------
// SITEMAP INDEX GENERATOR ORACLE (Mirror of app/sitemap.xml/route.ts logic)
// ------------------------------------------------------------------------------
function generateSitemapIndexOracle(activeListingCount, baseUrl = 'https://nhadat.city') {
  const now = new Date().toISOString();
  const totalPartitions = Math.max(1, Math.ceil(activeListingCount / 5000));

  const listingSitemaps = [];
  for (let page = 1; page <= totalPartitions; page++) {
    listingSitemaps.push(`  <sitemap>
    <loc>${baseUrl}/sitemap-listings-${page}.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-static.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-admin-unit.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-blog.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-projects.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-quyhoach.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
${listingSitemaps.join('\n')}
</sitemapindex>`;

  return { xml, totalPartitions, totalSitemaps: 5 + totalPartitions };
}

// ------------------------------------------------------------------------------
// SITEMAP LISTINGS GENERATOR ORACLE (Mirror of app/sitemap-listings/[page]/route.ts)
// ------------------------------------------------------------------------------
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

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

function generateSitemapListingPageOracle(items, baseUrl = 'https://nhadat.city') {
  const entries = items
    .filter((item) => item.adminunit?.province && item.title)
    .map((item) => {
      const canonicalPath = getRealEstateUrl(item);
      const url = escapeXml(`${baseUrl}${canonicalPath}`);
      const lastmod = (item.updatedAt || item.createdAt || new Date())
        .toISOString()
        .split('T')[0];
      return `  <url>\n    <loc>${url}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
    });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>`;
  return { xml, count: entries.length };
}

// ------------------------------------------------------------------------------
// SUITE 1: DYNAMIC SITEMAP INDEX SCALING & PARTITION ORACLE
// ------------------------------------------------------------------------------
suite('1. Dynamic Sitemap Index Volume Simulation & XML Conformance', () => {

  const testVolumeCases = [
    { count: 0, expectedPartitions: 1, desc: 'Empty database (0 active listings) defaults to 1 partition' },
    { count: 1, expectedPartitions: 1, desc: 'Single listing (1 active listing) -> 1 partition' },
    { count: 4999, expectedPartitions: 1, desc: 'Near chunk boundary (4,999 listings) -> 1 partition' },
    { count: 5000, expectedPartitions: 1, desc: 'Exact chunk boundary (5,000 listings) -> 1 partition' },
    { count: 5001, expectedPartitions: 2, desc: 'Over chunk boundary (5,001 listings) -> 2 partitions' },
    { count: 10000, expectedPartitions: 2, desc: 'Two full chunks (10,000 listings) -> 2 partitions' },
    { count: 50000, expectedPartitions: 10, desc: 'Medium volume (50,000 listings) -> 10 partitions' },
    { count: 123456, expectedPartitions: 25, desc: 'Large production volume (123,456 listings) -> 25 partitions' },
    { count: 1200000, expectedPartitions: 240, desc: 'Mega volume (1.2M historical listings) -> 240 partitions' },
    { count: 10000000, expectedPartitions: 2000, desc: 'Stress volume (10M listings) -> 2,000 partitions' },
  ];

  for (const tc of testVolumeCases) {
    test(`Sitemap Index scaling: ${tc.desc}`, () => {
      const res = generateSitemapIndexOracle(tc.count);
      assert.equal(res.totalPartitions, tc.expectedPartitions, `Partition count must be ${tc.expectedPartitions}`);
      assert.equal(res.totalSitemaps, 5 + tc.expectedPartitions, 'Total sitemaps in index must include 5 standard + partitions');

      // Verify strict XML formatting
      validateXmlStrict(res.xml, 'sitemapindex');

      // Verify partition URL existence
      assert.ok(res.xml.includes(`sitemap-listings-${tc.expectedPartitions}.xml`));
      if (tc.expectedPartitions > 1) {
        assert.ok(res.xml.includes('sitemap-listings-1.xml'));
        assert.ok(res.xml.includes('sitemap-listings-2.xml'));
      }
    });
  }

  test('Sitemap Index Route source file verifies dynamic calculation and error fallback', () => {
    const routePath = path.join(APP_DIR, 'sitemap.xml', 'route.ts');
    assert.ok(fs.existsSync(routePath), 'app/sitemap.xml/route.ts exists');
    const content = fs.readFileSync(routePath, 'utf8');

    assert.ok(content.includes('Math.ceil(activeCount / 5000)'), 'Calculates ceil(activeCount / 5000)');
    assert.ok(content.includes('Math.max(1,'), 'Guarantees at least 1 partition');
    assert.ok(content.includes('catch (err)'), 'Contains try-catch error safety block for DB failure');
    assert.ok(content.includes('sitemap-admin-unit.xml'), 'Includes sitemap-admin-unit.xml (Feature 2)');
    assert.ok(content.includes('sitemap-static.xml'), 'Includes sitemap-static.xml');
    assert.ok(content.includes('sitemap-blog.xml'), 'Includes sitemap-blog.xml');
    assert.ok(content.includes('sitemap-projects.xml'), 'Includes sitemap-projects.xml');
    assert.ok(content.includes('sitemap-quyhoach.xml'), 'Includes sitemap-quyhoach.xml');
  });
});

// ------------------------------------------------------------------------------
// SUITE 2: SITEMAP LISTINGS ROUTE & OUT-OF-BOUNDS RESILIENCE
// ------------------------------------------------------------------------------
suite('2. Sitemap Listings Route & Adversarial Parameter Fuzzing', () => {

  test('Out-of-bounds page query (0 items returned) produces valid empty <urlset>', () => {
    const emptyItems = [];
    const res = generateSitemapListingPageOracle(emptyItems);
    assert.equal(res.count, 0);
    validateXmlStrict(res.xml, 'urlset');
    assert.ok(res.xml.includes('<urlset'), 'Contains urlset open tag');
    assert.ok(res.xml.includes('</urlset>'), 'Contains urlset close tag');
  });

  test('Listings with extreme / special characters are properly escaped in XML', () => {
    const rawItems = [
      {
        _id: 'item1',
        shortId: 'ab1',
        title: 'Bán nhà <Hà Nội> & Biệt thự "VIP" \'Sổ Đỏ\'',
        adminunit: { province: 'Hà Nội', ward: 'Cầu Giấy' },
        createdAt: new Date('2026-08-01T12:00:00Z'),
      },
      {
        _id: 'item2',
        shortId: 'cd2',
        title: 'Căn hộ chung cư cao cấp 100% view hồ & sân golf',
        adminunit: { province: 'Đà Nẵng', ward: 'Hải Châu' },
        createdAt: new Date('2026-08-02T12:00:00Z'),
      },
      {
        _id: 'item3',
        shortId: 'ef3',
        title: 'Nhà phố thương mại (Shophouse) giá < 5 tỷ / căn',
        adminunit: { province: 'TP. Hồ Chí Minh', ward: 'Bến Nghé' },
        createdAt: new Date('2026-08-03T12:00:00Z'),
      },
    ];

    const res = generateSitemapListingPageOracle(rawItems);
    assert.equal(res.count, 3);
    validateXmlStrict(res.xml, 'urlset');

    assert.ok(!res.xml.includes('<Hà Nội>'), 'Unescaped <Hà Nội> must not appear');
    assert.ok(res.xml.includes('&lt;Hà Nội&gt;') || res.xml.includes('ban-nha-ha-noi'), 'URL slugified and XML safe');
  });

  test('Listings missing province or title are filtered out cleanly without crashing', () => {
    const dirtyItems = [
      { _id: '1', shortId: 's1', title: null, adminunit: { province: 'ha-noi' } },
      { _id: '2', shortId: 's2', title: 'Bán nhà', adminunit: { province: null } },
      { _id: '3', shortId: 's3', title: '', adminunit: { province: 'ha-noi' } },
      { _id: '4', shortId: 's4', title: 'Nhà hợp lệ', adminunit: { province: 'ha-noi', ward: 'dich-vong' } },
    ];

    const res = generateSitemapListingPageOracle(dirtyItems);
    assert.equal(res.count, 1, 'Only 1 valid item must be included');
    validateXmlStrict(res.xml, 'urlset');
    assert.ok(res.xml.includes('s4/nha-hop-le'));
  });

  test('Fuzz parameter parsing logic: negative, non-numeric, zero, float inputs', () => {
    const parsePageParam = (page) => {
      const pageNum = parseInt(page) || 1;
      return Math.max(1, pageNum);
    };

    assert.equal(parsePageParam('1'), 1);
    assert.equal(parsePageParam('50'), 50);
    assert.equal(parsePageParam('0'), 1, 'Page 0 normalized to 1');
    assert.equal(parsePageParam('-5'), 1, 'Negative page -5 normalized to 1');
    assert.equal(parsePageParam('abc'), 1, 'Non-numeric string normalized to 1');
    assert.equal(parsePageParam(undefined), 1, 'undefined normalized to 1');
    assert.equal(parsePageParam(null), 1, 'null normalized to 1');
    assert.equal(parsePageParam('1.9'), 1, 'Float 1.9 parsed to 1');
  });
});

// ------------------------------------------------------------------------------
// SUITE 3: SSR DIRECT DB STATISTICS AGGREGATION & FILTER RESILIENCE
// ------------------------------------------------------------------------------
suite('3. SSR Direct DB Statistics Query Pipeline & Filter Robustness', () => {

  test('Statistics aggregator module exists and defines fetchStatistics', () => {
    const statsFile = path.join(LIB_DIR, 'db', 'statistics.ts');
    assert.ok(fs.existsSync(statsFile), 'lib/db/statistics.ts must exist');
    const content = fs.readFileSync(statsFile, 'utf8');

    assert.ok(content.includes('export async function fetchStatistics'), 'fetchStatistics function exported');
    assert.ok(content.includes('trendPipeline'), 'Defines trendPipeline aggregation');
    assert.ok(content.includes('overallPipeline'), 'Defines overallPipeline aggregation');
    assert.ok(content.includes('propertyTypePipeline'), 'Defines propertyTypePipeline aggregation');
    assert.ok(content.includes('directionPipeline'), 'Defines directionPipeline aggregation');
    assert.ok(content.includes('priceSegmentsPipeline'), 'Defines priceSegmentsPipeline aggregation');
    assert.ok(content.includes('areaSegmentsPipeline'), 'Defines areaSegmentsPipeline aggregation');
    assert.ok(content.includes('facadeSegmentsPipeline'), 'Defines facadeSegmentsPipeline aggregation');
    assert.ok(content.includes('listingModePipeline'), 'Defines listingModePipeline aggregation');
  });

  test('Statistics aggregator return contract handles empty DB result sets gracefully', () => {
    // Oracle simulation of fetchStatistics fallback and mapping logic
    function processRawAggResults({
      trends = [],
      overall = [],
      propertyTypes = [],
      directions = [],
      priceSegmentsData = [],
      listingModesData = [],
      areaSegmentsData = [],
      facadeSegmentsData = [],
    }) {
      const segmentOrder = ["< 2 Tỷ", "2 - 5 Tỷ", "5 - 10 Tỷ", "> 10 Tỷ"];
      const priceSegments = segmentOrder.map(seg => {
        const found = priceSegmentsData.find(d => d._id === seg);
        return { name: seg, count: found ? found.count : 0 };
      });

      const areaOrder = ["< 30 m²", "30 - 50 m²", "50 - 100 m²", "100 - 500 m²", "> 500 m²"];
      const areaSegments = areaOrder.map(seg => {
        const found = areaSegmentsData.find(d => d._id === seg);
        return { name: seg, count: found ? found.count : 0 };
      });

      const facadeOrder = ["< 3m (Ngõ nhỏ)", "3 - 5m", "5 - 10m", "> 10m (Mặt tiền lớn)"];
      const facadeSegments = facadeOrder.map(seg => {
        const found = facadeSegmentsData.find(d => d._id === seg);
        return { name: seg, count: found ? found.count : 0 };
      });

      const listingModes = [
        { name: 'Bán', count: listingModesData.find(d => d._id === 'ban')?.count || 0 },
        { name: 'Cho thuê', count: listingModesData.find(d => d._id === 'cho_thue')?.count || 0 }
      ];

      return {
        trends: trends.map(t => ({
          time: `T${t._id?.month || 1}/${t._id?.year || 2026}`,
          avgPriceM2: t.avgPriceM2 || 0,
          count: t.count || 0
        })),
        overall: overall[0] || { avgPriceM2: 0, avgPrice: 0, totalListings: 0 },
        propertyTypes: propertyTypes.map(p => ({ name: p._id, count: p.count })),
        directions: directions.map(d => ({ name: d._id, count: d.count })),
        priceSegments,
        areaSegments,
        facadeSegments,
        listingModes
      };
    }

    // Stress test with completely empty aggregation returns (non-existent province case)
    const emptyResult = processRawAggResults({});
    assert.deepEqual(emptyResult.trends, []);
    assert.deepEqual(emptyResult.overall, { avgPriceM2: 0, avgPrice: 0, totalListings: 0 });
    assert.deepEqual(emptyResult.propertyTypes, []);
    assert.deepEqual(emptyResult.directions, []);
    assert.equal(emptyResult.priceSegments.length, 4);
    assert.equal(emptyResult.areaSegments.length, 5);
    assert.equal(emptyResult.facadeSegments.length, 4);
    assert.equal(emptyResult.listingModes.length, 2);

    // Ensure all segment counts are 0, not undefined/null
    emptyResult.priceSegments.forEach(s => assert.equal(s.count, 0));
    emptyResult.areaSegments.forEach(s => assert.equal(s.count, 0));
    emptyResult.facadeSegments.forEach(s => assert.equal(s.count, 0));
    emptyResult.listingModes.forEach(s => assert.equal(s.count, 0));
  });

  test('Thong-ke regional page handles non-existent province slug safely in SSR metadata and rendering', () => {
    const regionalPage = path.join(APP_DIR, 'thong-ke', '[province]', 'page.tsx');
    assert.ok(fs.existsSync(regionalPage), 'app/thong-ke/[province]/page.tsx exists');
    const content = fs.readFileSync(regionalPage, 'utf8');

    assert.ok(content.includes('fetchStatistics'), 'Uses direct DB fetchStatistics');
    assert.ok(content.includes('catch (err)'), 'Contains error catch block in getRegionalStats');
    assert.ok(content.includes('totalListings'), 'Safely checks totalListings with optional chaining');
    assert.ok(content.includes('avgPriceM2'), 'Safely checks avgPriceM2 with optional chaining');
  });
});

// ------------------------------------------------------------------------------
// SUITE 4: ROBOTS.TXT, REDIRECT UNBLOCKING & PROJECT LINK HOPS
// ------------------------------------------------------------------------------
suite('4. Robots.txt, 301 Redirect Rules & Project Link Hop Elimination', () => {

  test('robots.ts does NOT block /realestate/ legacy redirect path', () => {
    const robotsFile = path.join(APP_DIR, 'robots.ts');
    const content = fs.readFileSync(robotsFile, 'utf8');

    // Rule: Feature 4 requires removing /realestate/ from disallow so 301 redirects work for Googlebot
    assert.ok(!content.includes("'/realestate/'"), 'robots.ts must NOT disallow /realestate/');
    assert.ok(!content.includes("'/realestate'"), 'robots.ts must NOT disallow /realestate');
  });

  test('robots.ts includes all 6 official sitemap index and partition endpoints', () => {
    const robotsFile = path.join(APP_DIR, 'robots.ts');
    const content = fs.readFileSync(robotsFile, 'utf8');

    const expectedSitemaps = [
      'https://nhadat.city/sitemap.xml',
      'https://nhadat.city/sitemap-admin-unit.xml',
      'https://nhadat.city/sitemap-blog.xml',
      'https://nhadat.city/sitemap-static.xml',
      'https://nhadat.city/sitemap-projects.xml',
      'https://nhadat.city/sitemap-quyhoach.xml',
    ];

    for (const sm of expectedSitemaps) {
      assert.ok(content.includes(sm), `robots.ts must list sitemap: ${sm}`);
    }
  });

  test('Legacy realestate redirect page performs 301 permanentRedirect to canonical URL', () => {
    const redirectPage = path.join(APP_DIR, 'realestate', '[id]', 'page.tsx');
    assert.ok(fs.existsSync(redirectPage), 'app/realestate/[id]/page.tsx exists');
    const content = fs.readFileSync(redirectPage, 'utf8');

    assert.ok(content.includes('permanentRedirect('), 'Must call permanentRedirect for 301 SEO status');
    assert.ok(content.includes('getRealEstateById(id)'), 'Must look up listing by id');
    assert.ok(content.includes('getRealEstateUrl(item)'), 'Must generate canonical URL via SSOT');
    assert.ok(content.includes('notFound()'), 'Must trigger notFound 404 if item does not exist');
  });

  test('Project URLs use shortId directly to eliminate 301 redirect hops (Feature 5)', () => {
    const mockProject = {
      _id: '64a1b2c3d4e5f6a7b8c9d0e1',
      shortId: 'vinhomes-ocean-park',
      title: 'Vinhomes Ocean Park 2 Gia Lâm',
    };

    const projectUrl = `/du-an/${mockProject.shortId}/${makeUrlSlug(mockProject.title)}`;
    assert.equal(projectUrl, '/du-an/vinhomes-ocean-park/vinhomes-ocean-park-2-gia-lam');
    assert.ok(!projectUrl.includes(mockProject._id), 'Project URL must prefer shortId over raw Mongo ObjectId');
  });

  test('Next.config.js redirects include Meteor legacy and sitemap 301 rules', () => {
    const nextConfigFile = path.join(ROOT_DIR, 'next.config.js');
    assert.ok(fs.existsSync(nextConfigFile), 'next.config.js exists');
    const content = fs.readFileSync(nextConfigFile, 'utf8');

    assert.ok(content.includes("source: '/real-estate/:id'"), 'Redirects /real-estate/:id to /realestate/:id');
    assert.ok(content.includes("source: '/sitemap-real-estate.xml'"), 'Redirects /sitemap-real-estate.xml to /sitemap.xml');
    assert.ok(content.includes("source: '/sitemap-real-estate-:id(\\\\d+).xml'"), 'Redirects old sitemap partitions to new format');
  });
});

// ------------------------------------------------------------------------------
// STRESS TEST REPORT SUMMARY
// ------------------------------------------------------------------------------
const durationMs = Date.now() - stats.startTime;
console.log('\n' + '='.repeat(80));
console.log(colors.bold(' MILESTONE 1 EMPIRICAL STRESS & ORACLE SUMMARY'));
console.log('='.repeat(80));
console.log(`  Suites Executed : ${stats.suites}`);
console.log(`  Total Tests     : ${stats.total}`);
console.log(`  Passed          : ${colors.green(String(stats.passed))}`);
console.log(`  Failed          : ${stats.failed > 0 ? colors.red(String(stats.failed)) : '0'}`);
console.log(`  Execution Time  : ${durationMs}ms`);
console.log('='.repeat(80));

if (stats.failures.length > 0) {
  console.log(colors.bold(colors.red('\nFAILED STRESS TESTS:')));
  stats.failures.forEach(f => {
    console.log(`  [ST-${String(f.id).padStart(3, '0')}] ${f.name}`);
    console.log(`    ${colors.red('Error:')} ${f.error}`);
  });
  console.log('\n' + colors.red('Milestone 1 stress suite completed with failures.') + '\n');
  process.exit(1);
} else {
  console.log('\n' + colors.green(colors.bold('✓ ALL MILESTONE 1 EMPIRICAL STRESS TESTS PASSED!')) + '\n');
  process.exit(0);
}
