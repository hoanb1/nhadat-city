import type { Metadata } from 'next';
import { ClientStats } from '../ClientStats';
import { slugToProvince } from '@/lib/utils/province';
import { fetchStatistics } from '@/lib/db/statistics';

export const revalidate = 3600; // Cache 1 giờ

async function getRegionalStats(province: string) {
  try {
    return await fetchStatistics({ 'adminunit.province': province, status: { $gte: 1 } });
  } catch (err) {
    console.error(`[RegionalStatsPage] Failed to fetch statistics for ${province}:`, err);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ province: string }> }): Promise<Metadata> {
  const { province } = await params;
  const provinceName = slugToProvince(province);
  const data = await getRegionalStats(province);

  // Dữ liệu thực từ MongoDB
  const totalListings = data?.overall?.totalListings ? data.overall.totalListings.toLocaleString('vi-VN') : '';
  const avgPriceM2 = data?.overall?.avgPriceM2
    ? `${(data.overall.avgPriceM2 / 1_000_000).toFixed(1)} triệu/m²`
    : null;

  const titleSuffix = avgPriceM2 ? ` – Giá TB ${avgPriceM2}` : '';
  const descStats = [
    totalListings ? `${totalListings} tin đăng` : null,
    avgPriceM2 ? `giá trung bình ${avgPriceM2}` : null,
  ].filter(Boolean).join(', ');

  const title = `Thống kê thị trường BĐS ${provinceName} 2026${titleSuffix}`;
  const description = descStats
    ? `Phân tích chuyên sâu thị trường bất động sản ${provinceName}: ${descStats}. Biểu đồ biến động giá, nguồn cung, phân khúc diện tích và loại hình BĐS. Cập nhật liên tục 24/7.`
    : `Báo cáo phân tích chuyên sâu về biến động giá nhà đất, nguồn cung, nhu cầu bán/cho thuê tại ${provinceName}. Cập nhật liên tục 24/7.`;

  const canonicalUrl = `https://nhadat.city/thong-ke/${province}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'article',
      siteName: 'NhaDat.City',
      locale: 'vi_VN',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function RegionalStatsPage({ params }: { params: Promise<{ province: string }> }) {
  const { province } = await params;
  const provinceName = slugToProvince(province);
  const canonicalUrl = `https://nhadat.city/thong-ke/${province}`;
  
  const data = await getRegionalStats(province);

  // JSON-LD: Dataset — helps Google understand this is a data page
  const datasetJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `Thống kê thị trường bất động sản ${provinceName} 2026`,
    description: `Dữ liệu phân tích giá, nguồn cung, phân khúc và loại hình bất động sản tại ${provinceName}. Cập nhật liên tục 24/7.`,
    url: canonicalUrl,
    creator: { '@type': 'Organization', name: 'NhaDat.City', url: 'https://nhadat.city' },
    keywords: [`bất động sản ${provinceName}`, `giá nhà ${provinceName}`, `thống kê BĐS`, `thị trường nhà đất`],
    license: 'https://nhadat.city/terms',
    temporalCoverage: '2024/..',
    spatialCoverage: { '@type': 'Place', name: provinceName, addressCountry: 'VN' },
  };

  // JSON-LD: BreadcrumbList
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'NhaDat.City', item: 'https://nhadat.city' },
      { '@type': 'ListItem', position: 2, name: 'Thống kê thị trường', item: 'https://nhadat.city/thong-ke' },
      { '@type': 'ListItem', position: 3, name: provinceName, item: canonicalUrl },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <ClientStats province={province} initialData={data} />
    </>
  );
}
