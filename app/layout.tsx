import type { Metadata, Viewport } from 'next';
import './globals.css';

const SITE_URL = 'https://nhadat.city';
const OG_IMAGE = 'https://nhadat.city/og-image.jpg'; // 1200x630

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#1d4ed8',
};

export const metadata: Metadata = {
  title: {
    default: 'Tra cứu bản đồ quy hoạch & mua bán nhà đất chính chủ 24/7 | NhaDat.City',
    template: '%s | NhaDat.City',
  },
  description: 'Nền tảng bất động sản thông minh: xem bản đồ quy hoạch, giá nhà, hơn 1 triệu tin đăng chính chủ toàn quốc, cập nhật 24/7.',
  keywords: 'bản đồ quy hoạch, nhà đất, mua bán nhà đất, bất động sản, quy hoạch đô thị, giá nhà đất, nhadat.city, nhà đất toàn quốc, mua nhà hà nội, mua nhà hcm, tin rao bán nhà đất, chính chủ không qua môi giới',
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: SITE_URL,
    languages: {
      'vi-VN': SITE_URL,
      'x-default': SITE_URL,
    },
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  openGraph: {
    title: 'Bản đồ quy hoạch & mua bán nhà đất toàn quốc | NhaDat.City',
    description: 'Nền tảng bản đồ bất động sản thông minh hàng đầu Việt Nam. Tra cứu quy hoạch, giá nhà, tin đăng chính chủ toàn quốc.',
    siteName: 'NhaDat.City',
    locale: 'vi_VN',
    type: 'website',
    url: SITE_URL,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Bản đồ quy hoạch & mua bán nhà đất toàn quốc | NhaDat.City' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bản đồ quy hoạch & mua bán nhà đất toàn quốc | NhaDat.City',
    description: 'Nền tảng bản đồ bất động sản thông minh hàng đầu Việt Nam. Tra cứu quy hoạch, giá nhà, tin đăng chính chủ toàn quốc.',
    images: [OG_IMAGE],
  },
  authors: [{ name: 'NhaDat.City', url: SITE_URL }],
};

import NextAuthProvider from '@/components/Providers/NextAuthProvider';
import GoogleOneTap from '@/components/Providers/GoogleOneTap';
import PushNotificationManager from '@/components/Providers/PushNotificationManager';
import { Inter } from 'next/font/google';
import { GoogleAnalytics } from '@next/third-parties/google';
import { Suspense } from 'react';
import AnalyticsTracker from '@/components/AnalyticsTracker';
import SeoFooter from '@/components/SeoFooter';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'optional', // eliminates render-blocking: uses system font on first load, Inter on repeat visits
  preload: true,
  weight: ['400', '500', '600', '700'],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={inter.className}>
      <head>
        {/* Preconnect to CDN */}
        <link rel="preconnect" href="https://cdn.nhadat.city" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://map-api.nhadat.city" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        {/* viewport is handled by Next.js via export viewport — do NOT duplicate here */}
        {/* Global JSON-LD: WebSite + Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'WebSite',
                '@id': `${SITE_URL}/#website`,
                name: 'NhaDat.City',
                url: SITE_URL,
                description: 'Nền tảng bản đồ bất động sản thông minh hàng đầu Việt Nam',
                inLanguage: 'vi',
                potentialAction: {
                  '@type': 'SearchAction',
                  target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/?q={search_term_string}` },
                  'query-input': 'required name=search_term_string',
                },
              },
              {
                '@type': 'Organization',
                '@id': `${SITE_URL}/#organization`,
                name: 'NhaDat.City',
                url: SITE_URL,
                logo: {
                  '@type': 'ImageObject',
                  url: `${SITE_URL}/logo.png`,
                  width: 512,
                  height: 512,
                },
                contactPoint: [
                  { '@type': 'ContactPoint', contactType: 'customer support', email: 'support@nhadat.city', availableLanguage: 'Vietnamese' },
                  { '@type': 'ContactPoint', contactType: 'sales', email: 'partner@nhadat.city' },
                ],
                sameAs: [SITE_URL],
              },
            ],
          }) }}
        />
      </head>
      <body className="theme-light" data-build-time={process.env.NEXT_PUBLIC_BUILD_TIME || 'dev'}>
        {/* Build time tracked via data-build-time attribute on body — console.log removed for production */}
        <NextAuthProvider>
          {children}
          <SeoFooter />
          <GoogleOneTap />
          <PushNotificationManager />
          <Suspense fallback={null}>
            <AnalyticsTracker />
          </Suspense>
        </NextAuthProvider>
        <GoogleAnalytics gaId="G-CF58FKT7N9" />
      </body>
    </html>
  );
}
