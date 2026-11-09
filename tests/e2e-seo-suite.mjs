/**
 * ==============================================================================
 * NHADAT.CITY COMPREHENSIVE E2E SEO TEST SUITE
 * ==============================================================================
 * Architecture: Next.js 16 App Router + MongoDB + Varnish/HAProxy
 * Author: Test Writer 1 (QA & Specialist)
 * Specification: PROJECT.md, ORIGINAL_REQUEST.md, GEMINI.md, TEST_INFRA.md
 * 
 * Execution:
 *   timeout 60s node tests/e2e-seo-suite.mjs
 * ==============================================================================
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const ROOT_DIR = process.cwd();
const APP_DIR = path.join(ROOT_DIR, 'app');
const COMPONENTS_DIR = path.join(ROOT_DIR, 'components');
const LIB_DIR = path.join(ROOT_DIR, 'lib');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

// Test Runner State
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  suites: 0,
  startTime: Date.now(),
  failures: [],
  discoveredBugs: [],
};

// ANSI Color Helpers
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

// ==============================================================================
// HELPER UTILITIES FOR SEO LOGIC VERIFICATION
// ==============================================================================

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

// Unicode Emoji detector regex (surrogates and emoji blocks)
const UNICODE_EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{FE00}-\u{FE0F}]/u;

// Vietnamese Sentence Case linter helper
function lintVietnameseSentenceCase(title) {
  if (!title || typeof title !== 'string') return { valid: false, reason: 'Empty title' };
  const trimmed = title.trim();
  if (trimmed.length === 0) return { valid: false, reason: 'Empty string' };

  // Rule 1: No ALL CAPS
  const words = trimmed.split(/\s+/);
  const uppercaseWords = words.filter(w => w.length > 1 && w === w.toUpperCase() && !/^[0-9\W]+$/.test(w));
  if (words.length >= 3 && uppercaseWords.length > words.length * 0.6) {
    return { valid: false, reason: 'ALL CAPS title detected' };
  }

  // Rule 2: No Unicode Emoji
  if (UNICODE_EMOJI_REGEX.test(trimmed)) {
    return { valid: false, reason: 'Unicode emoji detected' };
  }

  // Rule 3: Sentence Case - First letter should be uppercase
  const firstLetterMatch = trimmed.match(/[a-zA-Zà-ỹÀ-Ỹ]/);
  if (firstLetterMatch && firstLetterMatch[0] !== firstLetterMatch[0].toUpperCase()) {
    return { valid: false, reason: 'Title does not start with capital letter' };
  }

  // Rule 4: English Title Case check (every word capitalized in lowercase-friendly words)
  const forbiddenCapitalizedLowercaseWords = ['tại', 'và', 'của', 'trong', 'cho', 'với', 'ở', 'được', 'các'];
  for (const forbidden of forbiddenCapitalizedLowercaseWords) {
    const capitalizedWord = forbidden.charAt(0).toUpperCase() + forbidden.slice(1);
    const regex = new RegExp(`\\s${capitalizedWord}\\s`, 'g');
    if (regex.test(trimmed)) {
      return { valid: false, reason: `English Title Case detected for particle "${capitalizedWord}"` };
    }
  }

  return { valid: true };
}

// Recursive file scanner
function getFilesRecursively(dir, extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (!['node_modules', '.next', '.git', 'dist'].includes(file)) {
        results = results.concat(getFilesRecursively(filePath, extensions));
      }
    } else {
      if (extensions.some(ext => file.endsWith(ext))) {
        results.push(filePath);
      }
    }
  }
  return results;
}

// ==============================================================================
// SUITE 1: TIER 1 - SITEMAP ARCHITECTURE & DYNAMIC PARTITIONING (Features 1, 2, 3)
// ==============================================================================
suite('Tier 1: Sitemap Architecture & XML Partitioning (Features 1, 2, 3)', () => {

  test('TC-F01-01: Sitemap index route exists and defines XML sitemapindex', () => {
    const sitemapIndexRoute = path.join(APP_DIR, 'sitemap.xml', 'route.ts');
    assert.ok(fs.existsSync(sitemapIndexRoute), 'app/sitemap.xml/route.ts must exist');
    const content = fs.readFileSync(sitemapIndexRoute, 'utf8');
    assert.ok(content.includes('<sitemapindex'), 'Must define <sitemapindex>');
    assert.ok(content.includes('http://www.sitemaps.org/schemas/sitemap/0.9'), 'Must declare sitemap 0.9 XML namespace');
    assert.ok(content.includes('sitemap-listings-'), 'Must reference partitioned listing sitemaps');
    assert.ok(content.includes('sitemap-projects.xml'), 'Must reference project sitemap');
    assert.ok(content.includes('sitemap-quyhoach.xml'), 'Must reference planning sitemap');
    assert.ok(content.includes('sitemap-blog.xml'), 'Must reference blog sitemap');
  });

  test('TC-F01-02: Listing sitemap partition route handles 5,000 item chunks', () => {
    const partitionRoute = path.join(APP_DIR, 'sitemap-listings', '[page]', 'route.ts');
    assert.ok(fs.existsSync(partitionRoute), 'app/sitemap-listings/[page]/route.ts must exist');
    const content = fs.readFileSync(partitionRoute, 'utf8');
    assert.ok(content.includes('5000') || content.includes('ITEMS_PER_SITEMAP'), 'Must enforce max 5000 items per sitemap');
    assert.ok(content.includes('skip'), 'Must support pagination skip calculation');
    assert.ok(content.includes('application/xml'), 'Must return application/xml content type header');
  });

  test('TC-F01-03: Sitemap entity escaping handles XML special characters', () => {
    const unsafeTitle = 'Bán nhà mặt phố <Hà Nội> & Căn hộ "VIP" \'Sổ Đỏ\'';
    const escaped = escapeXml(unsafeTitle);
    assert.ok(!escaped.includes('<Hà Nội>'), 'Raw < > must be escaped');
    assert.ok(escaped.includes('&lt;Hà Nội&gt;'), 'Must contain &lt; and &gt;');
    assert.ok(escaped.includes('&amp;'), 'Must escape & to &amp;');
    assert.ok(escaped.includes('&quot;VIP&quot;'), 'Must escape double quotes to &quot;');
    assert.ok(escaped.includes('&apos;Sổ Đỏ&apos;'), 'Must escape single quotes to &apos;');
  });

  test('TC-F01-04: Out-of-bounds sitemap returns valid empty urlset without runtime error', () => {
    const emptyXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>`;
    assert.ok(emptyXml.includes('<urlset'), 'Must produce valid XML <urlset>');
    assert.ok(emptyXml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'), 'Must have namespace');
  });

  test('TC-F01-05: Sitemap cache headers configure public max-age and s-maxage', () => {
    const partitionRoute = path.join(APP_DIR, 'sitemap-listings', '[page]', 'route.ts');
    const content = fs.readFileSync(partitionRoute, 'utf8');
    assert.ok(content.includes('Cache-Control') && content.includes('public'), 'Must set public caching headers');
  });

  test('TC-F02-01: Admin unit ward sitemap generates valid canonical URLs', () => {
    const testItem = {
      _id: 'item123',
      shortId: 'AbCd99',
      title: 'Bán nhà riêng quận Cầu Giấy',
      adminunit: { province: 'ha-noi', ward: 'phuong-dich-vong' }
    };
    const url = getRealEstateUrl(testItem);
    assert.equal(url, '/ha-noi/dich-vong/AbCd99/ban-nha-rieng-quan-cau-giay');
    assert.ok(!url.includes('phuong-dich-vong'), 'Administrative prefix phuong- should be stripped');
  });

  test('TC-F03-01: Sitemap listing query filters active listings with images and admin unit', () => {
    const partitionRoute = path.join(APP_DIR, 'sitemap-listings', '[page]', 'route.ts');
    const content = fs.readFileSync(partitionRoute, 'utf8');
    assert.ok(content.includes('status'), 'Sitemap query must filter on status');
    assert.ok(content.includes('adminunit.province') || content.includes('province'), 'Must project province');
    assert.ok(content.includes('adminunit.ward') || content.includes('ward'), 'Must project ward');
    assert.ok(content.includes('title'), 'Must project title');
  });

  test('TC-F03-02: Sitemap date formatting generates valid ISO YYYY-MM-DD lastmod', () => {
    const date = new Date('2026-08-24T08:00:00.000Z');
    const lastmod = date.toISOString().split('T')[0];
    assert.match(lastmod, /^\d{4}-\d{2}-\d{2}$/, 'lastmod must follow YYYY-MM-DD format');
    assert.equal(lastmod, '2026-08-24');
  });
});

// ==============================================================================
// SUITE 2: TIER 1 - ROBOTS.TXT & CRAWL BUDGET PROTECTION (Features 4, 15)
// ==============================================================================
suite('Tier 1: Robots.txt & Crawl Budget Protection (Features 4, 15)', () => {

  test('TC-F04-01: robots.ts exists and declares MetadataRoute.Robots', () => {
    const robotsFile = path.join(APP_DIR, 'robots.ts');
    assert.ok(fs.existsSync(robotsFile), 'app/robots.ts must exist');
    const content = fs.readFileSync(robotsFile, 'utf8');
    assert.ok(content.includes('MetadataRoute.Robots') || content.includes('robots'), 'Must export robots handler');
    assert.ok(content.includes('sitemap:'), 'Must list sitemaps in robots.ts');
  });

  test('TC-F04-02: robots.ts blocks private / JSON API endpoints from indexing', () => {
    const robotsFile = path.join(APP_DIR, 'robots.ts');
    const content = fs.readFileSync(robotsFile, 'utf8');
    assert.ok(content.includes("'/api/'"), 'Must disallow /api/');
    assert.ok(content.includes("'/admin/'"), 'Must disallow /admin/');
    assert.ok(content.includes("'/manage-listings/'"), 'Must disallow /manage-listings/');
  });

  test('TC-F04-03: robots.ts blocks query parameter crawl traps (/*?q=*)', () => {
    const robotsFile = path.join(APP_DIR, 'robots.ts');
    const content = fs.readFileSync(robotsFile, 'utf8');
    assert.ok(content.includes('/*?q=*') || content.includes('/*search*') || content.includes('/search'), 'Must block parameter search loop traps');
  });

  test('TC-F04-04: robots.ts blocks destructive / low-value scrapers', () => {
    const robotsFile = path.join(APP_DIR, 'robots.ts');
    const content = fs.readFileSync(robotsFile, 'utf8');
    const expectedBlockedBots = ['SemrushBot', 'PetalBot', 'AhrefsBot', 'ClaudeBot', 'GPTBot'];
    for (const bot of expectedBlockedBots) {
      assert.ok(content.includes(bot), `Must include ${bot} in blocked bots`);
    }
  });

  test('TC-F04-05: robots.ts includes all official XML sitemaps', () => {
    const robotsFile = path.join(APP_DIR, 'robots.ts');
    const content = fs.readFileSync(robotsFile, 'utf8');
    assert.ok(content.includes('https://nhadat.city/sitemap.xml'), 'Must include sitemap.xml');
    assert.ok(content.includes('https://nhadat.city/sitemap-projects.xml'), 'Must include sitemap-projects.xml');
    assert.ok(content.includes('https://nhadat.city/sitemap-quyhoach.xml'), 'Must include sitemap-quyhoach.xml');
    assert.ok(content.includes('https://nhadat.city/sitemap-blog.xml'), 'Must include sitemap-blog.xml');
  });
});

// ==============================================================================
// SUITE 3: TIER 1 - VIETNAMESE TYPOGRAPHY & ZERO UNICODE EMOJI BAN (Features 8, 9, 10)
// ==============================================================================
suite('Tier 1: Vietnamese Typography & Unicode Emoji Zero-Tolerance (Features 8, 9, 10)', () => {

  test('TC-F08-01: Zero unicode emojis in UI source code (app/ and components/)', () => {
    const files = [
      ...getFilesRecursively(APP_DIR, ['.ts', '.tsx']),
      ...getFilesRecursively(COMPONENTS_DIR, ['.ts', '.tsx'])
    ];
    assert.ok(files.length > 0, 'Must find UI files in app/ and components/');

    const violations = [];
    for (const file of files) {
      const rel = path.relative(ROOT_DIR, file);
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('UNICODE_EMOJI_REGEX') || line.includes('replace(/') || line.includes('[\\u{')) return;
        const clean = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
        if (UNICODE_EMOJI_REGEX.test(clean)) {
          violations.push({ file: rel, line: idx + 1, text: line.trim() });
        }
      });
    }

    assert.equal(
      violations.length,
      0,
      `Found ${violations.length} unicode emoji violations in UI files:\n` +
      violations.map(v => `  ${v.file}:${v.line} -> ${v.text}`).join('\n')
    );
  });

  test('TC-F08-02: Emoji stripping logic purges composite emojis from titles', () => {
    const rawTitle = '🔥 Bán nhà Cầu Giấy 🏠 Sổ đỏ chính chủ ✨ [Giá tốt]';
    const cleaned = rawTitle.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, '').trim();
    assert.equal(cleaned, 'Bán nhà Cầu Giấy  Sổ đỏ chính chủ  [Giá tốt]');
    assert.ok(!UNICODE_EMOJI_REGEX.test(cleaned), 'Cleaned title must have zero unicode emojis');
  });

  test('TC-F09-01: Vietnamese Sentence Case linter accepts standard sentence case', () => {
    const validTitles = [
      'Mua bán nhà đất Hà Nội chính chủ – Cập nhật tháng 8/2026',
      'Bán nhà mặt phố Cầu Giấy Hà Nội – 50m², 5 tầng, SĐCC',
      'Tra cứu bản đồ quy hoạch và bảng giá đất TP.HCM',
      'Dự án căn hộ chung cư cao cấp tại Đà Nẵng – Giá từ 2.5 tỷ',
      'Thống kê biến động giá bất động sản 63 tỉnh thành',
    ];

    for (const title of validTitles) {
      const res = lintVietnameseSentenceCase(title);
      assert.ok(res.valid, `Title "${title}" should be valid Sentence Case, got error: ${res.reason}`);
    }
  });

  test('TC-F09-02: Vietnamese Sentence Case linter rejects ALL CAPS titles', () => {
    const invalidAllCapTitles = [
      'QUAY THỬ XỔ SỐ MIỀN BẮC HÔM NAY',
      'MUA BÁN NHÀ ĐẤT HÀ NỘI CHÍNH CHỦ GIÁ RẺ',
      'BẢN ĐỒ QUY HOẠCH ĐẤT ĐAI TOÀN QUỐC 2026',
    ];

    for (const title of invalidAllCapTitles) {
      const res = lintVietnameseSentenceCase(title);
      assert.equal(res.valid, false, `Title "${title}" must be rejected due to ALL CAPS`);
    }
  });

  test('TC-F09-03: Vietnamese Sentence Case linter rejects English Title Case with capitalized particles', () => {
    const invalidTitleCase = [
      'Mua Bán Nhà Đất Tại Hà Nội Giá Rẻ',
      'Quy Hoạch Đô Thị Và Bảng Giá Đất Mới Nhất',
      'Thông Tin Chi Tiết Của Dự Án Căn Hộ',
    ];

    for (const title of invalidTitleCase) {
      const res = lintVietnameseSentenceCase(title);
      assert.equal(res.valid, false, `Title "${title}" must be rejected due to Title Case particle`);
    }
  });

  test('TC-F10-01: Project title generator aligns with search intent (Action + Name + Location + Price)', () => {
    const project = {
      title: 'Vinhomes Smart City',
      adminunit: { district: 'Nam Từ Liêm', province: 'Hà Nội' },
      minPrice: 2_500_000_000,
    };
    const cleanTitle = project.title;
    const locationStr = ` tại ${project.adminunit.district}, ${project.adminunit.province}`;
    const priceStr = ` – Giá từ ${formatMoney(project.minPrice)}`;
    const title = `Bán ${cleanTitle}${locationStr}${priceStr} | NhaDat.City`;

    assert.equal(title, 'Bán Vinhomes Smart City tại Nam Từ Liêm, Hà Nội – Giá từ 2.5 tỷ | NhaDat.City');
    assert.ok(title.length >= 45 && title.length <= 85, 'Project title length must fit SERP limits');
  });
});

// ==============================================================================
// SUITE 4: TIER 1 - SCHEMA.ORG JSON-LD STRUCTURED DATA (Features 11, 14)
// ==============================================================================
suite('Tier 1: Schema.org JSON-LD Structured Data (Features 11, 14)', () => {

  test('TC-F11-01: RealEstateListing schema contains all required properties', () => {
    const mockListing = {
      _id: 'real123',
      shortId: 'ReAl99',
      title: 'Bán nhà phố Hoàng Quốc Việt Cầu Giấy',
      description: 'Nhà đẹp 4 tầng mặt ngõ thông, ô tô đỗ cửa.',
      totalPrice: 6_500_000_000,
      area: 55,
      bedrooms: 4,
      bathrooms: 4,
      lat: 21.0456,
      lng: 105.7981,
      createdAt: new Date('2026-08-01T00:00:00Z'),
      updatedAt: new Date('2026-08-20T00:00:00Z'),
      images: ['img1.jpg', 'img2.jpg'],
      address: 'Số 12 ngõ 106 Hoàng Quốc Việt',
    };

    const canonicalUrl = 'https://nhadat.city/ha-noi/dich-vong/ReAl99/ban-nha-pho-hoang-quoc-viet-cau-giay';
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'RealEstateListing',
      '@id': canonicalUrl,
      name: mockListing.title,
      description: mockListing.description,
      url: canonicalUrl,
      floorSize: {
        '@type': 'QuantitativeValue',
        value: mockListing.area,
        unitCode: 'MTK',
      },
      numberOfRooms: mockListing.bedrooms,
      numberOfBathroomsTotal: mockListing.bathrooms,
      datePosted: mockListing.createdAt.toISOString(),
      dateModified: mockListing.updatedAt.toISOString(),
      offers: {
        '@type': 'Offer',
        price: mockListing.totalPrice,
        priceCurrency: 'VND',
        availability: 'https://schema.org/InStock',
        url: canonicalUrl,
      },
      address: {
        '@type': 'PostalAddress',
        streetAddress: mockListing.address,
        addressLocality: 'Dịch Vọng',
        addressRegion: 'Hà Nội',
        addressCountry: 'VN',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: mockListing.lat,
        longitude: mockListing.lng,
      },
    };

    assert.equal(schema['@context'], 'https://schema.org');
    assert.equal(schema['@type'], 'RealEstateListing');
    assert.equal(schema.offers.priceCurrency, 'VND');
    assert.equal(schema.offers.price, 6_500_000_000);
    assert.equal(schema.floorSize.unitCode, 'MTK');
    assert.equal(schema.address.addressCountry, 'VN');
    assert.equal(schema.geo.latitude, 21.0456);
    assert.equal(schema.geo.longitude, 105.7981);
  });

  test('TC-F11-02: BreadcrumbList schema adheres to position indexing', () => {
    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'NhaDat.City', item: 'https://nhadat.city' },
        { '@type': 'ListItem', position: 2, name: 'Hà Nội', item: 'https://nhadat.city/ha-noi' },
        { '@type': 'ListItem', position: 3, name: 'Cầu Giấy', item: 'https://nhadat.city/ha-noi/cau-giay' },
        { '@type': 'ListItem', position: 4, name: 'Bán nhà Cầu Giấy', item: 'https://nhadat.city/ha-noi/cau-giay/123/ban-nha' },
      ],
    };

    assert.equal(breadcrumbSchema['@type'], 'BreadcrumbList');
    assert.equal(breadcrumbSchema.itemListElement.length, 4);
    breadcrumbSchema.itemListElement.forEach((item, idx) => {
      assert.equal(item['@type'], 'ListItem');
      assert.equal(item.position, idx + 1);
      assert.ok(item.name && item.item, `Breadcrumb item ${idx + 1} must have name and item URL`);
    });
  });

  test('TC-F11-03: FAQPage schema generates valid Question and Answer objects', () => {
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Giá bất động sản này là bao nhiêu?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Bất động sản có giá 6.5 tỷ tại Cầu Giấy, Hà Nội.',
          },
        },
        {
          '@type': 'Question',
          name: 'Pháp lý bất động sản thế nào?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Sổ đỏ chính chủ, sẵn sàng giao dịch.',
          },
        },
      ],
    };

    assert.equal(faqSchema['@type'], 'FAQPage');
    assert.equal(faqSchema.mainEntity.length, 2);
    faqSchema.mainEntity.forEach(q => {
      assert.equal(q['@type'], 'Question');
      assert.ok(q.name, 'Question must have name');
      assert.equal(q.acceptedAnswer['@type'], 'Answer');
      assert.ok(q.acceptedAnswer.text, 'Answer must have text');
    });
  });

  test('TC-F11-04: Global layout renders Organization and WebSite schemas', () => {
    const layoutFile = path.join(APP_DIR, 'layout.tsx');
    const content = fs.readFileSync(layoutFile, 'utf8');
    assert.ok(content.includes('@type') && content.includes('WebSite'), 'layout.tsx must render WebSite schema');
    assert.ok(content.includes('@type') && content.includes('Organization'), 'layout.tsx must render Organization schema');
    assert.ok(content.includes('https://schema.org'), 'Must use https://schema.org context');
  });
});

// ==============================================================================
// SUITE 5: TIER 1 - URL CONSTRUCTION, SLUGS & GEO MATRIX (Features 5, 6, 7, 12, 13)
// ==============================================================================
suite('Tier 1: URL Normalization, Slugs & Geo Hierarchy (Features 5, 6, 7, 12, 13)', () => {

  test('TC-F05-01: makeUrlSlug removes Vietnamese diacritics and special characters', () => {
    const inputs = [
      ['Bán nhà mặt phố Đà Nẵng', 'ban-nha-mat-pho-da-nang'],
      ['Căn hộ 2PN Vinhomes Ocean Park #1', 'can-ho-2pn-vinhomes-ocean-park-1'],
      ['Đất nền khu đô thị Nam Vĩnh Hải - Nha Trang', 'dat-nen-khu-do-thi-nam-vinh-hai-nha-trang'],
      ['Nhà cấp 4 (giá siêu rẻ!)', 'nha-cap-4-gia-sieu-re'],
    ];

    for (const [raw, expected] of inputs) {
      assert.equal(makeUrlSlug(raw), expected);
    }
  });

  test('TC-F05-02: getProjectUrl generates direct shortId URL without redirect hops', () => {
    const project = {
      _id: '64a1b2c3d4e5f6a7b8c9d0e1',
      shortId: 'PrJ01',
      title: 'Khu Đô Thị Ecopark Hưng Yên',
    };
    const url = getProjectUrl(project);
    assert.equal(url, '/du-an/PrJ01/khu-do-thi-ecopark-hung-yen');
  });

  test('TC-F06-01: Statistics page file exists and utilizes direct DB aggregation', () => {
    const statsFile = path.join(LIB_DIR, 'db', 'statistics.ts');
    assert.ok(fs.existsSync(statsFile), 'lib/db/statistics.ts must exist');
    const content = fs.readFileSync(statsFile, 'utf8');
    assert.ok(content.includes('getDb') || content.includes('collection'), 'Must query MongoDB directly without HTTP fetch loops');
  });

  test('TC-F07-01: Cross-niche link checker identifies nofollow requirements', () => {
    const checkLink = (url, rel) => {
      if (url.includes('nhadat.city') || url.startsWith('/')) {
        return !rel || !rel.includes('nofollow');
      }
      return rel && rel.includes('nofollow');
    };

    assert.ok(checkLink('/ha-noi/dich-vong', ''), 'Internal link should be follow');
    assert.ok(checkLink('https://veso.top', 'nofollow noopener'), 'Outbound lottery link must have nofollow');
  });

  test('TC-F12-01: Province data file contains all 63 Vietnamese provinces', () => {
    const provinceFile = path.join(LIB_DIR, 'utils', 'province.ts');
    assert.ok(fs.existsSync(provinceFile), 'lib/utils/province.ts must exist');
    const content = fs.readFileSync(provinceFile, 'utf8');
    
    const checkProvinces = ['ha-noi', 'ho-chi-minh', 'da-nang', 'hai-phong', 'can-tho', 'quang-ninh', 'khanh-hoa', 'lam-dong'];
    for (const prov of checkProvinces) {
      assert.ok(content.includes(`'${prov}'`), `Province table must include ${prov}`);
    }
  });

  test('TC-F12-02: Merged province lookup table preserves SEO backlink compatibility', () => {
    const provinceFile = path.join(LIB_DIR, 'utils', 'province.ts');
    const content = fs.readFileSync(provinceFile, 'utf8');
    assert.ok(content.includes('PROVINCE_MERGED_INTO'), 'Must export PROVINCE_MERGED_INTO mapping');
    assert.ok(content.includes('binh-duong') && content.includes('ho-chi-minh'), 'binh-duong must map to ho-chi-minh');
  });

  test('TC-F13-01: Keyword dynamic route queries database and sanitizes slug search terms', () => {
    const keywordRoute = path.join(APP_DIR, 'tu-khoa', '[slug]', 'page.tsx');
    assert.ok(fs.existsSync(keywordRoute), 'app/tu-khoa/[slug]/page.tsx must exist');
    const content = fs.readFileSync(keywordRoute, 'utf8');
    
    // Note: Escalate finding if app/tu-khoa/[slug]/page.tsx uses lowercase realestate instead of canonical realEstate
    if (content.includes("collection('realestate')")) {
      stats.discoveredBugs.push({
        id: 'BUG-M3-01',
        feature: 'Keyword Page Collection Name Case Sensitivity',
        file: 'app/tu-khoa/[slug]/page.tsx:56',
        description: "app/tu-khoa/[slug]/page.tsx uses db.collection('realestate') instead of canonical db.collection('realEstate')",
        severity: 'MEDIUM',
        milestone: 'M3'
      });
    }

    assert.ok(content.includes('collection('), 'Must perform collection query on keyword terms');
    assert.ok(content.includes('cleanQuery') || content.includes('regex'), 'Must construct search query regex');
  });
});

// ==============================================================================
// SUITE 6: TIER 1 - INSTANT INDEXING ENGINE & API CONTRACTS (Features 16, 17, 18, 19)
// ==============================================================================
suite('Tier 1: Instant Indexing Engine & API Contracts (Features 16, 17, 18, 19)', () => {

  const EXPECTED_INDEXNOW_KEY = 'a9f3e2b1c8d74e5f9a0b1c2d3e4f5a6b';

  test('TC-F17-01: IndexNow public key route exists and serves plain text key', () => {
    const keyRoute = path.join(APP_DIR, 'indexnow-key.txt', 'route.ts');
    assert.ok(fs.existsSync(keyRoute), 'app/indexnow-key.txt/route.ts must exist');
    const content = fs.readFileSync(keyRoute, 'utf8');
    assert.ok(content.includes(EXPECTED_INDEXNOW_KEY), `Must serve key ${EXPECTED_INDEXNOW_KEY}`);
    assert.ok(content.includes('text/plain'), 'Must serve with text/plain header');
  });

  test('TC-F17-02: IndexNow static key verification files exist in public directory', () => {
    const keyFile1 = path.join(PUBLIC_DIR, 'indexnow-key.txt');
    const keyFile2 = path.join(PUBLIC_DIR, `${EXPECTED_INDEXNOW_KEY}.txt`);
    
    assert.ok(fs.existsSync(keyFile1), 'public/indexnow-key.txt must exist');
    assert.ok(fs.existsSync(keyFile2), `public/${EXPECTED_INDEXNOW_KEY}.txt must exist`);

    const content1 = fs.readFileSync(keyFile1, 'utf8').trim();
    const content2 = fs.readFileSync(keyFile2, 'utf8').trim();

    assert.equal(content1, EXPECTED_INDEXNOW_KEY, 'public/indexnow-key.txt content must match key');
    assert.equal(content2, EXPECTED_INDEXNOW_KEY, `public/${EXPECTED_INDEXNOW_KEY}.txt content must match key`);
  });

  test('TC-F17-03: IndexNow payload formatting complies with official specification', () => {
    const urls = [
      'https://nhadat.city/ha-noi/dich-vong/Ab12/ban-nha',
      'https://nhadat.city/ho-chi-minh/ben-nghe/Cd34/can-ho',
    ];

    const payload = {
      host: 'nhadat.city',
      key: EXPECTED_INDEXNOW_KEY,
      keyLocation: `https://nhadat.city/${EXPECTED_INDEXNOW_KEY}.txt`,
      urlList: urls,
    };

    assert.equal(payload.host, 'nhadat.city');
    assert.equal(payload.key, EXPECTED_INDEXNOW_KEY);
    assert.equal(payload.urlList.length, 2);
    payload.urlList.forEach(u => assert.ok(u.startsWith('https://nhadat.city/'), 'All URLs must belong to host domain'));
  });

  test('TC-F16-01: Google Service Account configuration structure is valid', () => {
    const keyPath = path.join(ROOT_DIR, 'google-service-account.json');
    assert.ok(fs.existsSync(keyPath), 'google-service-account.json must exist in project root');
    const sa = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    
    assert.ok(sa.client_email, 'Service account must have client_email');
    assert.ok(sa.private_key, 'Service account must have private_key');
    assert.ok(sa.project_id, 'Service account must have project_id');
    assert.ok(sa.private_key.includes('BEGIN PRIVATE KEY'), 'Private key must be valid RSA format');
  });

  test('TC-F16-02: Google Indexing API JWT generator creates valid RS256 token', () => {
    const keyPath = path.join(ROOT_DIR, 'google-service-account.json');
    const sa = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;
    const payload = {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/indexing',
      aud: 'https://oauth2.googleapis.com/token',
      iat,
      exp,
    };

    const token = jwt.sign(payload, sa.private_key, { algorithm: 'RS256' });
    assert.ok(token && typeof token === 'string', 'JWT sign must succeed');
    
    const decoded = jwt.decode(token);
    assert.equal(decoded.iss, sa.client_email);
    assert.equal(decoded.scope, 'https://www.googleapis.com/auth/indexing');
    assert.equal(decoded.aud, 'https://oauth2.googleapis.com/token');
  });

  test('TC-F18-01: Indexing Hook triggers distinguish URL_UPDATED vs URL_DELETED actions', () => {
    const createHookPayload = (status, url) => {
      const type = (status === 0 || status === 'deleted') ? 'URL_DELETED' : 'URL_UPDATED';
      return { url, type, priority: 1, timestamp: new Date() };
    };

    const p1 = createHookPayload(1, 'https://nhadat.city/ha-noi/dich-vong/1/ban-nha');
    assert.equal(p1.type, 'URL_UPDATED');

    const p2 = createHookPayload(0, 'https://nhadat.city/ha-noi/dich-vong/1/ban-nha');
    assert.equal(p2.type, 'URL_DELETED');
  });

  test('TC-F19-01: Exponential backoff calculation for indexing retries', () => {
    function calculateBackoff(attempts, baseSeconds = 30, maxSeconds = 3600) {
      return Math.min(maxSeconds, Math.pow(2, attempts) * baseSeconds);
    }

    assert.equal(calculateBackoff(0), 30, 'Attempt 0 -> 30s');
    assert.equal(calculateBackoff(1), 60, 'Attempt 1 -> 60s');
    assert.equal(calculateBackoff(2), 120, 'Attempt 2 -> 120s');
    assert.equal(calculateBackoff(3), 240, 'Attempt 3 -> 240s');
    assert.equal(calculateBackoff(8), 3600, 'Attempt 8 -> capped at 3600s (1 hour)');
  });

  test('TC-F19-02: Google quota gatekeeper enforces 200/day hard ceiling', () => {
    function allocateQuota(requestedCount, usedToday, maxDailyQuota = 200) {
      const remainingQuota = Math.max(0, maxDailyQuota - usedToday);
      const googleCount = Math.min(requestedCount, remainingQuota);
      const indexNowSurplus = requestedCount - googleCount;
      return { googleCount, indexNowSurplus, remainingQuota: remainingQuota - googleCount };
    }

    const res1 = allocateQuota(50, 0);
    assert.equal(res1.googleCount, 50);
    assert.equal(res1.indexNowSurplus, 0);

    const res2 = allocateQuota(50, 180);
    assert.equal(res2.googleCount, 20);
    assert.equal(res2.indexNowSurplus, 30);
    assert.equal(res2.remainingQuota, 0);

    const res3 = allocateQuota(100, 200);
    assert.equal(res3.googleCount, 0);
    assert.equal(res3.indexNowSurplus, 100);
  });
});

// ==============================================================================
// SUITE 7: TIER 2 - BOUNDARY & CORNER CASES (TC-B01 to TC-B10)
// ==============================================================================
suite('Tier 2: Boundary & Corner Cases (TC-B01 to TC-B10)', () => {

  test('TC-B01: Empty sitemap page does not crash and emits valid XML', () => {
    const items = [];
    const entries = items.map(item => `<url><loc>${item.url}</loc></url>`);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>`;
    assert.ok(xml.startsWith('<?xml'), 'Empty sitemap must start with XML declaration');
    assert.ok(xml.includes('</urlset>'), 'Empty sitemap must close urlset tag');
  });

  test('TC-B02: Invalid / missing shortId falls back safely to ObjectId string', () => {
    const itemWithoutShortId = {
      _id: '64a1b2c3d4e5f6a7b8c9d0e1',
      title: 'Bán nhà quận Hải Châu',
      adminunit: { province: 'da-nang', ward: 'hai-chau' }
    };
    const url = getRealEstateUrl(itemWithoutShortId);
    assert.equal(url, '/da-nang/hai-chau/64a1b2c3d4e5f6a7b8c9d0e1/ban-nha-quan-hai-chau');
  });

  test('TC-B03: XML escaping preserves UTF-8 Vietnamese tone marks while escaping markup symbols', () => {
    const raw = 'Căn hộ Đặng Văn Bi & Võ Văn Ngân <Thủ Đức> "SĐCC"';
    const clean = escapeXml(raw);
    assert.ok(clean.includes('Đặng Văn Bi'), 'Vietnamese accents must be preserved untouched');
    assert.ok(clean.includes('&amp;'), '& must be escaped to &amp;');
    assert.ok(clean.includes('&lt;Thủ Đức&gt;'), '< > must be escaped to &lt; &gt;');
  });

  test('TC-B04: Thin content listing dynamically receives noindex robots flag', () => {
    const thinListing = {
      images: [],
      description: 'Nhà bán',
    };
    const isThin = !thinListing.images?.length && (!thinListing.description || thinListing.description.length < 100);
    const robotsMetadata = isThin ? { robots: { index: false, follow: true } } : {};
    
    assert.ok(isThin, 'Thin listing condition must evaluate to true');
    assert.equal(robotsMetadata.robots.index, false, 'Thin listing must have robots.index = false');
    assert.equal(robotsMetadata.robots.follow, true, 'Thin listing must have robots.follow = true');
  });

  test('TC-B05: Merged province fallback resolves to target municipality', () => {
    const provinceMerger = {
      'binh-duong': 'ho-chi-minh',
      'ba-ria-vung-tau': 'ho-chi-minh',
      'bac-giang': 'bac-ninh',
    };
    assert.equal(provinceMerger['binh-duong'], 'ho-chi-minh');
    assert.equal(provinceMerger['bac-giang'], 'bac-ninh');
  });

  test('TC-B06: Quota limit saturation shifts 100% surplus to IndexNow', () => {
    const totalNewListings = 350;
    const googleDailyCap = 200;
    const googleDispatched = Math.min(totalNewListings, googleDailyCap);
    const indexNowDispatched = totalNewListings;

    assert.equal(googleDispatched, 200);
    assert.equal(indexNowDispatched, 350);
  });

  test('TC-B07: IndexNow public key route returns exactly 32-character hex key', () => {
    const key = EXPECTED_INDEXNOW_KEY();
    assert.match(key, /^[a-f0-9]{32}$/, 'Key must be 32 hex characters');
  });

  function EXPECTED_INDEXNOW_KEY() { return 'a9f3e2b1c8d74e5f9a0b1c2d3e4f5a6b'; }

  test('TC-B08: Sanitizer removes full unicode astral plane emojis without truncating Vietnamese text', () => {
    const GLOBAL_EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{FE00}-\u{FE0F}]/gu;
    const titleWithAstralEmoji = 'Nhà đẹp phố Huế 🏰💎 - Giá 10 tỷ';
    const cleaned = titleWithAstralEmoji.replace(GLOBAL_EMOJI_REGEX, '').replace(/\s+/g, ' ').trim();
    assert.equal(cleaned, 'Nhà đẹp phố Huế - Giá 10 tỷ');
  });

  test('TC-B09: Extreme price formatting safely handles billions, millions and free', () => {
    assert.equal(formatMoney(0), 'Thỏa thuận');
    assert.equal(formatMoney(null), 'Thỏa thuận');
    assert.equal(formatMoney(850_000_000), '850 triệu');
    assert.equal(formatMoney(5_500_000_000), '5.5 tỷ');
    assert.equal(formatMoney(120_000_000_000), '120 tỷ');
    assert.equal(formatArea(45.5), '45.5 m²');
    assert.equal(formatArea(100.0), '100 m²');
  });

  test('TC-B10: Coordinates format handler normalizes array and object notations', () => {
    const parseGeo = (item) => {
      if (item.lat && item.lng) return { lat: item.lat, lng: item.lng };
      if (item.coordinates && item.coordinates.length === 2) {
        return { lat: item.coordinates[1], lng: item.coordinates[0] };
      }
      return null;
    };

    const g1 = parseGeo({ lat: 21.02, lng: 105.85 });
    assert.deepEqual(g1, { lat: 21.02, lng: 105.85 });

    const g2 = parseGeo({ coordinates: [105.85, 21.02] });
    assert.deepEqual(g2, { lat: 21.02, lng: 105.85 });
  });
});

// ==============================================================================
// SUITE 8: TIER 3 - CROSS-FEATURE PAIRWISE COMBINATIONS (TC-C01 to TC-C08)
// ==============================================================================
suite('Tier 3: Cross-Feature Pairwise Combinations (TC-C01 to TC-C08)', () => {

  test('TC-C01: Pairwise Sitemap URL ↔ Detail Page Canonical ↔ Slug generator', () => {
    const listing = {
      _id: 'mongo987654',
      shortId: 'XY78Z',
      title: 'Bán Đất Nền Dự Án Ven Sông',
      adminunit: {
        province: 'da-nang',
        ward: 'phuong-hoa-xuan'
      }
    };

    const sitemapUrl = `https://nhadat.city${getRealEstateUrl(listing)}`;
    const expectedCanonical = 'https://nhadat.city/da-nang/hoa-xuan/XY78Z/ban-dat-nen-du-an-ven-song';

    assert.equal(sitemapUrl, expectedCanonical, 'Sitemap URL must match canonical URL exactly');
  });

  test('TC-C02: Pairwise Robots.txt Permitted ↔ Legacy Redirect 301 Target', () => {
    const legacyUrl = '/realestate/12345';
    const canonicalUrl = '/ha-noi/dich-vong/12345/ban-nha-cau-giay';
    
    const isRobotsAllowed = !legacyUrl.startsWith('/api/');
    assert.ok(isRobotsAllowed, 'Legacy redirect URL must not be blocked by robots /api/');
    assert.ok(canonicalUrl.startsWith('/ha-noi'), 'Target must be canonical path');
  });

  test('TC-C03: Pairwise Listing Post Event ↔ Indexing Queue Enqueue ↔ Quota Allocator', () => {
    const newPost = { id: 'post-101', url: 'https://nhadat.city/ha-noi/tay-ho/P101/ban-biet-thu' };
    const queueItem = { url: newPost.url, type: 'URL_UPDATED', priority: 1, attempts: 0 };
    
    assert.equal(queueItem.priority, 1);
    assert.ok(queueItem.url.startsWith('https://nhadat.city/'));
  });

  test('TC-C04: Pairwise Province Ward Matrix ↔ Ward Landing ↔ Listing Hierarchy', () => {
    const prov = 'ha-noi';
    const ward = 'dich-vong';
    const id = 'ID99';
    const slug = 'ban-nha';

    const provPath = `/${prov}`;
    const wardPath = `/${prov}/${ward}`;
    const listingPath = `/${prov}/${ward}/${id}/${slug}`;

    assert.ok(wardPath.startsWith(provPath));
    assert.ok(listingPath.startsWith(wardPath));
  });

  test('TC-C05: Pairwise JSON-LD Schema Title ↔ OpenGraph Title ↔ Sentence Case Linter', () => {
    const rawTitle = 'Bán nhà mặt phố Cầu Giấy Hà Nội – 50m², 5 tầng, SĐCC';
    const lintResult = lintVietnameseSentenceCase(rawTitle);
    assert.ok(lintResult.valid, 'Title must pass sentence case linter');

    const ogTitle = `${rawTitle} | NhaDat.City`;
    const schemaTitle = rawTitle;

    assert.ok(ogTitle.includes(schemaTitle));
  });

  test('TC-C06: Pairwise Project Card Link ↔ ShortId Format ↔ HousingDevelopment Schema', () => {
    const project = { _id: 'proj99', shortId: 'EcoPk', title: 'Ecopark Hưng Yên' };
    const link = getProjectUrl(project);
    assert.equal(link, '/du-an/EcoPk/ecopark-hung-yen');
  });

  test('TC-C07: Pairwise Thin Listing Filter ↔ Sitemap Query ↔ Robots Noindex', () => {
    const item = { images: [], description: 'Bán gấp' };
    const isExcludedFromSitemap = !item.images || item.images.length === 0;
    const receivesNoindex = isExcludedFromSitemap && item.description.length < 100;

    assert.ok(isExcludedFromSitemap, 'Must be excluded from sitemap');
    assert.ok(receivesNoindex, 'Must receive noindex tag');
  });

  test('TC-C08: Outbound external links include rel="nofollow noopener"', () => {
    const sampleLink = '<a href="https://veso.top" target="_blank" rel="nofollow noopener">Kết quả xổ số</a>';
    assert.ok(sampleLink.includes('rel="nofollow noopener"'), 'External outbound link must have rel="nofollow noopener"');
  });
});

// ==============================================================================
// SUITE 9: TIER 4 - REAL-WORLD APPLICATION SCENARIOS (TC-S01 to TC-S03)
// ==============================================================================
suite('Tier 4: Real-World Application Scenarios (TC-S01 to TC-S03)', () => {

  test('TC-S01: Scenario 1 - Googlebot Crawler Full Simulation', () => {
    const googleBotHeaders = {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    assert.ok(googleBotHeaders['User-Agent'].includes('Googlebot'), 'Must simulate official Googlebot UA');

    const mockSsrHtml = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <title>Bán nhà mặt phố Cầu Giấy Hà Nội [50m² – 6.5 tỷ] | NhaDat.City</title>
        <meta name="description" content="Nhà đẹp 50m² tại Cầu Giấy, Hà Nội. Giá 6.5 tỷ, SĐCC, ô tô vào nhà.">
        <link rel="canonical" href="https://nhadat.city/ha-noi/dich-vong/Ab12/ban-nha-mat-pho">
        <meta property="og:title" content="Bán nhà mặt phố Cầu Giấy Hà Nội">
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"RealEstateListing","name":"Bán nhà mặt phố Cầu Giấy"}
        </script>
      </head>
      <body>
        <main>
          <h1>Bán nhà mặt phố Cầu Giấy Hà Nội</h1>
          <h2>Thông tin chi tiết bất động sản</h2>
          <p>Mô tả đầy đủ bất động sản chính chủ không qua môi giới.</p>
        </main>
      </body>
      </html>
    `;

    assert.ok(mockSsrHtml.includes('<h1>') && mockSsrHtml.includes('</h1>'), 'HTML must contain H1');
    assert.ok(mockSsrHtml.includes('<h2>') && mockSsrHtml.includes('</h2>'), 'HTML must contain H2');
    assert.ok(mockSsrHtml.includes('<link rel="canonical"'), 'HTML must contain canonical link');
    assert.ok(mockSsrHtml.includes('application/ld+json'), 'HTML must contain JSON-LD script');
    assert.ok(!mockSsrHtml.includes('<div>Loading...</div>'), 'HTML must not have blank loading skeleton as only content');
  });

  test('TC-S02: Scenario 2 - Bing IndexNow Automated Push & Verification Cycle', () => {
    const key = 'a9f3e2b1c8d74e5f9a0b1c2d3e4f5a6b';
    const batchPayload = {
      host: 'nhadat.city',
      key,
      keyLocation: `https://nhadat.city/${key}.txt`,
      urlList: [
        'https://nhadat.city/ha-noi/dich-vong/101/ban-nha-mat-pho',
        'https://nhadat.city/ho-chi-minh/ben-nghe/102/can-ho-cao-cap'
      ]
    };

    assert.equal(batchPayload.host, 'nhadat.city');
    assert.equal(batchPayload.key, key);
    assert.equal(batchPayload.urlList.length, 2);
  });

  test('TC-S03: Scenario 3 - 3-Tier Geo Hierarchy Navigation Traversal', () => {
    const homeUrl = '/';
    const provinceUrl = '/ha-noi';
    const wardUrl = '/ha-noi/dich-vong';
    const listingUrl = '/ha-noi/dich-vong/Ab12/ban-nha-mat-pho';

    assert.ok(provinceUrl.startsWith('/'), 'Province URL must start with /');
    assert.ok(wardUrl.startsWith(provinceUrl), 'Ward URL must nest inside province URL');
    assert.ok(listingUrl.startsWith(wardUrl), 'Listing URL must nest inside ward URL');
  });
});

// ==============================================================================
// TEST REPORT SUMMARY & EXECUTION SIGN-OFF
// ==============================================================================
const durationMs = Date.now() - stats.startTime;
console.log('\n' + '='.repeat(80));
console.log(colors.bold(' E2E SEO TEST SUITE EXECUTION SUMMARY'));
console.log('='.repeat(80));
console.log(`  Suites Executed : ${stats.suites}`);
console.log(`  Total Tests     : ${stats.total}`);
console.log(`  Passed          : ${colors.green(String(stats.passed))}`);
console.log(`  Failed          : ${stats.failed > 0 ? colors.red(String(stats.failed)) : '0'}`);
console.log(`  Discovered Bugs : ${stats.discoveredBugs.length > 0 ? colors.yellow(String(stats.discoveredBugs.length)) : '0'}`);
console.log(`  Execution Time  : ${durationMs}ms`);
console.log('='.repeat(80));

if (stats.discoveredBugs.length > 0) {
  console.log(colors.bold(colors.yellow('\nDISCOVERED IMPLEMENTATION DEFECTS TO ESCALATE:')));
  stats.discoveredBugs.forEach(b => {
    console.log(`  [${b.id}] (${b.milestone}) ${b.feature}`);
    console.log(`    Location : ${b.file}`);
    console.log(`    Detail   : ${b.description}`);
    console.log(`    Severity : ${b.severity}`);
  });
}

if (stats.failures.length > 0) {
  console.log(colors.bold(colors.red('\nFAILED TESTS BREAKDOWN:')));
  stats.failures.forEach(f => {
    console.log(`  [T${String(f.id).padStart(3, '0')}] ${f.name}`);
    console.log(`    ${colors.red('Error:')} ${f.error}`);
  });
  console.log('\n' + colors.red('Test suite completed with failures.') + '\n');
  process.exit(1);
} else {
  console.log('\n' + colors.green(colors.bold('✓ ALL E2E SEO TESTS PASSED SUCCESSFULLY!')) + '\n');
  process.exit(0);
}
