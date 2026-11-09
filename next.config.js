/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['mongodb', 'ioredis', 'bcryptjs'],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.nhadat.city',
      },
      {
        protocol: 'https',
        hostname: 'nhadat.city',
      },
      {
        protocol: 'https',
        hostname: 'i.meeymedia.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'api.nhadat.city',
          },
        ],
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
      // Block all /api/* from being indexed on main domain (saves crawl budget)
      // Googlebot was wasting 67% of crawl budget on /api/analytics/track, /api/ml/* etc.
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'map-api.nhadat.city',
          },
        ],
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
      {
        source: '/map-api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
      {
        // Long cache for static assets and optimized images
        source: '/(_next/static|_next/image|favicon.ico|manifest.json|tabler-icons.min.css)(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/robots.txt',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, must-revalidate' },
        ],
      },
      {
        source: '/sitemap.xml',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, must-revalidate' },
        ],
      },
    ];
  },

  async redirects() {
    return [
      // Redirect www.nhadat.city to nhadat.city
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.nhadat.city',
          },
        ],
        destination: 'https://nhadat.city/:path*',
        permanent: true,
      },
      // Redirect map-api.nhadat.city to nhadat.city for non-API requests
      {
        source: '/:path((?!api|map-api).*)',
        has: [
          {
            type: 'host',
            value: 'map-api.nhadat.city',
          },
        ],
        destination: 'https://nhadat.city/:path',
        permanent: true,
      },
      // Redirect api.nhadat.city to nhadat.city for non-API requests
      {
        source: '/:path((?!api|map-api).*)',
        has: [
          {
            type: 'host',
            value: 'api.nhadat.city',
          },
        ],
        destination: 'https://nhadat.city/:path',
        permanent: true,
      },
      // Redirect old Meteor URLs
      {
        source: '/real-estate/:id',
        destination: '/realestate/:id',
        permanent: true,
      },
      // Clean up malformed absolute URLs indexed by Google from the old site
      {
        source: '/https\\://:path*',
        destination: '/',
        permanent: true,
      },
      {
        source: '/http\\://:path*',
        destination: '/',
        permanent: true,
      },
      // Redirect old Meteor chart URLs to new thong-ke pages
      {
        source: '/real-estate-chart',
        destination: '/thong-ke',
        permanent: true,
      },
      {
        source: '/real-estate-chart/:province',
        destination: '/thong-ke/:province',
        permanent: true,
      },
      {
        source: '/real-estate-chart/:province/:ward',
        destination: '/:province/:ward', // No ward charts exist, redirect to listing page
        permanent: true,
      },
      // Redirect old Meteor policy pages to new page paths
      {
        source: '/page/privacy-policy',
        destination: '/privacy',
        permanent: true,
      },
      {
        source: '/page/terms-of-service',
        destination: '/terms',
        permanent: true,
      },
      // Redirect old sitemaps to the new standardized dynamic sitemaps
      {
        source: '/sitemap-real-estate.xml',
        destination: '/sitemap.xml',
        permanent: true,
      },
      {
        source: '/sitemap-real-estate-:id(\\d+).xml',
        destination: '/sitemap-listings-:id.xml',
        permanent: true,
      },
    ];
  },

  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: '/map-api/:path*',
          destination: '/api/map-api/:path*',
        },
        {
          source: '/image-api/:path*',
          destination: '/api/image-api/:path*',
        },
        // Standard sitemap rewrites mapping old/custom structures
        {
          source: '/sitemap-admin-unit.xml',
          destination: '/api/sitemaps/admin-unit',
        },
        {
          source: '/sitemap-listings-:page(\\d+).xml',
          destination: '/sitemap-listings/:page',
        },
      ],
      fallback: [
        {
          // Rewrite 3-segment paths to pass the 3rd segment as propertyType
          source: '/:province/:ward/:propertyType',
          destination: '/:province/:ward?propertyType=:propertyType',
        },
      ],
    };
  },

  experimental: {
    // Enable React 19 features
    ppr: false,
  },
};

module.exports = nextConfig;
