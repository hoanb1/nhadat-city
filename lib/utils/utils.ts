// lib/utils/utils.ts
import { randomBytes } from 'crypto';
import { IMAGE_CONFIG, IMAGE_SIZES } from '@/lib/config/image';
import { CDN_URL } from '@/lib/config/server';

// Re-export for consumers that import IMAGE_SIZES from this module
export { IMAGE_SIZES };

/**
 * Generate a URL-safe short ID
 */
export function generateShortId(length = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(length);
  let res = '';
  for (let i = 0; i < length; i++) {
    res += chars[bytes[i] % chars.length];
  }
  return res;
}

/**
 * Generate image URL for a real estate item
 * Port of MetaUtils.getImageUrl from Meteor
 */
export function getImageUrl(
  imageId: string | undefined,
  realEstateId: string | null = null,
  reqWidth: number = IMAGE_CONFIG.SIZES.SMALL.width,
  reqHeight: number = IMAGE_CONFIG.SIZES.SMALL.height
): string {
  // Normalize sizes to improve CDN cache hit rates and reduce payload
  let width, height;
  if (reqWidth <= IMAGE_CONFIG.SIZES.SMALL.width) { 
    width = IMAGE_CONFIG.SIZES.SMALL.width; height = IMAGE_CONFIG.SIZES.SMALL.height; 
  } else if (reqWidth <= IMAGE_CONFIG.SIZES.MEDIUM.width) { 
    width = IMAGE_CONFIG.SIZES.MEDIUM.width; height = IMAGE_CONFIG.SIZES.MEDIUM.height; 
  } else { 
    width = IMAGE_CONFIG.SIZES.LARGE.width; height = IMAGE_CONFIG.SIZES.LARGE.height; 
  }

  if (!imageId) return `https://placehold.co/${width}x${height}?text=No+Image`;
  return `${CDN_URL}/image-api/v1/${width}/${height}/${imageId}.webp`;
}

/**
 * Create URL slug from title
 * Port of MetaUtils.makeUrlSlug
 */
export function makeUrlSlug(title: string): string {
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

/**
 * Format price in Vietnamese format (tỷ/triệu)
 */
export function formatMoney(amount: number): string {
  if (!amount) return 'Thỏa thuận';
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '')} tỷ`;
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(0)} triệu`;
  }
  return amount.toLocaleString('vi-VN') + ' đ';
}

/**
 * Format area in m²
 */
export function formatArea(area: number): string {
  if (!area) return '';
  return `${area.toFixed(1).replace(/\.0$/, '')} m²`;
}

/**
 * Format date in Vietnamese
 */
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Get relative time in Vietnamese
 */
export function getRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === 1) return 'Hôm qua';
  if (diffDays < 7) return `${diffDays} ngày trước`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} tháng trước`;
  return `${Math.floor(diffDays / 365)} năm trước`;
}

/**
 * Clean and shorten text for meta descriptions
 */
export function cleanAndShortenText(text: string, maxLength = 160): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '') // strip HTML
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, maxLength);
}

/**
 * Generate canonical URL for a real estate listing.
/**
 * Robust Single Source of Truth for generating Real Estate URLs
 * Format: /{province}/{ward-or-district}/{id}/{slug}
 * Automatically strips administrative prefixes and handles missing ward/district.
 */
export function getRealEstateUrl(item: { 
  adminunit?: { province?: string; district?: string; ward?: string }; 
  _id: any; 
  shortId?: string; 
  title?: string; 
}) {
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

/**
 * Generate canonical URL for a project
 */
export function getProjectUrl(item: { _id: string, shortId?: string, title: string }) {
  const slug = makeUrlSlug(item.title || '');
  const id = item.shortId || item._id;
  return `/du-an/${id}/${slug}`;
}

/**
 * Escapes special characters for safe use in XML/HTML markup.
 */
export function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}


