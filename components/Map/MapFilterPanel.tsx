'use client';

import { useState } from 'react';
import { useMapContext, type MapFilters } from './MapContext';
import { X } from 'lucide-react';

const PROPERTY_TYPES = [
  { value: 'nha_o', label: 'Nhà ở' },
  { value: 'chung_cu', label: 'Chung cư' },
  { value: 'dat_nen', label: 'Đất nền' },
  { value: 'biet_thu', label: 'Biệt thự' },
  { value: 'nha_lien_ke_song_lap_don_lap', label: 'Liền kề' },
  { value: 'shophouse_nha_pho', label: 'Shophouse/Nhà phố' },
  { value: 'san_van_phong', label: 'Văn phòng' },
  { value: 'kho_bai_nha_xuong_khu_cong_nghiep', label: 'Kho/Xưởng' },
  { value: 'nha_hang_cua_hang_ki_ot', label: 'Nhà hàng/Cửa hàng' },
  { value: 'khach_san_nha_nghi', label: 'Khách sạn' },
  { value: 'chung_cu_mini', label: 'Chung cư mini' },
  { value: 'dat_vuon', label: 'Đất vườn' },
  { value: 'dat_ruong', label: 'Đất ruộng' },
];

const DIRECTIONS = [
  { value: 'bac', label: 'Bắc' },
  { value: 'dong', label: 'Đông' },
  { value: 'nam', label: 'Nam' },
  { value: 'tay', label: 'Tây' },
  { value: 'dong_bac', label: 'Đông Bắc' },
  { value: 'dong_nam', label: 'Đông Nam' },
  { value: 'tay_bac', label: 'Tây Bắc' },
  { value: 'tay_nam', label: 'Tây Nam' },
];

const PRICE_OPTIONS = [
  { label: 'Dưới 1 tỷ', min: null, max: 1e9 },
  { label: '1 - 2 tỷ', min: 1e9, max: 2e9 },
  { label: '2 - 3 tỷ', min: 2e9, max: 3e9 },
  { label: '3 - 5 tỷ', min: 3e9, max: 5e9 },
  { label: '5 - 10 tỷ', min: 5e9, max: 10e9 },
  { label: '10 - 20 tỷ', min: 10e9, max: 20e9 },
  { label: 'Trên 20 tỷ', min: 20e9, max: null },
];

const AREA_OPTIONS = [
  { label: 'Dưới 30 m²', min: null, max: 30 },
  { label: '30 - 50 m²', min: 30, max: 50 },
  { label: '50 - 80 m²', min: 50, max: 80 },
  { label: '80 - 120 m²', min: 80, max: 120 },
  { label: '120 - 200 m²', min: 120, max: 200 },
  { label: 'Trên 200 m²', min: 200, max: null },
];

const DATE_OPTIONS = [
  { label: 'Hôm nay', value: 1 },
  { label: '3 ngày', value: 3 },
  { label: '1 tuần', value: 7 },
  { label: '1 tháng', value: 30 },
  { label: '3 tháng', value: 90 },
  { label: 'Tất cả', value: null },
];

const PRICE_PER_M2_OPTIONS = [
  { label: 'Dưới 20tr/m²', min: null, max: 20e6 },
  { label: '20 - 40 tr/m²', min: 20e6, max: 40e6 },
  { label: '40 - 80 tr/m²', min: 40e6, max: 80e6 },
  { label: '80 - 150 tr/m²', min: 80e6, max: 150e6 },
  { label: 'Trên 150 tr/m²', min: 150e6, max: null },
];

