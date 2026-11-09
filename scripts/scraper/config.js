/**
 * Scraper Configuration
 * Centralized config for MeeyLand, MeeyProject, and TinBDS scrapers.
 */

module.exports = {
  // ── MeeyLand / MeeyProject API ─────────────────────────────
  MEEYLAND_API: 'https://api5.meeyland.com/v1',
  MEEYLAND_TENANT: 'bWVleWxhbmQ=',
  MEEYLAND_CATEGORIES: {
    MUA_BAN: '5deb722db4367252525c1d00',
    // Additional categories can be discovered via the API
  },
  MEEYLAND_TYPE_MAP: {
    'nha_rieng': 'nha_rieng',
    'chung_cu': 'can_ho_chung_cu',
    'biet_thu': 'biet_thu_lien_ke',
    'nha_pho': 'nha_mat_pho',
    'dat': 'dat',
    'dat_nen': 'dat_nen_du_an',
  },

  // ── TinBDS ─────────────────────────────────────────────────
  TINBDS_BASE: 'https://tinbds.com',
  TINBDS_LISTING_TYPES: [
    'ban-nha-rieng',
    'ban-can-ho-chung-cu',
    'ban-nha-biet-thu-lien-ke',
    'ban-nha-mat-pho',
    'ban-dat',
    'ban-dat-nen-du-an',
    'ban-kho-nha-xuong',
    'ban-trang-trai-khu-nghi-duong',
  ],
  TINBDS_SLUG_TO_TYPE: {
    'ban-nha-rieng': 'nha_rieng',
    'ban-can-ho-chung-cu': 'can_ho_chung_cu',
    'ban-nha-biet-thu-lien-ke': 'biet_thu_lien_ke',
    'ban-nha-mat-pho': 'nha_mat_pho',
    'ban-dat': 'dat',
    'ban-dat-nen-du-an': 'dat_nen_du_an',
    'ban-kho-nha-xuong': 'kho_nha_xuong',
    'ban-trang-trai-khu-nghi-duong': 'trang_trai_khu_nghi_duong',
  },

  // ── Rate limits & Batch ────────────────────────────────────
  BATCH_SIZE: 50,             // Crawl 50 per page
  DELAY_MS: 500,              // Delay between API calls
  TINBDS_DELAY_MS: 1500,      // Slower for HTML scraping
  MAX_IMAGES: 20,             // Max images
  MAX_PAGES_PER_RUN: 100,     // Deep crawl
  REQUEST_TIMEOUT: 15000,

  // ── Vietnamese province slug → name mapping (top cities) ──
  PROVINCE_MAP: {
    'ha-noi': 'Hà Nội',
    'ho-chi-minh': 'Hồ Chí Minh',
    'da-nang': 'Đà Nẵng',
    'hai-phong': 'Hải Phòng',
    'binh-duong': 'Bình Dương',
    'dong-nai': 'Đồng Nai',
    'khanh-hoa': 'Khánh Hòa',
    'ba-ria-vung-tau': 'Bà Rịa Vũng Tàu',
    'long-an': 'Long An',
    'bac-ninh': 'Bắc Ninh',
    'bac-giang': 'Bắc Giang',
    'thanh-hoa': 'Thanh Hóa',
    'nghe-an': 'Nghệ An',
    'ha-tinh': 'Hà Tĩnh',
    'quang-ninh': 'Quảng Ninh',
    'lam-dong': 'Lâm Đồng',
    'binh-thuan': 'Bình Thuận',
    'can-tho': 'Cần Thơ',
    'hung-yen': 'Hưng Yên',
    'hai-duong': 'Hải Dương',
  },
};
