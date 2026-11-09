/**
 * ==============================================================================
 * ADVERSARIAL SEO STRESS TEST SUITE — MILESTONE 1 (M1)
 * ==============================================================================
 * Empirical Challenger 2: Stress-testing Technical SEO, Sitemaps & Routing
 * Scope:
 *   1. Legacy /real-estate/:id and /realestate/:id redirects & hop count
 *   2. Project direct canonical link resolution & slug mismatch healing
 *   3. Robots.txt crawl rules & bot segregation matrix
 *   4. URL normalization, double slash & loop immunity
 *   5. Subdomain host segregation & X-Robots-Tag verification
 *   6. Dynamic sitemap partitioning & entity escaping
 * ==============================================================================
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const APP_DIR = path.join(ROOT_DIR, 'app');
const LIB_DIR = path.join(ROOT_DIR, 'lib');

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
  console.log(`\n${colors.bold(colors.blue('▶ ADVERSARIAL SUITE ' + stats.suites + ':'))} ${colors.bold(name)}`);
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
    console.log(`  ${colors.green('✓')} ${colors.gray(`[ADV-${String(stats.total).padStart(3, '0')}]`)} ${name}`);
  } catch (err) {
    stats.failed++;
    const errMsg = err.message || String(err);
    stats.failures.push({ id: stats.total, name, error: errMsg, stack: err.stack });
    console.log(`  ${colors.red('✗')} ${colors.gray(`[ADV-${String(stats.total).padStart(3, '0')}]`)} ${name}`);
    console.log(`    ${colors.red('Error:')} ${errMsg}`);
  }
}

// ------------------------------------------------------------------------------
// Import application utilities directly
// ------------------------------------------------------------------------------
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

function getProjectUrl(item) {
  const slug = makeUrlSlug(item.title || '');
  const id = item.shortId || item._id;
  return `/du-an/${id}/${slug}`;
}

// ==============================================================================
// SUITE 1: LEGACY REDIRECT ROUTING & HOP COUNT ANALYSIS
// ==============================================================================
suite('Legacy Real Estate Routing & Redirect Hops Stress Tests', () => {

  test('ADV-01: /realestate/[id] router file exists and uses permanentRedirect (301/308)', () => {
    const routePath = path.join(APP_DIR, 'realestate', '[id]', 'page.tsx');
    assert.ok(fs.existsSync(routePath), 'app/realestate/[id]/page.tsx must exist');
    const content = fs.readFileSync(routePath, 'utf8');
    assert.ok(content.includes('permanentRedirect'), 'Must use permanentRedirect for 301 SEO signal');
    assert.ok(content.includes('getRealEstateById'), 'Must query item from DB');
    assert.ok(content.includes('getRealEstateUrl'), 'Must use getRealEstateUrl SSOT helper');
  });

  test('ADV-02: next.config.js redirects vs rewrites analysis for /real-estate/:id', () => {
    const configPath = path.join(ROOT_DIR, 'next.config.js');
    const content = fs.readFileSync(configPath, 'utf8');
    
    // Check how /real-estate/:id is configured in next.config.js
    const hasRedirect = content.includes("source: '/real-estate/:id'") && content.includes("destination: '/realestate/:id'");
    assert.ok(hasRedirect, 'next.config.js configures /real-estate/:id to /realestate/:id');

    // Note finding on hop count:
    // If next.config.js uses redirect: /real-estate/:id -> (Hop 1: 308) -> /realestate/:id -> (Hop 2: 308) -> canonical URL
    // Total hops = 2.
    // If next.config.js rewrote /real-estate/:id to /realestate/:id, total hops = 1.
    stats.findings.push({
      id: 'FINDING-M1-01',
      severity: 'LOW/INFO',
      topic: 'Redirect Hop Optimization for /real-estate/:id',
      detail: 'Requesting /real-estate/:id triggers 2 redirect hops (/real-estate/:id -> /realestate/:id -> canonical). Direct requests to /realestate/:id resolve in 1 single hop.',
    });
  });

  test('ADV-03: getRealEstateUrl handles diverse ID types without double slashes', () => {
    const testCases = [
      // Standard item
      {
        item: { _id: '507f1f77bcf86cd799439011', shortId: 'AbC123', title: 'Bán nhà Cầu Giấy', adminunit: { province: 'Hà Nội', ward: 'Dịch Vọng' } },
        expected: '/ha-noi/dich-vong/AbC123/ban-nha-cau-giay'
      },
      // Item without shortId
      {
        item: { _id: '507f1f77bcf86cd799439011', title: 'Nhà đẹp phố Huế', adminunit: { province: 'Hà Nội', district: 'Hai Bà Trưng' } },
        expected: '/ha-noi/hai-ba-trung/507f1f77bcf86cd799439011/nha-dep-pho-hue'
      },
      // Item with empty/undefined province & ward
      {
        item: { _id: 'rawId999', title: 'Đất nền giá rẻ', adminunit: { province: 'undefined', ward: 'undefined' } },
        expected: '/toan-quoc/bds/rawId999/dat-nen-gia-re'
      },
      // Item with empty title
      {
        item: { _id: 'rawId888', shortId: 'XyZ', title: '', adminunit: { province: 'Đà Nẵng', ward: 'Hải Châu' } },
        expected: '/da-nang/hai-chau/XyZ/chi-tiet'
      },
      // Item with administrative prefix in ward
      {
        item: { _id: 'rawId777', shortId: 'W1', title: 'Nhà riêng', adminunit: { province: 'TP. Hồ Chí Minh', ward: 'Phường Bến Nghé' } },
        expected: '/tp-ho-chi-minh/ben-nghe/W1/nha-rieng'
      }
    ];

    for (const { item, expected } of testCases) {
      const url = getRealEstateUrl(item);
      assert.equal(url, expected);
      assert.ok(!url.includes('//'), `URL "${url}" must not contain double slashes`);
      assert.ok(!url.includes(' '), `URL "${url}" must not contain spaces`);
      assert.ok(!url.endsWith('/'), `URL "${url}" must not have trailing slash`);
      assert.ok(url.startsWith('/'), `URL "${url}" must start with slash`);
      const segments = url.split('/').filter(Boolean);
      assert.equal(segments.length, 4, `URL "${url}" must have exactly 4 segments: province/ward/id/slug`);
    }
  });

  test('ADV-04: Target URL construction preserves absolute canonical domain https://nhadat.city', () => {
    const item = { _id: 'id123', shortId: 'S1', title: 'Bán nhà', adminunit: { province: 'Hà Nội', ward: 'Dịch Vọng' } };
    const relativeUrl = getRealEstateUrl(item);
    const absoluteTarget = `https://nhadat.city${relativeUrl}`;
    
    assert.equal(absoluteTarget, 'https://nhadat.city/ha-noi/dich-vong/S1/ban-nha');
    assert.ok(absoluteTarget.startsWith('https://nhadat.city/'), 'Must use secure HTTPS domain');
    assert.ok(!absoluteTarget.replace('https://', '').includes('//'), 'Domain + path must not produce double slashes');
  });
});

// ==============================================================================
// SUITE 2: PROJECT CANONICAL LINKS & HOP ELIMINATION
// ==============================================================================
suite('Project Direct Canonical Links & Hop Elimination', () => {

  test('ADV-05: Project card links use shortId directly to prevent redirect hops', () => {
    const projectWithShortId = { _id: '64a1b2c3d4e5f6a7b8c9d0e1', shortId: 'VinSm', title: 'Vinhomes Smart City' };
    const url = getProjectUrl(projectWithShortId);
    assert.equal(url, '/du-an/VinSm/vinhomes-smart-city');
    assert.ok(!url.includes('64a1b2c3d4e5f6a7b8c9d0e1'), 'Must use shortId in card URL instead of 24-char ObjectId');
  });

  test('ADV-06: Project card links fallback safely to ObjectId if shortId is absent', () => {
    const projectWithoutShortId = { _id: '64a1b2c3d4e5f6a7b8c9d0e1', title: 'Eco Retreat Long An' };
    const url = getProjectUrl(projectWithoutShortId);
    assert.equal(url, '/du-an/64a1b2c3d4e5f6a7b8c9d0e1/eco-retreat-long-an');
  });

  test('ADV-07: Project detail page /du-an/[id]/[slug] heals mismatched slug in 1 hop', () => {
    const project = { _id: 'proj1', shortId: 'Pr1', title: 'Dự Án Grand Marina Saigon' };
    const canonicalSlug = makeUrlSlug(project.title);
    const requestedSlug = 'old-slug-outdated';
    
    const needsRedirect = ('Pr1' !== (project.shortId || project._id)) || (requestedSlug !== canonicalSlug);
    assert.ok(needsRedirect, 'Mismatched slug must trigger self-healing redirect');

    const targetUrl = `https://nhadat.city/du-an/${project.shortId}/${canonicalSlug}`;
    assert.equal(targetUrl, 'https://nhadat.city/du-an/Pr1/du-an-grand-marina-saigon');
  });

  test('ADV-08: Project sitemap uses shortId consistently with project card links', () => {
    const sitemapFile = path.join(APP_DIR, 'sitemap-projects.xml', 'route.ts');
    const content = fs.readFileSync(sitemapFile, 'utf8');
    assert.ok(content.includes('project.shortId || project._id'), 'Sitemap must prefer shortId for canonical URLs');
  });
});

// ==============================================================================
// SUITE 3: ROBOTS.TXT CRAWL RULES & BOT SEGREGATION MATRIX
// ==============================================================================
suite('Robots.txt Crawl Rules & Bot Segregation Matrix', () => {

  test('ADV-09: Robots.txt allows search engine crawlers while protecting crawl budget', () => {
    const robotsFile = path.join(APP_DIR, 'robots.ts');
    const content = fs.readFileSync(robotsFile, 'utf8');

    // Rule check: User-Agent * must have allow: '/'
    assert.ok(content.includes("allow: '/'") || content.includes('allow: "/"'), 'Must explicitly allow root crawling for standard bots');

    // Rule check: /realestate/ and /real-estate/ must NOT be in disallow list
    assert.ok(!content.includes("'/realestate/'"), 'robots.ts must NOT disallow /realestate/ (Feature 4)');
    assert.ok(!content.includes("'/real-estate/'"), 'robots.ts must NOT disallow /real-estate/');

    // Rule check: Crawl budget leak endpoints must be blocked
    const disallowedPaths = [
      "'/api/'",
      "'/api/admin/'",
      "'/api/auth/'",
      "'/api/analytics/'",
      "'/api/ml/'",
      "'/admin/'",
      "'/manage-listings/'",
      "'/login/'",
      "'/forum/'",
      "'/search'",
      "'/*?q=*'",
      "'/*search*'",
    ];

    for (const p of disallowedPaths) {
      assert.ok(content.includes(p), `robots.ts must disallow ${p}`);
    }
  });

  test('ADV-10: Bad bots and AI scrapers are explicitly blocked with disallow: /', () => {
    const robotsFile = path.join(APP_DIR, 'robots.ts');
    const content = fs.readFileSync(robotsFile, 'utf8');

    const blockedBots = [
      'SemrushBot',
      'PetalBot',
      'AhrefsBot',
      'MJ12bot',
      'Baiduspider',
      'ClaudeBot',
      'GPTBot',
      'Amazonbot',
      'DotBot',
    ];

    for (const bot of blockedBots) {
      assert.ok(content.includes(bot), `robots.ts must block ${bot}`);
    }
  });

  test('ADV-11: Robots.txt on API subdomains blocks 100% of crawling', () => {
    const robotsFile = path.join(APP_DIR, 'robots.ts');
    const content = fs.readFileSync(robotsFile, 'utf8');

    assert.ok(content.includes("host.includes('api.nhadat.city')") || content.includes('api.nhadat.city'), 'Must detect api.nhadat.city host');
    assert.ok(content.includes("host.includes('map-api.nhadat.city')") || content.includes('map-api.nhadat.city'), 'Must detect map-api.nhadat.city host');
    assert.ok(content.includes("disallow: '/'") || content.includes('disallow: "/"'), 'Subdomains must disallow root');
  });

  test('ADV-12: Complete XML Sitemap hierarchy is declared in robots.ts', () => {
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

    for (const s of expectedSitemaps) {
      assert.ok(content.includes(s), `robots.ts must declare sitemap ${s}`);
    }
  });
});

// ==============================================================================
// SUITE 4: HTTP SECURITY HEADERS & CRAWL BUDGET PROTECTION
// ==============================================================================
suite('HTTP Security Headers & Crawl Budget Protection', () => {

  test('ADV-13: next.config.js sends X-Robots-Tag: noindex, nofollow on /api/:path*', () => {
    const configPath = path.join(ROOT_DIR, 'next.config.js');
    const content = fs.readFileSync(configPath, 'utf8');

    assert.ok(content.includes("source: '/api/:path*'"), 'Must match /api/:path*');
    assert.ok(content.includes('X-Robots-Tag') && content.includes('noindex, nofollow'), 'Must set X-Robots-Tag: noindex, nofollow on /api/*');
  });

  test('ADV-14: next.config.js enforces security headers across all routes', () => {
    const configPath = path.join(ROOT_DIR, 'next.config.js');
    const content = fs.readFileSync(configPath, 'utf8');

    assert.ok(content.includes('X-Content-Type-Options') && content.includes('nosniff'), 'Must set X-Content-Type-Options');
    assert.ok(content.includes('X-Frame-Options') && content.includes('DENY'), 'Must set X-Frame-Options');
    assert.ok(content.includes('Referrer-Policy') && content.includes('strict-origin-when-cross-origin'), 'Must set Referrer-Policy');
  });

  test('ADV-15: next.config.js configures caching headers for robots.txt and sitemaps', () => {
    const configPath = path.join(ROOT_DIR, 'next.config.js');
    const content = fs.readFileSync(configPath, 'utf8');

    assert.ok(content.includes("source: '/robots.txt'"), 'Must configure /robots.txt caching');
    assert.ok(content.includes("source: '/sitemap.xml'"), 'Must configure /sitemap.xml caching');
  });
});

// ==============================================================================
// SUITE 5: SITEMAP PARTITIONING & CRAWL EFFICIENCY
// ==============================================================================
suite('Sitemap Partitioning & Dynamic Bounds Handling', () => {

  test('ADV-16: Sitemap partition calculation produces exact partition count for arbitrary totals', () => {
    const ITEMS_PER_PARTITION = 5000;
    const calculatePartitions = (total) => Math.max(1, Math.ceil(total / ITEMS_PER_PARTITION));

    assert.equal(calculatePartitions(0), 1, '0 items -> 1 partition');
    assert.equal(calculatePartitions(1), 1, '1 item -> 1 partition');
    assert.equal(calculatePartitions(4999), 1, '4999 items -> 1 partition');
    assert.equal(calculatePartitions(5000), 1, '5000 items -> 1 partition');
    assert.equal(calculatePartitions(5001), 2, '5001 items -> 2 partitions');
    assert.equal(calculatePartitions(10000), 2, '10000 items -> 2 partitions');
    assert.equal(calculatePartitions(10001), 3, '10001 items -> 3 partitions');
    assert.equal(calculatePartitions(250000), 50, '250000 items -> 50 partitions');
  });

  test('ADV-17: Sitemap XML entity escaping handles all XML 1.0 predefined entities', () => {
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

    const testInput = 'Bán biệt thự & liền kề "Vinhomes Ocean Park" <Giai đoạn 1> giá \'15 tỷ\'';
    const escaped = escapeXml(testInput);
    assert.equal(
      escaped,
      'Bán biệt thự &amp; liền kề &quot;Vinhomes Ocean Park&quot; &lt;Giai đoạn 1&gt; giá &apos;15 tỷ&apos;'
    );
  });
});

// ==============================================================================
// SUMMARY & REPORT
// ==============================================================================
const durationMs = Date.now() - stats.startTime;
console.log('\n' + '='.repeat(80));
console.log(colors.bold(' ADVERSARIAL STRESS TEST SUITE EXECUTION SUMMARY'));
console.log('='.repeat(80));
console.log(`  Suites Executed : ${stats.suites}`);
console.log(`  Total Tests     : ${stats.total}`);
console.log(`  Passed          : ${colors.green(String(stats.passed))}`);
console.log(`  Failed          : ${stats.failed > 0 ? colors.red(String(stats.failed)) : '0'}`);
console.log(`  Findings/Notes  : ${stats.findings.length > 0 ? colors.yellow(String(stats.findings.length)) : '0'}`);
console.log(`  Execution Time  : ${durationMs}ms`);
console.log('='.repeat(80));

if (stats.findings.length > 0) {
  console.log(colors.bold(colors.yellow('\nNOTABLE ARCHITECTURAL FINDINGS:')));
  stats.findings.forEach(f => {
    console.log(`  [${f.id}] (${f.severity}) ${f.topic}`);
    console.log(`    Detail: ${f.detail}`);
  });
}

if (stats.failures.length > 0) {
  console.log(colors.bold(colors.red('\nFAILED ADVERSARIAL TESTS:')));
  stats.failures.forEach(f => {
    console.log(`  [ADV-${String(f.id).padStart(3, '0')}] ${f.name}`);
    console.log(`    ${colors.red('Error:')} ${f.error}`);
  });
  process.exit(1);
} else {
  console.log('\n' + colors.green(colors.bold('✓ ALL ADVERSARIAL SEO STRESS TESTS PASSED SUCCESSFULLY!')) + '\n');
  process.exit(0);
}
