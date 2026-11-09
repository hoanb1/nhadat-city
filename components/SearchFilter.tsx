'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function SearchFilter({ province, ward }: { province: string; ward: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [minArea, setMinArea] = useState(searchParams.get('minArea') || '');
  const [maxArea, setMaxArea] = useState(searchParams.get('maxArea') || '');

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (minPrice) params.set('minPrice', minPrice); else params.delete('minPrice');
    if (maxPrice) params.set('maxPrice', maxPrice); else params.delete('maxPrice');
    if (minArea) params.set('minArea', minArea); else params.delete('minArea');
    if (maxArea) params.set('maxArea', maxArea); else params.delete('maxArea');
    
    router.push(`/${province}/${ward}?${params.toString()}`);
  };

  const clearFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    setMinArea('');
    setMaxArea('');
    router.push(`/${province}/${ward}`);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-sm p-4 mb-4 flex flex-wrap gap-6 sm:flex-col sm:gap-4 shadow-sm">
      <div className="flex flex-col gap-2">
        <label className="text-[0.85rem] font-semibold text-slate-600">Khoảng giá (Tỷ)</label>
        <div className="flex items-center gap-2 sm:w-full">
          <input className="w-[80px] p-2 border border-slate-200 rounded-sm text-[0.9rem] sm:w-full outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-shadow" type="number" placeholder="Từ" value={minPrice} onChange={e => setMinPrice(e.target.value)} />
          <span className="text-slate-400">-</span>
          <input className="w-[80px] p-2 border border-slate-200 rounded-sm text-[0.9rem] sm:w-full outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-shadow" type="number" placeholder="Đến" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
        </div>
      </div>
      
      <div className="flex flex-col gap-2">
        <label className="text-[0.85rem] font-semibold text-slate-600">Diện tích (m²)</label>
        <div className="flex items-center gap-2 sm:w-full">
          <input className="w-[80px] p-2 border border-slate-200 rounded-sm text-[0.9rem] sm:w-full outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-shadow" type="number" placeholder="Từ" value={minArea} onChange={e => setMinArea(e.target.value)} />
          <span className="text-slate-400">-</span>
          <input className="w-[80px] p-2 border border-slate-200 rounded-sm text-[0.9rem] sm:w-full outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-shadow" type="number" placeholder="Đến" value={maxArea} onChange={e => setMaxArea(e.target.value)} />
        </div>
      </div>

      <div className="flex items-end gap-3 ml-auto sm:ml-0 sm:w-full sm:justify-start">
        <button className="bg-indigo-600 text-white border border-indigo-700 py-2 px-5 rounded-sm font-semibold cursor-pointer hover:bg-indigo-700 transition-colors shadow-sm" onClick={applyFilters}>Áp dụng</button>
        <button className="bg-white text-slate-600 border border-slate-200 py-2 px-5 rounded-sm font-medium cursor-pointer hover:bg-slate-50 transition-colors shadow-sm" onClick={clearFilters}>Xóa lọc</button>
      </div>
    </div>
  );
}
