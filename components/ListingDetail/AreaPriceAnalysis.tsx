'use client';

import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus, MapPin } from 'lucide-react';
import { formatMoney } from '@/lib/utils/utils';
import dynamic from 'next/dynamic';

const PriceFluctuationChart = dynamic(() => import('./PriceFluctuationChart'), { ssr: false, loading: () => <div className="h-48 bg-slate-50 animate-pulse rounded-2xl mt-4"></div> });

interface Props {
  listing: any;
}

interface AreaStats {
  avgPricePerM2: number;
  medianPricePerM2: number;
  minPricePerM2: number;
  maxPricePerM2: number;
  avgTotalPrice: number;
  avgArea: number;
  count: number;
  distribution: { label: string; count: number }[];
  district: string;
  province: string;
}

export default function AreaPriceAnalysis({ listing }: Props) {
  const [stats, setStats] = useState<AreaStats | null>(null);
  const [loading, setLoading] = useState(true);

  const listingPricePerM2 = listing.area > 0 && listing.totalPrice > 0
    ? listing.totalPrice / listing.area
    : 0;

  useEffect(() => {
    const district = listing.adminunit?.district;
    const province = listing.adminunit?.province;
    if (!district && !province) { setLoading(false); return; }

    const params = new URLSearchParams();
    if (district) params.set('district', district);
    if (province) params.set('province', province);
    if (listing.propertyType) params.set('propertyType', listing.propertyType);

    fetch(`/api/real-estate/area-stats?${params}`)
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [listing]);

  if (loading) {
    return (
      <div className="bg-white sm:rounded-2xl sm:border border-slate-200 p-5 sm:p-7 shadow-sm animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-48 mb-4" />
        <div className="h-32 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (!stats || stats.count < 1 || !listingPricePerM2) return null;

  const diff = listingPricePerM2 - stats.avgPricePerM2;
  const diffPct = (diff / stats.avgPricePerM2) * 100;
  const isBelow = diffPct < -5;
  const isAbove = diffPct > 5;

  const maxCount = Math.max(...stats.distribution.map(d => d.count), 1);

  return (
    <div className="bg-white sm:rounded-2xl sm:border border-slate-200 p-5 sm:p-7 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white">
          <BarChart3 size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Phân tích giá khu vực</h2>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <MapPin size={11} />
            {stats.district || stats.province} — {stats.count.toLocaleString()} tin đăng
          </p>
        </div>
      </div>

      {/* Price Comparison Badge */}
      <div className={`flex items-center gap-3 p-4 rounded-xl mb-5 ${
        isBelow ? 'bg-emerald-50 border border-emerald-200' :
        isAbove ? 'bg-amber-50 border border-amber-200' :
        'bg-slate-50 border border-slate-200'
      }`}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
          isBelow ? 'bg-emerald-100 text-emerald-600' :
          isAbove ? 'bg-amber-100 text-amber-600' :
          'bg-slate-200 text-slate-600'
        }`}>
          {isBelow ? <TrendingDown size={24} /> : isAbove ? <TrendingUp size={24} /> : <Minus size={24} />}
        </div>
        <div>
          <div className={`text-lg font-bold ${
            isBelow ? 'text-emerald-700' : isAbove ? 'text-amber-700' : 'text-slate-700'
          }`}>
            {isBelow ? `Thấp hơn ${Math.abs(diffPct).toFixed(0)}%` :
             isAbove ? `Cao hơn ${diffPct.toFixed(0)}%` :
             'Ngang giá thị trường'}
          </div>
          <div className="text-sm text-slate-600">
            so với giá trung bình khu vực ({formatMoney(stats.avgPricePerM2)}/m²)
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <div className="text-[11px] text-slate-500 mb-0.5">Giá BĐS này</div>
          <div className="text-sm font-bold text-indigo-700">{formatMoney(listingPricePerM2)}/m²</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <div className="text-[11px] text-slate-500 mb-0.5">TB khu vực</div>
          <div className="text-sm font-bold text-slate-800">{formatMoney(stats.avgPricePerM2)}/m²</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <div className="text-[11px] text-slate-500 mb-0.5">Thấp nhất</div>
          <div className="text-sm font-bold text-emerald-700">{formatMoney(stats.minPricePerM2)}/m²</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <div className="text-[11px] text-slate-500 mb-0.5">Cao nhất</div>
          <div className="text-sm font-bold text-rose-700">{formatMoney(stats.maxPricePerM2)}/m²</div>
        </div>
      </div>

      {/* Distribution Bar Chart */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Phân bố giá /m² trong khu vực</h3>
        <div className="space-y-2">
          {stats.distribution.map((bin, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-28 sm:w-36 text-xs text-slate-600 shrink-0">{bin.label}</div>
              <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-400 to-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${(bin.count / maxCount) * 100}%` }}
                />
              </div>
              <div className="text-xs font-medium text-slate-600 w-10 text-right">{bin.count}</div>
            </div>
          ))}
        </div>
      </div>

      <PriceFluctuationChart basePrice={stats.avgPricePerM2} province={stats.province} />
    </div>
  );
}
