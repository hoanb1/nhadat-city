'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatMoney } from '@/lib/utils/utils';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

interface Props {
  basePrice: number;
  province?: string;
}

export default function PriceFluctuationChart({ basePrice, province }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Generate mock data for last 6 months based on basePrice
  const data = [
    { name: 'T12/25', price: basePrice * 0.92 },
    { name: 'T01/26', price: basePrice * 0.94 },
    { name: 'T02/26', price: basePrice * 0.93 },
    { name: 'T03/26', price: basePrice * 0.96 },
    { name: 'T04/26', price: basePrice * 0.98 },
    { name: 'T05/26', price: basePrice },
  ];

  if (!mounted) {
    return (
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Biến động giá (6 tháng qua)</h3>
        <div className="h-48 w-full bg-slate-50 animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Biến động giá (6 tháng qua)</h3>
      <div className="h-48 w-full bg-slate-50 p-2 rounded-xl" style={{ minHeight: 0, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
            <YAxis 
              stroke="#94a3b8" 
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              tickFormatter={(value) => `${(value / 1000000).toFixed(0)}tr`}
            />
            <Tooltip 
              formatter={(value: any) => [formatMoney(value) + '/m²', 'Giá trung bình']}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke="#6366f1" 
              strokeWidth={3} 
              dot={{ r: 4, stroke: '#6366f1', strokeWidth: 2, fill: '#fff' }}
              activeDot={{ r: 6, stroke: '#6366f1', strokeWidth: 2, fill: '#6366f1' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {province && (
        <div className="mt-3 text-right">
          <Link 
            href={`/thong-ke/${province}`} 
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Xem chi tiết biến động giá <ArrowUpRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}
