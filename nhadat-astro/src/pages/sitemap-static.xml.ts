import type { APIRoute } from 'astro';
import { PROVINCES_2025, LEGACY_PROVINCES } from '../lib/constants/provinces';
import { BANKS } from '../lib/constants/banks';
import { LAND_CODES } from '../lib/constants/landCodes';

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = site ? site.toString().replace(/\/$/, '') : 'https://nhadat.city';
  const now = new Date().toISOString();

  const staticUrls = [
    { loc: `${siteUrl}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${siteUrl}/cong-cu`, priority: '0.9', changefreq: 'weekly' },
    { loc: `${siteUrl}/cong-cu/chuyen-toa-do-vn2000`, priority: '0.9', changefreq: 'weekly' },
    { loc: `${siteUrl}/cong-cu/dinh-gia-nha-dat`, priority: '0.9', changefreq: 'weekly' },
    { loc: `${siteUrl}/cong-cu/tinh-lai-suat-vay`, priority: '0.9', changefreq: 'weekly' },
    { loc: `${siteUrl}/cong-cu/tinh-thue-phi-sang-ten`, priority: '0.9', changefreq: 'weekly' },
    { loc: `${siteUrl}/cong-cu/xem-huong-nha-phong-thuy`, priority: '0.9', changefreq: 'weekly' },
    { loc: `${siteUrl}/cong-cu/tinh-ty-suat-cho-thue`, priority: '0.9', changefreq: 'weekly' },
    { loc: `${siteUrl}/gia-dat`, priority: '0.9', changefreq: 'daily' },
    { loc: `${siteUrl}/quy-hoach`, priority: '0.9', changefreq: 'weekly' },
    { loc: `${siteUrl}/sap-nhap-hanh-chinh`, priority: '0.9', changefreq: 'weekly' },
    { loc: `${siteUrl}/ma-loai-dat`, priority: '0.9', changefreq: 'monthly' },
    { loc: `${siteUrl}/du-an`, priority: '0.9', changefreq: 'daily' },
    { loc: `${siteUrl}/phap-ly`, priority: '0.9', changefreq: 'weekly' },
  ];

  // 63 Legacy provinces VN2000 pages
  for (const lp of LEGACY_PROVINCES) {
    staticUrls.push({
      loc: `${siteUrl}/cong-cu/chuyen-toa-do-vn2000/${lp.slug}`,
      priority: '0.8',
      changefreq: 'monthly',
    });
  }

  // 35 Bank mortgage rate pages
  for (const b of BANKS) {
    staticUrls.push({
      loc: `${siteUrl}/cong-cu/tinh-lai-suat-vay/${b.slug}`,
      priority: '0.8',
      changefreq: 'weekly',
    });
  }

  // 34 Provinces Silos
  for (const p of PROVINCES_2025) {
    staticUrls.push({
      loc: `${siteUrl}/gia-dat/${p.slug}`,
      priority: '0.85',
      changefreq: 'daily',
    });
    staticUrls.push({
      loc: `${siteUrl}/quy-hoach/${p.slug}`,
      priority: '0.85',
      changefreq: 'weekly',
    });
    staticUrls.push({
      loc: `${siteUrl}/sap-nhap-hanh-chinh/${p.slug}`,
      priority: '0.8',
      changefreq: 'weekly',
    });
  }

  // 52 Land Codes
  for (const c of LAND_CODES) {
    staticUrls.push({
      loc: `${siteUrl}/ma-loai-dat/${c.code.toLowerCase()}`,
      priority: '0.8',
      changefreq: 'monthly',
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
