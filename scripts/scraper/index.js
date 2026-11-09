const store = require('../lib/pgStore');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const generateShortId = store.generateShortId;
const {
  checkJobStatus, downloadAndProcessImage, spinContent, processProjectData, extractSpecs,
  extractMeeylandListingData, extractMeeyProjectData, parseTinbdsListingCard,
  delay, updateJobProgress, parsePrice, geocodeAddress, validateListingData, validateProjectData
} = require('./helpers');
const config = require('./config');

puppeteer.use(StealthPlugin());

// Read .env.local to get Nominatim URL (DATABASE_URL is loaded by ../lib/pgStore)
const envPath = path.resolve(__dirname, '../../.env.local');
let nominatimUrl = 'http://internal.example/nominatim';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const nominatimMatch = envContent.match(/NOMINATIM_URL=(.*)/);
  if (nominatimMatch) nominatimUrl = nominatimMatch[1].replace(/['"]/g, '').trim();
}
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL not set (.env.local / nhadat-rs/.env)"); process.exit(1); }

const target = process.argv[2];
const jobId = process.argv[3];
if (!target) { console.error("Missing target."); process.exit(1); }

async function run() {
  const db = store; // Postgres-backed store (kept as `db` for the scrape* helpers)
  console.log(`Starting scraper for ${target}. Job ID: ${jobId || 'local-test'}`);

  let browser;
  let itemsScraped = 0;
  let errors = 0;

  try {
    // Only launch browser for targets that need it
    const needsBrowser = ['alonhadat.com.vn', 'batdongsan.com.vn', 'chotot.com', 'tinbds.com'].some(t => target.includes(t));
    if (needsBrowser) {
      browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'] });
    }

    if (target === 'alonhadat.com.vn') {
      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });
      const r = await scrapeAlonhadat(page, db, jobId);
      itemsScraped = r.itemsScraped; errors = r.errors;
    } else if (target === 'tinbds.com') {
      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });
      const r = await scrapeTinbds(page, db, jobId);
      itemsScraped = r.itemsScraped; errors = r.errors;
    } else if (target.includes('tinbds.com/du-an')) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });
      const r = await scrapeTinbdsDuAn(page, db, jobId);
      itemsScraped = r.itemsScraped; errors = r.errors;
    } else if (target.includes('meeyland')) {
      const r = await scrapeMeeylandAPI(db, jobId);
      itemsScraped = r.itemsScraped; errors = r.errors;
    } else if (target.includes('meeyproject')) {
      const r = await scrapeMeeyProjectAPI(db, jobId);
      itemsScraped = r.itemsScraped; errors = r.errors;
    } else {
      console.error(`Target ${target} not supported.`);
    }

    await store.updateJob(jobId, { status: 'success', endedAt: new Date(), itemsScraped, errors });
  } catch (err) {
    console.error("Scraping error:", err);
    await store.updateJob(jobId, { status: 'failed', endedAt: new Date(), errors: errors + 1, errorMessage: err.message }).catch(() => {});
  } finally {
    if (browser) await browser.close();
    await store.close();
    console.log(`Scraping complete. Items: ${itemsScraped}, Errors: ${errors}`);
    process.exit(0);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MeeyLand Listings via API (FULL RICH DATA)
  // ═══════════════════════════════════════════════════════════════════════════
  async function scrapeMeeylandAPI(db, jobId) {
    let itemsScraped = 0, errors = 0;
    console.log("Fetching MeeyLand listings via API...");
    try {
      const headers = { 'x-tenant': config.MEEYLAND_TENANT, 'Content-Type': 'application/json' };

      // First request to get total pages
      const firstRes = await axios.post(`${config.MEEYLAND_API}/articles/search`,
        { category: config.MEEYLAND_CATEGORIES.MUA_BAN, limit: config.BATCH_SIZE, page: 1 },
        { headers, timeout: config.REQUEST_TIMEOUT }
      );
      const totalPages = Math.min(firstRes.data?.data?.totalPages || 1, config.MAX_PAGES_PER_RUN);
      const totalResults = firstRes.data?.data?.totalResults || 0;
      console.log(`MeeyLand: ${totalResults} total listings, ${totalPages} pages to crawl`);

      for (let page = 1; page <= totalPages; page++) {
        await checkJobStatus(db, jobId);
        console.log(`\n── Page ${page}/${totalPages} ──`);

        let results;
        if (page === 1) {
          results = firstRes.data?.data?.results || [];
        } else {
          await delay(config.DELAY_MS);
          const res = await axios.post(`${config.MEEYLAND_API}/articles/search`,
            { category: config.MEEYLAND_CATEGORIES.MUA_BAN, limit: config.BATCH_SIZE, page },
            { headers, timeout: config.REQUEST_TIMEOUT }
          );
          results = res.data?.data?.results || [];
        }

        for (const item of results) {
          try {
            await checkJobStatus(db, jobId);
            const code = item.code;
            if (!code) continue;

            // Check if already exists (handling both String and Number types in the database)
            const exists = await store.listingExistsBySourceCode(code);
            if (exists) { console.log(`  Skip existing: ${code}`); continue; }

            // Fetch full detail
            await delay(300);
            const detailRes = await axios.get(`${config.MEEYLAND_API}/articles/${code}`,
              { headers, timeout: config.REQUEST_TIMEOUT }
            ).catch(() => null);
            if (!detailRes?.data?.data) { console.log(`  No detail for ${code}`); errors++; continue; }

            const detail = detailRes.data.data;
            const doc = extractMeeylandListingData(detail);
            doc.shortId = generateShortId(6);

            const originalTitle = doc.title;
            const originalDescription = doc.description;

            // Check if already exists by original content to avoid duplicates and save API cost
            const existsContent = await store.listingExistsByContent(originalTitle, originalDescription);
            if (existsContent) {
              console.log(`  Skip existing by content: ${originalTitle.substring(0, 40)}`);
              continue;
            }

            // Preliminary check for mandatory fields before downloading images & spinning content
            if (!doc.title || !doc.coordinates || !Array.isArray(doc.coordinates) || doc.coordinates.length < 2) {
              console.log(`  Skip preliminary check (missing coordinates/title) for: ${code}`);
              continue;
            }
            const price = doc.totalPrice || doc.price || 0;
            if (price <= 0 || doc.area <= 0 || !doc.description || !doc.images || doc.images.length === 0) {
              console.log(`  Skip preliminary check (missing price/area/description/images) for: ${code}`);
              continue;
            }

            // Download & process images
            if (doc.images.length > 0) {
              const processed = await downloadAndProcessImage(db, doc.images.slice(0, config.MAX_IMAGES), doc.title);
              doc.images = Array.isArray(processed) ? processed.filter(Boolean) : (processed ? [processed] : []);
            }

            // Spin content
            const spun = await spinContent(db, doc.title, doc.description);
            doc.title = spun.title;
            doc.description = spun.description;
            doc.originalTitle = originalTitle;
            doc.originalDescription = originalDescription;

            // Full validation check
            if (!validateListingData(doc)) {
              continue;
            }

            await store.insertListing(doc);
            itemsScraped++;
            console.log(`  ✓ Inserted [${code}]: ${doc.title.substring(0, 60)}...`);
            await updateJobProgress(db, jobId, itemsScraped, errors);
            if (itemsScraped >= 150) {
              console.log("Đã đạt giới hạn 150 tin. Dừng scraper.");
              process.exit(0);
            }
          } catch (e) {
            errors++;
            console.error(`  ✗ Error:`, e.message);
          }
        }
      }
    } catch (e) {
      errors++;
      console.error("MeeyLand API error:", e.message);
    }
    return { itemsScraped, errors };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MeeyProject via API (FULL RICH DATA)
  // ═══════════════════════════════════════════════════════════════════════════
  async function scrapeMeeyProjectAPI(db, jobId) {
    let itemsScraped = 0, errors = 0;
    console.log("Fetching MeeyProject projects via API...");
    try {
      const headers = { 'x-tenant': config.MEEYLAND_TENANT };

      const firstRes = await axios.get(
        `${config.MEEYLAND_API}/projects/search?limit=${config.BATCH_SIZE}&page=1`,
        { headers, timeout: config.REQUEST_TIMEOUT }
      );
      const totalPages = Math.min(firstRes.data?.data?.totalPages || 1, config.MAX_PAGES_PER_RUN);
      const totalResults = firstRes.data?.data?.totalResults || 0;
      console.log(`MeeyProject: ${totalResults} total projects, ${totalPages} pages to crawl`);

      for (let page = 1; page <= totalPages; page++) {
        await checkJobStatus(db, jobId);
        console.log(`\n── Page ${page}/${totalPages} ──`);

        let results;
        if (page === 1) {
          results = firstRes.data?.data?.results || [];
        } else {
          await delay(config.DELAY_MS);
          const res = await axios.get(
            `${config.MEEYLAND_API}/projects/search?limit=${config.BATCH_SIZE}&page=${page}`,
            { headers, timeout: config.REQUEST_TIMEOUT }
          );
          results = res.data?.data?.results || [];
        }

        for (const item of results) {
          try {
            await checkJobStatus(db, jobId);
            const projectId = item._id;
            if (!projectId) continue;

            // Fetch full detail
            await delay(300);
            const detailRes = await axios.get(`${config.MEEYLAND_API}/projects/${projectId}`,
              { headers, timeout: config.REQUEST_TIMEOUT }
            ).catch(() => null);
            if (!detailRes?.data?.data) { console.log(`  No detail for ${item.tradeName}`); errors++; continue; }

            const doc = extractMeeyProjectData(detailRes.data.data);

            // Preliminary check for mandatory fields (coordinates, title, description, images)
            if (!doc.title || !doc.coordinates || !Array.isArray(doc.coordinates) || doc.coordinates.length < 2) {
              console.log(`  Skip preliminary check (missing coordinates/title) for project: ${item.tradeName}`);
              continue;
            }
            if (!doc.description || !doc.images || doc.images.length === 0) {
              console.log(`  Skip preliminary check (missing description/images) for project: ${item.tradeName}`);
              continue;
            }

            const originalTitle = doc.title;
            const originalDescription = doc.description;

            // Check if exists by content or metadata
            const exists = await store.findMeeyProject({ slug: item.slug, shortId: item.shortId, title: originalTitle, description: originalDescription });

            if (exists) {
              // Update existing with new rich fields
              const updateFields = {};
              for (const key of ['tradeName', 'investorName', 'investorDescription', 'investorLogo',
                'projectTypes', 'totalApartment', 'totalBuilding', 'totalFloor', 'totalArea',
                'buildingDensity', 'ownership', 'status', 'completionTime', 'startTime',
                'utilitiesDescription', 'locationDescription', 'constructionProgress', 'salePolicy',
                'juridical', 'banner', 'logo', 'slug', 'streetName', 'coordinates', 'adminunit']) {
                if (doc[key] !== undefined && doc[key] !== '' && doc[key] !== null) {
                  updateFields[key] = doc[key];
                }
              }
              if (Object.keys(updateFields).length > 0) {
                await store.updateProjectFields(exists.id, updateFields);
                itemsScraped++;
                console.log(`  ↻ Updated Project: ${item.tradeName} (+${Object.keys(updateFields).length} fields)`);
              } else {
                console.log(`  Skip (no new data): ${item.tradeName}`);
              }
            } else {
              // New project
              doc.shortId = generateShortId(6);
              doc.originalTitle = originalTitle;
              doc.originalDescription = originalDescription;
              doc.originalImages = [...doc.images];
              
              // Download images
              if (doc.images.length > 0) {
                const processed = await downloadAndProcessImage(db, doc.images.slice(0, config.MAX_IMAGES), doc.title);
                doc.images = Array.isArray(processed) ? processed : (processed ? [processed] : []);
              }
              // Download banner
              if (doc.banner) {
                const processed = await downloadAndProcessImage(db, [doc.banner], doc.title);
                doc.banner = Array.isArray(processed) ? processed[0] : processed;
              }
              // Download logo
              if (doc.logo) {
                const processed = await downloadAndProcessImage(db, [doc.logo], doc.title);
                doc.logo = Array.isArray(processed) ? processed[0] : processed;
              }
              if (doc.investorLogo) {
                const processed = await downloadAndProcessImage(db, [doc.investorLogo], doc.title);
                doc.investorLogo = Array.isArray(processed) ? processed[0] : processed;
              }

              // Process AI content to filter contact info
              const spun = await processProjectData(
                db,
                doc.title, 
                doc.description, 
                doc.investorDescription, 
                doc.utilitiesDescription, 
                doc.locationDescription, 
                doc.investorName
              );
              
              if (spun) {
                doc.title = spun.title || doc.title;
                doc.description = spun.description || doc.description;
                doc.investorDescription = spun.investorDescription || doc.investorDescription;
                doc.utilitiesDescription = spun.utilitiesDescription || doc.utilitiesDescription;
                doc.locationDescription = spun.locationDescription || doc.locationDescription;
              }

              // Full validation check
              if (!validateProjectData(doc)) {
                continue;
              }

              await store.insertProject(doc);
              itemsScraped++;
              console.log(`  ✓ Inserted Project: ${doc.tradeName || doc.title}`);
            }
            await updateJobProgress(db, jobId, itemsScraped, errors);
          } catch (e) {
            errors++;
            console.error(`  ✗ Error:`, e.message);
          }
        }
      }
    } catch (e) {
      errors++;
      console.error("MeeyProject API error:", e.message);
    }
    return { itemsScraped, errors };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TinBDS Listings (HTML scraping with deep crawl)
  // ═══════════════════════════════════════════════════════════════════════════
  async function scrapeTinbds(page, db, jobId) {
    let itemsScraped = 0, errors = 0;
    console.log("Navigating to tinbds.com...");
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/115.0.0.0 Safari/537.36');
      await page.goto('https://tinbds.com/nha-dat-ban', { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForSelector('a[href*="/ban-"]', { timeout: 10000 }).catch(() => {});

      const content = await page.content();
      const $ = cheerio.load(content);

      let hrefs = [];
      $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.match(/\/ban-nha-rieng|\/ban-can-ho|\/ban-dat|\/ban-nha-biet-thu|\/ban-nha-mat-pho/) && href.match(/\/[a-z0-9]{3,5}$/)) {
          const fullHref = href.startsWith('http') ? href : `https://tinbds.com${href}`;
          if (!hrefs.includes(fullHref)) hrefs.push(fullHref);
        }
      });
      console.log(`Found ${hrefs.length} listing URLs from tinbds.`);

      for (let i = 0; i < Math.min(hrefs.length, 30); i++) {
        await checkJobStatus(db, jobId);
        const href = hrefs[i];
        
        // Check if already exists before deep crawling to save resources
        const existsBefore = await store.listingExistsBySourceUrl(href);
        if (existsBefore) {
          console.log(`  Skip existing URL: ${href}`);
          continue;
        }

        console.log(`Deep crawling: ${href}`);

        try {
          await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await delay(config.TINBDS_DELAY_MS);
          const detailHtml = await page.content();
          const $d = cheerio.load(detailHtml);

          const title = $d('h1').text().trim();
          if (!title) continue;
          const description = $d('.place-info').first().text().trim() || $d('.post-content').text().trim() || $d('.description').text().trim() || '';

          // Extract images
          const imagesRaw = [];
          $d('img').each((_, el) => {
            let src = $d(el).attr('src') || $d(el).attr('data-src');
            if (src) {
              if (src.startsWith('/')) {
                src = 'https://tinbds.com' + src;
              }
              const isExcluded = ['avatar', 'logo', 'banner', 'google-map', 'adsbygoogle', 'icon', 'xskt.com.vn', 'zzz.vn'].some(term => src.toLowerCase().includes(term));
              if (src.includes('http') && !isExcluded && !imagesRaw.includes(src)) {
                imagesRaw.push(src);
              }
            }
          });

          // Extract contact info
          const contactName = $d('a[href*="/tk/"]').first().text().trim();
          const contactPhone = $d('a[href^="tel:"]').first().text().trim().replace(/[^\d]/g, '');
          const contactEmail = $d('a[href^="mailto:"]').first().text().trim();

          // Determine property type from URL
          let propertyType = 'nha_dat';
          for (const [slug, type] of Object.entries(config.TINBDS_SLUG_TO_TYPE)) {
            if (href.includes(slug)) { propertyType = type; break; }
          }

          const specs = extractSpecs((title + " " + description).replace(/\n/g, ' '));

          // Address resolution & coordinates extraction
          let address = "Đang cập nhật";
          $d('.left-detaildv1').each((_, el) => {
            const leftText = $d(el).find('.left').text().trim();
            if (leftText.toLowerCase().includes('địa chỉ') || leftText.toLowerCase().includes('address')) {
              const rightText = $d(el).find('.right').text().trim();
              if (rightText && rightText.length > 5) {
                address = rightText;
                return false;
              }
            }
          });
          if (address === "Đang cập nhật") {
            const addrElem = $d('.address, .location, .post-address, .breadcrumbs');
            if (addrElem.length > 0) {
              address = addrElem.first().text().trim();
            } else {
              $d('div, span, p, td').each((_, el) => {
                const text = $d(el).text().trim();
                if (text.startsWith('Địa chỉ:') || text.startsWith('Vị trí:')) {
                  address = text.replace(/^(Địa chỉ:|Vị trí:)/i, '').trim();
                  return false;
                }
              });
            }
          }
          if (address === "Đang cập nhật" || address.trim().length < 5) {
            const textContent = $d('.post-summary, .post-info, .meta').text();
            const match = textContent.match(/Địa chỉ:\s*([^\n|]+)/i) || textContent.match(/Khu vực:\s*([^\n|]+)/i);
            if (match) address = match[1].trim();
          }

          const coords = await geocodeAddress(address, nominatimUrl);
          if (!coords) {
            console.log(`  Skip (could not geocode address: "${address}"): ${title.substring(0, 40)}`);
            continue;
          }

          // Preliminary check
          if (specs.price <= 0 || specs.area <= 0 || !description || imagesRaw.length === 0) {
            console.log(`  Skip preliminary check (missing price/area/description/images) for: ${title.substring(0, 40)}`);
            continue;
          }

          // Check if already exists by content to save API cost
          const existsContent = await store.listingExistsByContent(title, description);
          if (existsContent) {
            console.log(`  Skip existing by content: ${title.substring(0, 40)}`);
            continue;
          }

          const processedImages = await downloadAndProcessImage(db, imagesRaw.slice(0, 15), title);
          const spun = await spinContent(db, title, description);

          const doc = {
            title: spun.title,
            shortId: generateShortId(6),
            description: spun.description,
            originalTitle: title,
            originalDescription: description,
            price: specs.price,
            totalPrice: specs.price,
            pricePerM2: specs.area > 0 ? Math.round(specs.price / specs.area) : 0,
            area: specs.area,
            bedrooms: specs.bedrooms,
            bathrooms: specs.bathrooms,
            address,
            coordinates: coords,
            images: Array.isArray(processedImages) ? processedImages.filter(Boolean) : (processedImages ? [processedImages] : []),
            contact: { fullName: contactName, phones: contactPhone ? [contactPhone] : [], email: contactEmail },
            sourceUrl: href,
            sourceType: 'tinbds.com',
            propertyType,
            createdAt: new Date(),
            isScraped: true,
            status: 2,
          };

          if (!validateListingData(doc)) {
            continue;
          }

          const exists = await store.listingExistsBySourceUrl(href);
          if (!exists) {
            await store.insertListing(doc);
            itemsScraped++;
            console.log(`  ✓ Inserted: ${doc.title.substring(0, 60)}`);
            if (itemsScraped >= 150) {
              console.log("Đã đạt giới hạn 150 tin. Dừng scraper.");
              process.exit(0);
            }
          } else {
            console.log(`  Skip existing: ${title.substring(0, 40)}`);
          }
          await updateJobProgress(db, jobId, itemsScraped, errors);
        } catch (e) {
          errors++;
          console.error(`  ✗ Error:`, e.message);
        }
      }
    } catch (e) {
      errors++;
      console.error("TinBDS error:", e.message);
    }
    return { itemsScraped, errors };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TinBDS Projects (HTML scraping)
  // ═══════════════════════════════════════════════════════════════════════════
  async function scrapeTinbdsDuAn(page, db, jobId) {
    let itemsScraped = 0, errors = 0;
    console.log("Navigating to tinbds.com/du-an...");
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/115.0.0.0 Safari/537.36');
      await page.goto('https://tinbds.com/du-an', { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForSelector('a[href*="/du-an/"]', { timeout: 10000 }).catch(() => {});

      const content = await page.content();
      const $ = cheerio.load(content);

      let hrefs = [];
      $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.includes('/du-an/') && href.split('/').length > 3) {
          const fullHref = href.startsWith('http') ? href : `https://tinbds.com${href}`;
          if (!hrefs.includes(fullHref) && !fullHref.includes('/p-')) hrefs.push(fullHref);
        }
      });
      console.log(`Found ${hrefs.length} projects from tinbds.`);

      for (let i = 0; i < Math.min(hrefs.length, 20); i++) {
        await checkJobStatus(db, jobId);
        const href = hrefs[i];
        
        // Check if already exists before deep crawling to save resources
        const existsBefore = await store.projectExistsBySourceUrl(href);
        if (existsBefore) {
          console.log(`  Skip existing project URL: ${href}`);
          continue;
        }

        console.log(`Deep crawling project: ${href}`);

        try {
          await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await delay(config.TINBDS_DELAY_MS);
          const detailHtml = await page.content();
          const $d = cheerio.load(detailHtml);

          const title = $d('h1').text().trim();
          if (!title) continue;
          const description = $d('.place-info, .post-content, .description, .content').first().text().trim().substring(0, 3000);

          const imagesRaw = [];
          $d('img').each((_, el) => {
            let src = $d(el).attr('src') || $d(el).attr('data-src');
            if (src) {
              if (src.startsWith('/')) {
                src = 'https://tinbds.com' + src;
              }
              const isExcluded = ['avatar', 'logo', 'banner', 'google-map', 'adsbygoogle', 'icon', 'xskt.com.vn', 'zzz.vn'].some(term => src.toLowerCase().includes(term));
              if (src.includes('http') && !isExcluded && !imagesRaw.includes(src)) {
                imagesRaw.push(src);
              }
            }
          });

          // Extract address
          let address = "Đang cập nhật";
          $d('.left-detaildv1').each((_, el) => {
            const leftText = $d(el).find('.left').text().trim();
            if (leftText.toLowerCase().includes('địa chỉ') || leftText.toLowerCase().includes('address')) {
              const rightText = $d(el).find('.right').text().trim();
              if (rightText && rightText.length > 5) {
                address = rightText;
                return false;
              }
            }
          });
          if (address === "Đang cập nhật") {
            const addrElem = $d('.address, .location, .post-address, .breadcrumbs');
            if (addrElem.length > 0) {
              address = addrElem.first().text().trim();
            } else {
              $d('div, span, p, td').each((_, el) => {
                const text = $d(el).text().trim();
                if (text.startsWith('Địa chỉ:') || text.startsWith('Vị trí:')) {
                  address = text.replace(/^(Địa chỉ:|Vị trí:)/i, '').trim();
                  return false;
                }
              });
            }
          }
          if (address === "Đang cập nhật" || address.trim().length < 5) {
            const textContent = $d('.post-summary, .post-info, .meta').text();
            const match = textContent.match(/Địa chỉ:\s*([^\n|]+)/i) || textContent.match(/Khu vực:\s*([^\n|]+)/i);
            if (match) address = match[1].trim();
          }

          const coords = await geocodeAddress(address, nominatimUrl);
          if (!coords) {
            console.log(`  Skip (could not geocode address: "${address}"): ${title.substring(0, 60)}`);
            continue;
          }

          // Preliminary check
          if (!description || imagesRaw.length === 0) {
            console.log(`  Skip preliminary check (missing description/images) for: ${title.substring(0, 60)}`);
            continue;
          }

          // Check if already exists by content to save API cost
          const existsContent = await store.projectExistsByContent(title, description);
          if (existsContent) {
            console.log(`  Skip existing project by content: ${title.substring(0, 60)}`);
            continue;
          }

          const processedImages = await downloadAndProcessImage(db, imagesRaw.slice(0, 15), title);
          const spun = await spinContent(db, title, description);

          const doc = {
            title: spun.title,
            description: spun.description,
            originalTitle: title,
            originalDescription: description,
            address,
            coordinates: coords,
            images: Array.isArray(processedImages) ? processedImages : (processedImages ? [processedImages] : []),
            sourceUrl: href,
            sourceType: 'tinbds.com/du-an',
            propertyType: 'du_an',
            createdAt: new Date(),
            isScraped: true,
            price: 0, totalPrice: 0, area: 0,
          };

          if (!validateProjectData(doc)) {
            continue;
          }

          const exists = await store.projectExistsBySourceUrl(href);
          if (!exists) {
            await store.insertProject(doc);
            itemsScraped++;
            console.log(`  ✓ Inserted Project: ${doc.title.substring(0, 60)}`);
          }
          await updateJobProgress(db, jobId, itemsScraped, errors);
        } catch (e) {
          errors++;
          console.error(`  ✗ Error:`, e.message);
        }
      }
    } catch (e) {
      errors++;
      console.error("TinBDS projects error:", e.message);
    }
    return { itemsScraped, errors };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Alonhadat (kept for backward compat)
  // ═══════════════════════════════════════════════════════════════════════════
  async function scrapeAlonhadat(page, db, jobId) {
    let itemsScraped = 0, errors = 0;
    console.log("Navigating to alonhadat.com.vn...");
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/115.0.0.0 Safari/537.36');
    await page.goto('https://alonhadat.com.vn/can-ban-nha-dat', { waitUntil: 'networkidle2', timeout: 60000 });
    const content = await page.content();
    const $ = cheerio.load(content);
    const listings = $('.property-item');
    console.log(`Found ${listings.length} listings.`);

    for (let i = 0; i < Math.min(listings.length, 10); i++) {
      try {
        const el = listings[i];
        const title = $(el).find('.property-title').text().trim();
        const url = 'https://alonhadat.com.vn' + $(el).find('a.link').attr('href');
        
        // Check if already exists before deep crawling to save resources
        const existsBefore = await store.listingExistsBySourceUrl(url);
        if (existsBefore) {
          console.log(`  Skip existing URL: ${url}`);
          continue;
        }

        const priceText = $(el).find('.price span[itemprop="price"]').text().trim();
        const areaText = $(el).find('.area span[itemprop="value"]').text().trim();
        const locationText = $(el).find('.new-address').text().trim().replace(/\s+/g, ' ');
        const image = 'https://alonhadat.com.vn' + $(el).find('.thumbnail img').attr('src');

        let price = parsePrice(priceText);
        let area = parseFloat(areaText) || 0;

        // Preliminary check
        if (price <= 0 || area <= 0 || !locationText || !image) {
          console.log(`  Skip preliminary check (missing price/area/location/image) for: ${title.substring(0, 40)}`);
          continue;
        }

        const coords = await geocodeAddress(locationText, nominatimUrl);
        if (!coords) {
          console.log(`  Skip (could not geocode address: "${locationText}"): ${title.substring(0, 40)}`);
          continue;
        }

        // Check if already exists by content to save API cost
        const existsContent = await store.listingExistsByContent(title, title);
        if (existsContent) {
          console.log(`  Skip existing by content: ${title.substring(0, 40)}`);
          continue;
        }

        const processedImage = await downloadAndProcessImage(db, [image], title);
        const spun = await spinContent(db, title, title);

        const doc = {
          shortId: generateShortId(6),
          title: spun.title, 
          description: spun.description, 
          originalTitle: title,
          originalDescription: title,
          price, 
          totalPrice: price, 
          area,
          address: locationText, 
          coordinates: coords,
          images: Array.isArray(processedImage) ? processedImage.filter(Boolean) : (processedImage ? [processedImage] : []),
          sourceUrl: url, 
          sourceType: 'alonhadat.com.vn', 
          createdAt: new Date(),
          propertyType: 'nha_dat', 
          isScraped: true, 
          status: 2
        };

        if (!validateListingData(doc)) {
          continue;
        }

        const exists = await store.listingExistsBySourceUrl(url);
        if (!exists) { 
          await store.insertListing(doc); 
          itemsScraped++; 
          console.log(`Inserted: ${doc.title}`); 
        }
        if (itemsScraped >= 150) {
          console.log("Đã đạt giới hạn 150 tin. Dừng scraper.");
          process.exit(0);
        }
      } catch (e) { errors++; console.error("Error:", e.message); }
    }
    return { itemsScraped, errors };
  }
}

run();
