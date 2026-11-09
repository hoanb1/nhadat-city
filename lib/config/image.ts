// lib/config/image.ts
/**
 * Centralized image processing configuration — Single Source of Truth.
 * Defines the canonical set of normalized thumbnail sizes and quality settings.
 * All components must reference these constants; never hardcode pixel values.
 */
export const IMAGE_CONFIG = {
  /** WebP compression quality (0-100). Balanced for size vs. quality. */
  QUALITY: 80,

  /**
   * Three canonical thumbnail sizes (4:3 ratio).
   * getImageUrl() normalizes any request to the nearest matching tier,
   * maximizing Cloudflare CDN cache hit rates.
   */
  SIZES: {
    SMALL:  { width: 320,  height: 240  }, // Card thumbnails, AI similar listings
    MEDIUM: { width: 640,  height: 480  }, // Grid images, mobile hero
    LARGE:  { width: 1024, height: 768  }, // Desktop hero, lightbox
  },
} as const;

/**
 * Named semantic aliases used by UI components.
 * These map human-readable intent to concrete normalized sizes.
 */
export const IMAGE_SIZES: Record<string, { width: number; height: number }> = {
  LIST:     { width: IMAGE_CONFIG.SIZES.SMALL.width,  height: IMAGE_CONFIG.SIZES.SMALL.height  },
  POPUP:    { width: IMAGE_CONFIG.SIZES.MEDIUM.width, height: IMAGE_CONFIG.SIZES.MEDIUM.height },
  CAROUSEL: { width: IMAGE_CONFIG.SIZES.LARGE.width,  height: IMAGE_CONFIG.SIZES.LARGE.height  },
};
