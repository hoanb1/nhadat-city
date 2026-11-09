const store = require('../lib/pgStore');
const sharp = require('sharp');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('./config');
const { decode } = require('html-entities');
const { generateContentWithRetry } = require('./aiHub');

// Read Gemini API Key
const envPath = path.join(__dirname, '../../.env.local');
let GEMINI_API_KEY = '';
if (fs.existsSync(envPath)) {
  const match = fs.readFileSync(envPath, 'utf8').match(/GEMINI_API_KEY=["']?([^"'\n]+)["']?/);
  if (match) GEMINI_API_KEY = match[1];
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ── Job control ──────────────────────────────────────────────────────────────

async function checkJobStatus(db, jobId) {
  if (!jobId || jobId === 'local-test') return true;
  while (true) {
    const status = await store.getJobStatus(jobId);
    if (status === null) return false; // Job deleted? Stop.
    if (status === 'stopped') {
      console.log('Job stopped by admin. Exiting...');
      process.exit(0);
    }
    if (status === 'paused') {
      console.log('Job paused. Waiting 5 seconds...');
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }
    return true; // running
  }
}

// ── Image processing ─────────────────────────────────────────────────────────

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

function randomId(len = 17) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let res = '';
  for (let i = 0; i < len; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

async function downloadAndProcessImage(db, urlOrUrls, title) {
  const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
  const results = [];
  
  for (const url of urls) {
    if (!url || !url.startsWith('http')) continue;
    
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('default') || 
        lowerUrl.includes('no-image') || 
        lowerUrl.includes('no_image') || 
        lowerUrl.includes('placeholder') || 
        lowerUrl.includes('logo') || 
        lowerUrl.includes('blank')) {
      console.log('  Skip placeholder image:', url);
      continue;
    }

    try {
      const res = await axios.get(url, { 
        responseType: 'arraybuffer',
        timeout: config.REQUEST_TIMEOUT,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/115.0.0.0' }
      });
      const buffer = Buffer.from(res.data, 'binary');
      
      const dateStr = new Date().toISOString().slice(0, 10);
      const UPLOAD_BASE = '/DATA/nhadat/uploads/realEstate/public_webp';
      const webpDir = path.join(UPLOAD_BASE, dateStr);
      if (!fs.existsSync(webpDir)) {
        fs.mkdirSync(webpDir, { recursive: true });
      }

      const id = randomId();
      const filename = `${id}.webp`;
      const filepath = path.join(webpDir, filename);

      const svgText = `
      <svg width="400" height="100">
        <style>
          .title { fill: rgba(255, 255, 255, 0.4); font-size: 30px; font-weight: bold; font-family: sans-serif; }
        </style>
        <text x="20" y="50" class="title">NhaDat.City</text>
      </svg>`;
      const watermarkBuffer = Buffer.from(svgText);

      const metadata = await sharp(buffer).metadata();
      const s = sharp(buffer).resize(1200, null, { withoutEnlargement: true });
      if (metadata.width && metadata.width >= 400 && metadata.height && metadata.height >= 100) {
        s.composite([{ input: watermarkBuffer, gravity: 'southeast' }]);
      }
      await s.webp({ quality: 80 }).toFile(filepath);

      if (db) {
        await store.insertImage({ id, filepath, createdAt: new Date() });
        results.push(id);
      } else {
        results.push(`/uploads/realEstate/public_webp/${dateStr}/${filename}`);
      }
    } catch (e) {
      console.error("Error processing image:", url, e.message);
    }
  }
  return Array.isArray(urlOrUrls) ? results : (results[0] || '');
}

// ── Content spinning ─────────────────────────────────────────────────────────

async function spinContent(db, title, description) {
  const prompt = `Bạn là một chuyên gia viết Content chuẩn SEO mảng Bất động sản.
Hãy viết lại Tiêu đề và Mô tả sau để chống lỗi Duplicate Content của Google.
Yêu cầu:
- Viết lại câu từ tự nhiên, thu hút người đọc.
- BẮT BUỘC GIỮ NGUYÊN các thông số cốt lõi: Giá bán, Diện tích, Vị trí, Địa chỉ, Số điện thoại (nếu có).
- Đầu ra trả về định dạng JSON thuần (chỉ chứa JSON, không markdown):
{
  "title": "Tiêu đề mới...",
  "description": "Mô tả mới dài gọn..."
}

Original Title: ${title}
Original Description: ${description}`;

  const fallbackObj = { title, description };
  return await generateContentWithRetry(db, prompt, fallbackObj, 5);
}

// ── Lọc Liên hệ Dự án bằng AI ───────────────────────────────────────────────

async function processProjectData(db, title, description, investorDesc, utilitiesDesc, locationDesc, investorName) {
  const prompt = `Bạn là một AI thông minh làm nhiệm vụ lọc thông tin Bất động sản.
Nhiệm vụ: Hãy làm sạch nội dung dự án. BẮT BUỘC tuân thủ luật sau:
1. NẾU trong nội dung CÓ số điện thoại, email, website: CHỈ ĐƯỢC GIỮ LẠI nếu nó đích thị là của Chủ đầu tư "${investorName || 'của dự án'}".
2. TUYỆT ĐỐI XÓA BỎ HOÀN TOÀN mọi số điện thoại, email, website nếu nó thuộc về sàn giao dịch, môi giới, hoặc bên thứ 3.
3. Chỉnh sửa câu văn trôi chảy, chuyên nghiệp, giữ nguyên các thông số kỹ thuật (giá, diện tích, quy mô...).
4. Đầu ra trả về định dạng JSON thuần (không markdown) với cấu trúc:
{
  "title": "Tiêu đề mới...",
  "description": "Mô tả dự án sạch...",
  "investorDescription": "Mô tả CĐT sạch...",
  "utilitiesDescription": "Mô tả tiện ích sạch...",
  "locationDescription": "Mô tả vị trí sạch..."
}

Original Data:
Title: ${title}
Description: ${description}
Investor Description: ${investorDesc}
Utilities: ${utilitiesDesc}
Location: ${locationDesc}`;

  const fallbackObj = {
    title,
    description,
    investorDescription: investorDesc,
    utilitiesDescription: utilitiesDesc,
    locationDescription: locationDesc
  };

  return await generateContentWithRetry(db, prompt, fallbackObj, 5, 'Xử lý tin dự án');
}

// ── Spec extraction from text ────────────────────────────────────────────────

function extractSpecs(text) {
  let area = 0;
  let price = 0;
  let bedrooms = null;
  let bathrooms = null;

  // Area: "100m2", "100 m²", "100.5 m2"
  const areaMatch = text.match(/([0-9.,]+)\s*(m2|m²)/i);
  if (areaMatch) {
    area = parseFloat(areaMatch[1].replace(/,/g, '.'));
  }

  const priceMatch = text.match(/([0-9.,]+)\s*(tỷ|ty|triệu|trieu|tr)(?![a-zA-Z0-9])/i);
  if (priceMatch) {
    const val = parseFloat(priceMatch[1].replace(/,/g, '.'));
    const unit = priceMatch[2].toLowerCase();
    if (unit.startsWith('t')) {
      if (unit === 'tỷ' || unit === 'ty') {
        price = val * 1000000000;
      } else {
        price = val * 1000000;
      }
    }
  }

  // Bedrooms: "7 phòng ngủ", "7 pn"
  const bedMatch = text.match(/(\d+)\s*(phòng ngủ|pn|phong ngu)/i);
  if (bedMatch) bedrooms = parseInt(bedMatch[1]);

  // Bathrooms: "5 phòng tắm", "5 wc"
  const bathMatch = text.match(/(\d+)\s*(phòng tắm|wc|phong tam|nhà vệ sinh)/i);
  if (bathMatch) bathrooms = parseInt(bathMatch[1]);

  return { area, price, bedrooms, bathrooms };
}

// ── Price parser ─────────────────────────────────────────────────────────────

function parsePrice(str) {
  if (!str) return 0;
  const lower = str.toLowerCase();
  const numMatch = lower.match(/[\d.,]+/);
  if (!numMatch) return 0;
  let num = parseFloat(numMatch[0].replace(/,/g, '.'));
  if (lower.includes('tỷ')) return num * 1000000000;
  if (lower.includes('triệu') || lower.includes('tr')) return num * 1000000;
  return num;
}

// ── Compute price per m² ─────────────────────────────────────────────────────

function computePricePerM2(price, area) {
  if (!price || !area || area <= 0) return 0;
  return Math.round(price / area);
}

// ── MeeyLand → NhaDat.City data transformer ─────────────────────────────────

function extractMeeylandTranslation(obj) {
  if (!obj || !obj.translation) return null;
  const vi = obj.translation.find(t => t.languageCode === 'vi');
  if (!vi) return obj.translation[0] || null;
  return vi;
}

function mapMeeylandAdminUnit(city, district, ward) {
  const result = {};
  if (city) {
    const t = extractMeeylandTranslation(city);
    if (t) result.province = makeUrlSlug(t.name);
  }
  if (district) {
    const t = extractMeeylandTranslation(district);
    if (t) result.district = makeUrlSlug((t.prefix ? t.prefix + ' ' : '') + t.name);
  }
  if (ward) {
    const t = extractMeeylandTranslation(ward);
    if (t) result.ward = makeUrlSlug((t.prefix ? t.prefix + ' ' : '') + t.name);
  }
  return result;
}

function extractMeeylandListingData(detail) {
  const adminunit = mapMeeylandAdminUnit(detail.city, detail.district, detail.ward);
  
  // Build address label
  let address = detail.addressLabel || detail.address || '';
  if (!address && adminunit.ward) {
    address = [adminunit.ward, adminunit.district, adminunit.province].filter(Boolean).join(', ');
  }

  // Extract coordinates
  let coordinates = null;
  if (detail.location && detail.location.coordinates && detail.location.coordinates.length === 2) {
    coordinates = detail.location.coordinates; // [lng, lat]
  }

  // Extract images
  const images = (detail.media || [])
    .filter(m => m.mediaType === 1 && m.url)
    .map(m => m.url);

  // Extract property type
  let propertyType = 'nha_dat';
  if (detail.typeOfHouse && detail.typeOfHouse.value) {
    propertyType = config.MEEYLAND_TYPE_MAP[detail.typeOfHouse.value] || detail.typeOfHouse.value;
  }

  // Legal paper
  const legalPaper = (detail.legalPaper || []).map(l => l.label || l.value).join(', ');

  // Direction
  const direction = (detail.directions || []).map(d => d.label || d.value).join(', ');

  // Advantages
  const advantages = (detail.advantages || []).map(a => a.label || a.value);

  // Contact
  const contact = {};
  if (detail.contact) {
    contact.fullName = detail.contact.fullName || '';
    contact.phones = detail.contact.phones || [];
    contact.email = detail.contact.email || '';
  }

  const totalPrice = detail.totalPrice || 0;
  const area = detail.area || 0;

  return {
    title: detail.title || '',
    description: (detail.description || '').replace(/<[^>]*>/g, ''),
    price: totalPrice,
    totalPrice,
    pricePerM2: computePricePerM2(totalPrice, area),
    area,
    address,
    coordinates,
    adminunit,
    images,
    propertyType,
    bedrooms: detail.totalBedroom || null,
    bathrooms: detail.totalBathroom || null,
    totalFloor: detail.totalFloor || null,
    facade: detail.facade || null,
    depth: detail.depth || null,
    wideRoad: detail.wideRoad ? (detail.wideRoad.label || detail.wideRoadLabel || '') : '',
    direction,
    legalPaper,
    furniture: detail.furniture || false,
    advantages,
    levelTransaction: detail.levelTransactionLabel || '',
    contact,
    userType: detail.userTypesLabel || '',
    sourceCode: detail.code || '',
    sourceUrl: detail.url || `https://meeyland.com${detail.uri || ''}`,
    sourceType: 'meeyland.com',
    thumbnailUrl: detail.thumbnail ? detail.thumbnail.url : '',
    publishedAt: detail.publishedAt ? new Date(detail.publishedAt) : new Date(),
    expiredAt: detail.expiredAt ? new Date(detail.expiredAt) : null,
    createdAt: new Date(),
    isScraped: true,
    status: 2,
    totalView: detail.totalView || 0,
    priceLabel: detail.priceLabel || null,
  };
}

// ── MeeyProject → NhaDat.City project transformer ───────────────────────────

// ── MeeyProject → NhaDat.City project transformer ───────────────────────────

function extractMeeyProjectData(detail) {
  const adminunit = mapMeeylandAdminUnit(detail.city, detail.district, detail.ward);

  // Build address
  let address = detail.addressLabel || detail.address || '';
  if (detail.meeyland && detail.meeyland.address) {
    address = detail.meeyland.address;
  }

  // Coordinates
  let coordinates = null;
  if (detail.location && detail.location.coordinates && detail.location.coordinates.length === 2) {
    coordinates = detail.location.coordinates;
  }

  // Images
  const images = (detail.images || [])
    .filter(img => img.url)
    .map(img => img.url);

  // Investor
  let investorName = '';
  let investorDescription = '';
  let investorLogo = '';
  if (detail.investorRelated && detail.investorRelated.investor) {
    const inv = detail.investorRelated.investor;
    investorName = inv.tradeName || inv.name || '';
    investorDescription = decode((inv.description || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
    investorLogo = inv.logo ? inv.logo.url : '';
  }

  // Project types
  const projectTypes = (detail.projectTypes || []).map(pt => {
    const t = extractMeeylandTranslation(pt);
    return t ? t.name : '';
  }).filter(Boolean);

  // Street
  let streetName = '';
  if (detail.street) {
    const t = extractMeeylandTranslation(detail.street);
    if (t) streetName = (t.prefix ? t.prefix + ' ' : '') + t.name;
  }

  // Utilities (clean HTML, decode entities)
  let utilitiesDescription = '';
  if (detail.utilities) {
    const rawHTML = detail.utilities.basicDescription || '';
    utilitiesDescription = decode(rawHTML.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  }

  // Location description
  let locationDescription = '';
  if (detail.locationTab && detail.locationTab.trafficLineDescription) {
    const rawHTML = detail.locationTab.trafficLineDescription;
    locationDescription = decode(rawHTML.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  }

  // Description (prefer descriptionFormat)
  const descRaw = detail.descriptionFormat || detail.description || '';
  const description = decode(descRaw.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

  // Juridical status
  const juridical = detail.juridical || {};

  // Construction progress
  const constructionProgress = detail.constructionProgress || {};

  // Sale policy
  const salePolicy = detail.salePolicy || {};

  // Banner
  const banner = detail.banner ? detail.banner.url : '';

  return {
    title: detail.meeyland?.title || detail.name || detail.tradeName || '',
    tradeName: detail.tradeName || '',
    description,
    address,
    streetName,
    coordinates,
    adminunit,
    images,
    banner,
    logo: detail.logo ? detail.logo.url : '',
    slug: detail.slug || '',
    shortId: detail.shortId || 0,

    // Investor
    investorName,
    investorDescription,
    investorLogo,

    // Project specs
    projectTypes,
    totalApartment: detail.totalApartment || '',
    totalBuilding: detail.totalBuilding || '',
    totalFloor: detail.totalFloor || '',
    totalArea: detail.totalArea || '',
    buildingDensity: detail.buildingDensity || '',
    ownership: detail.ownership || '',
    
    // Status & timeline
    status: detail.status || 'unknown',
    completionTime: detail.completionTime || null,
    startTime: detail.startTime || null,
    
    // Rich content sections
    utilitiesDescription,
    locationDescription,
    constructionProgress: {
      description: constructionProgress.description || '',
      images: (constructionProgress.images || []).map(img => img.url).filter(Boolean),
    },
    salePolicy: {
      description: salePolicy.description || '',
      images: (salePolicy.images || []).map(img => img.url).filter(Boolean),
    },
    juridical: {
      description: juridical.description || '',
      hasBusinessLicense: (juridical.businessLicense || []).length > 0,
      hasConstructionPermit: (juridical.constructionPermit || []).length > 0,
      hasBankGuarantee: (juridical.bankGuarantee || []).length > 0,
    },

    // Meta
    sourceUrl: `https://meeyproject.com/project/${detail.slug}-${detail.shortId}`,
    sourceType: 'meeyproject.com',
    propertyType: 'du_an',
    createdAt: new Date(),
    publishedAt: detail.publishedAt ? new Date(detail.publishedAt) : new Date(),
    isScraped: true,
    price: 0,
    totalPrice: 0,
    area: 0,
  };
}

// ── TinBDS listing card parser ───────────────────────────────────────────────

function parseTinbdsListingCard($, el) {
  const title = $(el).find('h2 a, h3 a, .title a').first().text().trim();
  const href = $(el).find('h2 a, h3 a, .title a').first().attr('href');
  const description = $(el).find('.description, .des, p').first().text().trim();
  const priceText = $(el).text().match(/Giá:\s*([^\n]+)/)?.[1]?.trim() || '';
  const areaText = $(el).text().match(/Diện tích:\s*([^\n]+)/)?.[1]?.trim() || '';
  const dateText = $(el).text().match(/Ngày đăng:\s*([^\n]+)/)?.[1]?.trim() || '';

  const price = parsePrice(priceText);
  const areaMatch = areaText.match(/([\d.,]+)/);
  const area = areaMatch ? parseFloat(areaMatch[1].replace(/,/g, '.')) : 0;

  return {
    title,
    href: href ? (href.startsWith('http') ? href : `${config.TINBDS_BASE}${href}`) : null,
    description,
    price,
    area,
    dateText,
  };
}

// ── Delay utility ────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Update job progress ──────────────────────────────────────────────────────

async function updateJobProgress(db, jobId, itemsScraped, errors, extra = {}) {
  if (!jobId || jobId === 'local-test') return;
  await store.updateJob(jobId, { itemsScraped, errors, ...extra });
}

// ── Geocoding utility ────────────────────────────────────────────────────────
async function geocodeAddress(address, nominatimUrl) {
  if (!address || address === 'Đang cập nhật' || address.trim().length < 5) return null;
  
  // Try configured Nominatim URL first, then fallback to public OpenStreetMap Nominatim
  const urls = [
    nominatimUrl || 'http://internal.example/nominatim',
    'https://nominatim.openstreetmap.org'
  ];

  for (const baseUrl of urls) {
    try {
      const q = encodeURIComponent(address.includes('Việt Nam') ? address : address + ', Việt Nam');
      const url = `${baseUrl}/search?format=json&q=${q}&limit=1&addressdetails=1&accept-language=vi`;
      console.log(`[GEOCODE] Geocoding "${address}" via ${baseUrl}...`);
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'NhaDatCity-Scraper/1.0 (nhadat.city)' },
        timeout: 5000,
      });
      if (res.data && res.data.length > 0) {
        const lat = parseFloat(res.data[0].lat);
        const lon = parseFloat(res.data[0].lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          console.log(`[GEOCODE] Success: [${lon}, ${lat}]`);
          return [lon, lat]; // [lng, lat]
        }
      }
    } catch (e) {
      console.warn(`[GEOCODE WARNING] Geocoding failed on ${baseUrl}:`, e.message);
    }
  }
  return null;
}

// ── Validation utilities ─────────────────────────────────────────────────────
function validateListingData(doc) {
  if (!doc) return false;
  
  if (!doc.title || typeof doc.title !== 'string' || doc.title.trim().length === 0) {
    console.log('  Skip (missing or invalid title)');
    return false;
  }
  
  if (!doc.coordinates || !Array.isArray(doc.coordinates) || doc.coordinates.length < 2) {
    console.log(`  Skip (missing coordinates) for: ${doc.title.substring(0, 40)}`);
    return false;
  }
  const [lng, lat] = doc.coordinates;
  if (typeof lng !== 'number' || typeof lat !== 'number' || lng === 0 || lat === 0 || isNaN(lng) || isNaN(lat)) {
    console.log(`  Skip (invalid coordinates: [${lng}, ${lat}]) for: ${doc.title.substring(0, 40)}`);
    return false;
  }
  
  if (!doc.images || !Array.isArray(doc.images) || doc.images.length === 0) {
    console.log(`  Skip (no valid images) for: ${doc.title.substring(0, 40)}`);
    return false;
  }
  
  const price = doc.totalPrice || doc.price || 0;
  if (typeof price !== 'number' || price <= 0 || isNaN(price)) {
    console.log(`  Skip (missing or invalid price: ${price}) for: ${doc.title.substring(0, 40)}`);
    return false;
  }
  
  if (typeof doc.area !== 'number' || doc.area <= 0 || isNaN(doc.area)) {
    console.log(`  Skip (missing or invalid area: ${doc.area}) for: ${doc.title.substring(0, 40)}`);
    return false;
  }
  
  if (!doc.description || typeof doc.description !== 'string' || doc.description.trim().length === 0) {
    console.log(`  Skip (missing or empty description/content) for: ${doc.title.substring(0, 40)}`);
    return false;
  }
  
  return true;
}

function validateProjectData(doc) {
  if (!doc) return false;
  
  if (!doc.title || typeof doc.title !== 'string' || doc.title.trim().length === 0) {
    console.log('  Skip (missing or invalid title)');
    return false;
  }
  
  if (!doc.coordinates || !Array.isArray(doc.coordinates) || doc.coordinates.length < 2) {
    console.log(`  Skip (missing coordinates) for project: ${doc.title.substring(0, 40)}`);
    return false;
  }
  const [lng, lat] = doc.coordinates;
  if (typeof lng !== 'number' || typeof lat !== 'number' || lng === 0 || lat === 0 || isNaN(lng) || isNaN(lat)) {
    console.log(`  Skip (invalid coordinates: [${lng}, ${lat}]) for project: ${doc.title.substring(0, 40)}`);
    return false;
  }
  
  if (!doc.images || !Array.isArray(doc.images) || doc.images.length === 0) {
    console.log(`  Skip (no valid images) for project: ${doc.title.substring(0, 40)}`);
    return false;
  }
  
  if (!doc.description || typeof doc.description !== 'string' || doc.description.trim().length === 0) {
    console.log(`  Skip (missing or empty description/content) for project: ${doc.title.substring(0, 40)}`);
    return false;
  }
  
  return true;
}

module.exports = {
  checkJobStatus,
  downloadAndProcessImage,
  spinContent,
  processProjectData,
  extractSpecs,
  parsePrice,
  computePricePerM2,
  extractMeeylandTranslation,
  mapMeeylandAdminUnit,
  extractMeeylandListingData,
  extractMeeyProjectData,
  parseTinbdsListingCard,
  delay,
  updateJobProgress,
  geocodeAddress,
  validateListingData,
  validateProjectData,
};
