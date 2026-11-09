import { NextResponse } from 'next/server';
import { PROVINCES } from '@/lib/utils/province';
import { sql } from '@/lib/db/pg';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache for 1 hour instead of 24h

const BASE_URL = 'https://nhadat.city';

function buildXmlEntry(url: string, lastmod: string, changefreq: string, priority: string) {
  return `  <url>\n    <loc>${url}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

export async function GET() {
  const now = new Date().toISOString().split('T')[0];
  const entries: string[] = [];

  // Homepage
  entries.push(buildXmlEntry(BASE_URL, now, 'daily', '1.0'));

  // Static pages – includes critical landing pages for mua-ban and cho-thue
  const staticPages = [
    { path: '/mua-ban',  priority: '0.95', freq: 'daily' },   // Most important: buy listings
    { path: '/cho-thue', priority: '0.95', freq: 'daily' },   // Most important: rent listings
    { path: '/thong-ke', priority: '0.9',  freq: 'daily' },
    { path: '/about',    priority: '0.7',  freq: 'monthly' },
    { path: '/contact',  priority: '0.7',  freq: 'monthly' },
    { path: '/terms',    priority: '0.5',  freq: 'yearly' },
    { path: '/privacy',  priority: '0.5',  freq: 'yearly' },
  ];
  for (const p of staticPages) {
    entries.push(buildXmlEntry(`${BASE_URL}${p.path}`, now, p.freq, p.priority));
  }

  // All province pages + thong-ke pages
  for (const slug of Object.keys(PROVINCES)) {
    entries.push(buildXmlEntry(`${BASE_URL}/${slug}`, now, 'daily', '0.9'));
    entries.push(buildXmlEntry(`${BASE_URL}/thong-ke/${slug}`, now, 'daily', '0.8'));
  }

  // Top High-Intent Niche Keywords Programmatic Landing Pages (Extracted from GSC Top Queries)
  const nicheSlugs = [
    'ban-nha-linh-xuan',
    'ban-dat-linh-xuan',
    'ban-nha-phuong-linh-xuan',
    'ban-dat-phuong-linh-xuan',
    'nha-dat-linh-xuan',
    'caraworld',
    'polestar',
    'bds-ven-da-lat',
    'dat-vung-ven-da-lat',
    'pentstudio-westlake-hanoi',
    'biethu-ecopark-retreat-long-an',
    'shophouse-gamuda-nhon-trach',
    'ban-nha-duong-t6',
    'ban-dat-phu-my-an',
    'shophouse-tinh-hoa-vinhomes-co-loa',
    'ban-dat-duong-hung-vuong-tuy-hoa-phu-yen',
    'ban-dat-nen-hiep-phuoc',
    'ban-nha-thanh-khe-da-nang',
    'ban-biet-thu-flamingo-hai-tien',
    'ban-dat-son-thuy-4-da-nang',
    'hdi-homes-nguyen-tuan',
    'ban-dat-nguyen-nhuoc-phap-da-nang',
    'ban-dat-bo-dam-ben-xe-duc-long',
    'ban-nha-mat-tien-duong-160',
    'mua-can-ho-cau-rong-da-nang',
    'ban-nha-dien-chau',
    'ban-dat-felicity-uong-bi',
    'ban-dat-phuong-kinh-bac',
    'nhad-dat-dien-chau',
    'dat-ben-xe-duc-long-da-nang',
    'ban-nha-mat-pho-nguyen-van-loc',
    'ban-biet-thu-tuan-chau',
    'shophouse-tinh-hoa-vin-co-loa',
    'ban-biet-thu-vlasta-sam-son',
    'ban-dat-thuy-son-4-da-nang',
    'ban-dat-bui-tan-dien',
    'ban-chung-cu-newlife-bai-chay',
    'biethu-vinhomes-vu-yen-hoang-gia',
    'du-an-lucky-ari',
    'du-an-bonito-residence',
    'thuan-nghe-green-city',
    'ban-dat-dong-but-ngoc-liep-quoc-oai',
    'ban-dat-binh-hoa',
    'ban-nha-le-thi-hong-gam-da-nang',
    'ban-lien-ke-hd-mon',
    'ban-dat-hoa-ninh',
    'dat-ven-da-lat',
    'ban-dat-gan-kcn-tam-phuoc',
    'ban-dat-nguyen-nghiem-da-nang',
    'ban-dat-duong-dien-hong-da-nang',
    'bat-dong-san-ven-da-lat-duoi-2-ti',
    'ban-dat-trung-luong-10',
    'nguyen-quyen-luxury',
    'ban-nha-mat-tien-quach-dieu',
    'n03-t8-ngoai-giao-doan',
    'ban-dat-lideco-bai-muoi',
    'can-ho-tay-ha-tower',
    'du-an-the-golden-armor',
    'lien-ke-cat-tuong-vinhomes-co-loa',
    'ban-nha-mat-pho-hoang-tang-bi',
    'ban-nha-vinhome-ben-doan',
    'ban-dat-my-an-7-da-nang',
    'du-an-rio-centro-go-cat',
    'khu-dan-cu-sista-binh-chanh-1',
    'ban-dat-huong-mac-tu-son-bac-ninh',
    'ban-can-ho-sealink-mui-ne',
    'ban-dat-vinh-thai-nha-trang',
    'ban-nha-duong-t4a',
    'fuland-garden-8',
    'dat-nen-hoang-tien-central',
    'ban-dat-bo-quan-11-da-nang',
    'dat-nen-golden-mall-quan-9',
    'hoang-vinh-residence',
    'ban-dat-thiet-binh-van-ha',
    'ban-dat-van-ninh-khanh-hoa',
    'biet-thu-thanh-ha-quan-ha-dong',
  ];
  for (const nslug of nicheSlugs) {
    entries.push(buildXmlEntry(`${BASE_URL}/tu-khoa/${nslug}`, now, 'daily', '0.95'));
  }

  // Blog articles from Postgres
  try {
    const blogs = await sql`SELECT slug, updated_at AS "updatedAt" FROM blog_posts WHERE status = 'published' ORDER BY id`;
    for (const b of blogs) {
      const lastmod = b.updatedAt ? new Date(b.updatedAt).toISOString().split('T')[0] : now;
      entries.push(buildXmlEntry(`${BASE_URL}/blog/${b.slug}`, lastmod, 'weekly', '0.7'));
    }
  } catch { /* skip if db unavailable */ }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
