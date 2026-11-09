import type { Metadata } from 'next';
import { ClientStats } from './ClientStats';
import { fetchStatistics } from '@/lib/db/statistics';

export const revalidate = 3600; // Cache 1 giờ

export const metadata: Metadata = {
  title: 'Thống kê thị trường bất động sản toàn quốc 2026 | NhaDat.City',
  description: 'Báo cáo phân tích chuyên sâu về biến động giá nhà đất, nguồn cung, nhu cầu bán/cho thuê và các phân khúc diện tích trên toàn quốc. Cập nhật liên tục 24/7.',
  alternates: {
    canonical: 'https://nhadat.city/thong-ke',
  }
};

async function getNationalStats() {
  try {
    return await fetchStatistics({ status: { $gte: 1 } });
  } catch (err) {
    console.error('[NationalStatsPage] Failed to fetch statistics directly from DB:', err);
    return null;
  }
}

export default async function NationalStatsPage() {
  const data = await getNationalStats();
  
  return (
    <>
      <ClientStats initialData={data} />
    </>
  );
}