export default function MapFilterPanel({ onClose }: { onClose: () => void }) {
  const { filters, setFilters } = useMapContext();

  const [local, setLocal] = useState<MapFilters>({ ...filters });

  const toggleMulti = (field: 'propertyType' | 'direction', value: string) => {
    const curr = local[field] || [];
    const updated = curr.includes(value) ? curr.filter(v => v !== value) : [...curr, value];
    setLocal({ ...local, [field]: updated.length ? updated : undefined });
  };

  const setRange = (
    minKey: keyof MapFilters,
    maxKey: keyof MapFilters,
    min: number | null,
    max: number | null
  ) => {
    const isSame = local[minKey] === min && local[maxKey] === max;
    setLocal({ ...local, [minKey]: isSame ? undefined : min, [maxKey]: isSame ? undefined : max });
  };

  const countActive = () => {
    let n = 0;
    if (local.propertyType?.length) n++;
    if (local.direction?.length) n++;
    if (local.minPrice != null || local.maxPrice != null) n++;
    if (local.minArea != null || local.maxArea != null) n++;
    if (local.minPricePerM2 != null || local.maxPricePerM2 != null) n++;
    if (local.dateRange != null) n++;
    return n;
  };

  const apply = () => {
    setFilters(local);
    onClose();
  };

  const clear = () => {
    setLocal({ dateRange: null });
    setFilters({ dateRange: null });
    onClose();
  };

  return (
    <div className="bg-white rounded-sm shadow-[0_8px_32px_rgba(0,0,0,0.18)] flex flex-col max-h-[80vh] overflow-hidden border border-slate-200">
      <div className="flex items-center px-5 py-4 border-b border-slate-100 gap-3">
        <span className="font-bold text-[1.05rem] text-slate-800 flex-1">Bộ lọc</span>
        {countActive() > 0 && (
          <span className="bg-indigo-600 text-white text-[0.72rem] font-bold rounded-sm px-[7px] py-[1px]">{countActive()}</span>
        )}
        <button className="bg-transparent border-none text-[1rem] text-slate-400 cursor-pointer p-1 leading-none hover:text-slate-700 transition-colors flex items-center justify-center" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
      </div>

      <div className="overflow-y-auto flex-1 py-1 px-0">
        {/* Loại bất động sản */}
        <section className="px-5 py-4 border-b border-slate-100 pb-5">
          <div className="text-[0.78rem] font-bold text-slate-500 uppercase tracking-[0.04em] mb-[10px]">Loại bất động sản</div>
          <div className="flex flex-wrap gap-2.5">
            {PROPERTY_TYPES.map(t => (
              <button
                key={t.value}
                className={`px-4 py-2 rounded-md text-[0.85rem] cursor-pointer transition-all duration-200 font-medium whitespace-nowrap border-none ${(local.propertyType || []).includes(t.value) ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'}`}
                onClick={() => toggleMulti('propertyType', t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {/* Khoảng giá */}
        <section className="px-5 py-4 border-b border-slate-100 pb-5">
          <div className="text-[0.78rem] font-bold text-slate-500 uppercase tracking-[0.04em] mb-[10px]">Khoảng giá</div>
          <div className="flex flex-wrap gap-2.5">
            {PRICE_OPTIONS.map(o => (
              <button
                key={o.label}
                className={`px-4 py-2 rounded-md text-[0.85rem] cursor-pointer transition-all duration-200 font-medium whitespace-nowrap border-none ${local.minPrice === o.min && local.maxPrice === o.max ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'}`}
                onClick={() => setRange('minPrice', 'maxPrice', o.min, o.max)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>

        {/* Diện tích */}
        <section className="px-5 py-4 border-b border-slate-100 pb-5">
          <div className="text-[0.78rem] font-bold text-slate-500 uppercase tracking-[0.04em] mb-[10px]">Diện tích</div>
          <div className="flex flex-wrap gap-2.5">
            {AREA_OPTIONS.map(o => (
              <button
                key={o.label}
                className={`px-4 py-2 rounded-md text-[0.85rem] cursor-pointer transition-all duration-200 font-medium whitespace-nowrap border-none ${local.minArea === o.min && local.maxArea === o.max ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'}`}
                onClick={() => setRange('minArea', 'maxArea', o.min, o.max)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>

        {/* Giá theo m² */}
        <section className="px-5 py-4 border-b border-slate-100 pb-5">
          <div className="text-[0.78rem] font-bold text-slate-500 uppercase tracking-[0.04em] mb-[10px]">Giá theo m²</div>
          <div className="flex flex-wrap gap-2.5">
            {PRICE_PER_M2_OPTIONS.map(o => (
              <button
                key={o.label}
                className={`px-4 py-2 rounded-md text-[0.85rem] cursor-pointer transition-all duration-200 font-medium whitespace-nowrap border-none ${local.minPricePerM2 === o.min && local.maxPricePerM2 === o.max ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'}`}
                onClick={() => setRange('minPricePerM2', 'maxPricePerM2', o.min, o.max)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>

        {/* Hướng */}
        <section className="px-5 py-4 border-b border-slate-100 pb-5">
          <div className="text-[0.78rem] font-bold text-slate-500 uppercase tracking-[0.04em] mb-[10px]">Hướng nhà</div>
          <div className="flex flex-wrap gap-2.5">
            {DIRECTIONS.map(d => (
              <button
                key={d.value}
                className={`px-4 py-2 rounded-md text-[0.85rem] cursor-pointer transition-all duration-200 font-medium whitespace-nowrap border-none ${(local.direction || []).includes(d.value) ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'}`}
                onClick={() => toggleMulti('direction', d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </section>

        {/* Thời gian đăng */}
        <section className="px-5 py-4 border-b border-slate-100 pb-5">
          <div className="text-[0.78rem] font-bold text-slate-500 uppercase tracking-[0.04em] mb-[10px]">Thời gian đăng</div>
          <div className="flex flex-wrap gap-2.5">
            {DATE_OPTIONS.map(o => (
              <button
                key={o.label}
                className={`px-4 py-2 rounded-md text-[0.85rem] cursor-pointer transition-all duration-200 font-medium whitespace-nowrap border-none ${local.dateRange === o.value ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'}`}
                onClick={() => setLocal({ ...local, dateRange: local.dateRange === o.value ? undefined : o.value })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
        <button className="flex-1 p-3 border-[1.5px] border-slate-200 rounded-sm bg-white text-slate-500 font-semibold text-[0.95rem] cursor-pointer hover:bg-slate-50 transition-colors" onClick={clear}>Xóa bộ lọc</button>
        <button className="flex-[2] p-3 border-none rounded-sm bg-indigo-600 text-white font-bold text-[0.95rem] cursor-pointer hover:bg-indigo-700 transition-colors shadow-sm" onClick={apply}>
          Áp dụng{countActive() > 0 ? ` (${countActive()})` : ''}
        </button>
      </div>
    </div>
  );
}
