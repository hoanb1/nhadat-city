'use client';
import { useEffect, useState } from 'react';
import { StatisticsDashboard } from '@/components/Statistics/StatisticsDashboard';
import Link from 'next/link';
import { slugToProvince } from '@/lib/utils/province';

export function ClientStats({ province, initialData }: { province?: string, initialData?: any }) {
  const [data, setData] = useState<any>(initialData || null);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    if (initialData) return; // Skip fetching if SSR already provided data
    const fetchStats = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        if (province) query.set('province', province);
        
        const res = await fetch(`/api/statistics?${query.toString()}`);
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [province, initialData]);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Báo cáo thống kê thị trường bất động sản {province ? slugToProvince(province) : 'toàn quốc'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Dữ liệu tổng hợp từ hàng trăm nghìn tin đăng chính chủ, phân tích biến động giá, phân khúc diện tích và loại hình bất động sản.
          </p>
        </div>
        <div className="mt-3 sm:mt-0 flex gap-2">
          <Link
            href={province ? `/${province}` : '/mua-ban'}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all text-center no-underline"
          >
            Xem tin đăng {province ? slugToProvince(province) : 'toàn quốc'}
          </Link>
        </div>
      </div>
      <div className="p-6 flex-1 bg-white">
        <StatisticsDashboard data={data} loading={loading} />
      </div>
    </>
  );
}
