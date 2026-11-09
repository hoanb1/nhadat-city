'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import MapControlsDock from './MapControlsDock';
import { useMapContext } from './MapContext';
import MapSearchBox from './MapSearchBox';
import dynamic from 'next/dynamic';

// Dynamic imports to reduce initial JS payload
const RealEstateListClient = dynamic(() => import('@/components/RealEstateList/RealEstateListClient').then(mod => mod.RealEstateListClient), { ssr: false });
const ListingDetailOverlay = dynamic(() => import('./ListingDetailOverlay'), { ssr: false });
const UserProfileOverlay = dynamic(() => import('./UserProfileOverlay'), { ssr: false });
const MapFilterPanel = dynamic(() => import('./MapFilterPanel'), { ssr: false });
import {
  IconMenu2, IconMap2, IconAdjustmentsHorizontal, IconUser,
  IconSettings, IconLogout, IconX,
} from '@tabler/icons-react';
import { ListBreadcrumb } from '@/components/ListBreadcrumb';

interface MapOverlayUIProps {
  initialShowSidebar?: boolean;
}

export default function MapOverlayUI({ initialShowSidebar }: MapOverlayUIProps) {
  const { data: session } = useSession();
  const [showFilter, setShowFilter] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const { filters, province, ward, locationName, breadcrumbs } = useMapContext();

  useEffect(() => {
    if (initialShowSidebar !== undefined) {
      setShowSidebar(initialShowSidebar);
    } else if (window.innerWidth > 768) {
      setShowSidebar(true);
    }
  }, [initialShowSidebar]);

  const DEFAULT_FILTERS = { dateRange: 60 };
  const activeFilterCount = Object.entries(filters).filter(([key, v]) => {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    return (DEFAULT_FILTERS as any)[key] === undefined || v !== (DEFAULT_FILTERS as any)[key];
  }).length;

  return (
    <>
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      {/* Desktop: offset right when sidebar open. Mobile: full width, minimal */}
      <div className={`absolute top-4 z-[40] flex justify-center pointer-events-none transition-[padding-left] duration-300 ease-out left-0 w-full ${showSidebar ? 'md:pl-[360px]' : ''}`}>
        <header className="pointer-events-auto flex items-center gap-2 w-[96%] max-w-[640px] bg-white py-2 pl-2 pr-3 border border-slate-200 shadow-md rounded-full">

          {/* Hamburger — opens/closes sidebar on both mobile and desktop */}
          <button
            className="flex cursor-pointer text-[1.2rem] text-slate-700 items-center justify-center w-10 h-10 -ml-1 hover:text-indigo-600 transition-colors rounded-full hover:bg-slate-50 shrink-0"
            onClick={() => setShowSidebar(!showSidebar)}
            aria-label={showSidebar ? 'Đóng danh sách' : 'Mở danh sách'}
          >
            <IconMenu2 width="1em" height="1em" />
          </button>

          {/* Logo — desktop only (mobile: logo is inside sidebar) */}
          <Link href="/" className="hidden md:flex items-center gap-1.5 no-underline shrink-0">
            <span className="text-[1.35rem] text-indigo-700">
              <IconMap2 width="1em" height="1em" />
            </span>
            <span className="font-extrabold text-[1rem] text-indigo-800 whitespace-nowrap tracking-tight">
              NhaDat<span className="text-indigo-400">.City</span>
            </span>
          </Link>

          {/* Search — flex-1 fills remaining space */}
          <div className="flex-1 min-w-0">
            <MapSearchBox />
          </div>

          {/* Filter button */}
          <button
            className="flex items-center gap-1 cursor-pointer p-2 min-w-[40px] min-h-[40px] border-l border-slate-200 transition-colors hover:bg-slate-50 group bg-transparent border-t-0 border-b-0 border-r-0 shrink-0"
            onClick={() => setShowFilter(!showFilter)}
            aria-label="Bộ lọc"
            aria-expanded={showFilter}
          >
            {activeFilterCount > 0 && (
              <span className="bg-indigo-600 text-white text-[0.65rem] font-bold px-1.5 py-0.5 leading-tight rounded-full">{activeFilterCount}</span>
            )}
            <IconAdjustmentsHorizontal width="1.1em" height="1.1em" className="text-slate-500 group-hover:text-indigo-600" />
          </button>

          {/* User Menu */}
          <div className="relative flex items-center shrink-0">
            {session ? (
              <button
                className="cursor-pointer w-10 h-10 relative flex items-center justify-center bg-transparent border-none p-0"
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-label="Menu tài khoản"
              >
                {session.user?.image ? (
                  <img src={session.user.image} alt="Avatar" className="w-8 h-8 rounded-full object-cover border-2 border-indigo-200" />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[0.85rem] bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
                    {session.user?.name?.charAt(0) || 'U'}
                  </div>
                )}
                {showUserMenu && (
                  <div className="absolute top-[46px] right-0 bg-white min-w-[210px] border border-slate-200 shadow-xl z-50 flex flex-col rounded-xl overflow-hidden">
                    <div className="p-3 bg-gradient-to-br from-indigo-50 to-purple-50 flex flex-col gap-0.5 border-b border-slate-100">
                      <strong className="text-[0.9rem] text-slate-900">{session.user?.name}</strong>
                      <span className="text-[0.75rem] text-slate-500 truncate">{session.user?.email}</span>
                    </div>
                    <Link href="/profile" className="px-4 py-2.5 text-[0.9rem] text-slate-700 flex items-center gap-2 hover:bg-slate-50 transition-colors no-underline font-medium">
                      <IconUser size={16} className="text-slate-400" /> Hồ sơ cá nhân
                    </Link>
                    <Link href="/settings" className="px-4 py-2.5 text-[0.9rem] text-slate-700 flex items-center gap-2 hover:bg-slate-50 transition-colors no-underline font-medium">
                      <IconSettings size={16} className="text-slate-400" /> Cài đặt
                    </Link>
                    <div className="h-px bg-slate-100" />
                    <button onClick={() => signOut()} className="px-4 py-2.5 text-[0.9rem] flex items-center gap-2 transition-colors font-medium text-red-600 hover:bg-red-50 text-left w-full bg-transparent border-none cursor-pointer">
                      <IconLogout size={16} /> Đăng xuất
                    </button>
                  </div>
                )}
              </button>
            ) : (
              <Link href="/login" className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-3 py-1.5 rounded-full shadow-sm text-[0.8rem] font-semibold transition-all no-underline whitespace-nowrap">
                Đăng nhập
              </Link>
            )}
          </div>
        </header>
      </div>

      {/* ── Filter Panel ────────────────────────────────────────────────────── */}
      {showFilter && (
        <div className={`absolute top-[68px] z-[40] flex justify-center pointer-events-none left-0 w-full ${showSidebar ? 'md:pl-[360px]' : ''}`}>
          <div className="pointer-events-auto w-[96%] max-w-[640px]">
            <MapFilterPanel onClose={() => setShowFilter(false)} />
          </div>
        </div>
      )}

      {/* ── Backdrop overlay on mobile when sidebar is open ─────────────────── */}
      {showSidebar && (
        <div
          className="md:hidden absolute inset-0 z-[49] bg-black/30 backdrop-blur-[1px]"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* ── Left Sidebar — left drawer on both mobile + desktop ─────────────── */}
      {/* Mobile: 75vw | Desktop: 360px absolute within map container */}
      <div className={[
        'absolute z-[50] md:z-[30] top-0 left-0 h-full bg-white transition-transform duration-300 ease-out flex flex-col',
        'w-[75vw] md:w-[360px]',
        'shadow-[4px_0_24px_rgba(0,0,0,0.15)]',
        showSidebar ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}>

        {/* No drag handle needed — this is a side drawer */}
        {/* ── Sidebar Header with Logo ───────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-white shrink-0">
          {/* Logo band — shown on both mobile + desktop */}
          <div className="flex items-center justify-between px-4 py-3 md:px-5 md:py-4 bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-600">
            <Link href="/" className="flex items-center gap-2.5 no-underline group">
              {/* Icon mark */}
              <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center group-hover:bg-white/25 transition-colors">
                <IconMap2 size={20} className="text-white" />
              </div>
              <div>
                <div className="font-black text-white text-[1.05rem] leading-none tracking-tight">
                  NhaDat<span className="text-indigo-200">.City</span>
                </div>
                <div className="text-indigo-200 text-[0.65rem] font-medium leading-none mt-0.5 tracking-wide uppercase">
                  Bản đồ bất động sản
                </div>
              </div>
            </Link>
            <button
              onClick={() => setShowSidebar(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white cursor-pointer border-none"
              aria-label="Đóng"
            >
              <IconX size={16} />
            </button>
          </div>

          {/* Location title + breadcrumb */}
          <div className="flex flex-col px-4 py-2.5 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="m-0 text-[0.95rem] font-bold text-slate-800">
                {locationName ? `Nhà đất ${locationName}` : 'Tin Bất Động Sản'}
              </h3>
            </div>
            {breadcrumbs && breadcrumbs.length > 0 && (
              <div className="mt-0.5 -ml-3">
                <ListBreadcrumb breadcrumbs={breadcrumbs} locationName={locationName || ''} />
              </div>
            )}
          </div>
        </div>

        {/* Listing list */}
        <div className="flex-1 overflow-y-auto">
          {showSidebar && (
            <RealEstateListClient
              initialItems={[]}
              province={province || 'ha-noi'}
              ward={ward || ''}
              filters={filters}
            />
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-slate-100 px-4 py-2.5 shrink-0">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {[['/', 'Bản đồ'], ['/du-an', 'Dự án'], ['/blog', 'Cẩm nang & quy hoạch'], ['/thong-ke', 'Thống kê'], ['/about', 'Về chúng tôi'], ['/contact', 'Liên hệ']].map(([href, label]) => (
              <Link key={href} href={href} className="text-[0.7rem] text-slate-400 hover:text-indigo-600 no-underline transition-colors">{label}</Link>
            ))}
          </div>
          <div className="flex gap-3 mt-1">
            {[['/terms', 'Điều khoản'], ['/privacy', 'Bảo mật']].map(([href, label]) => (
              <Link key={href} href={href} className="text-[0.65rem] text-slate-500 hover:text-slate-700 no-underline transition-colors">{label}</Link>
            ))}
            <span className="text-[0.65rem] text-slate-400 ml-auto">© 2025 NhaDat.City</span>
          </div>
        </div>
      </div>

      {/* ── Map Controls (zoom, layers…) ────────────────────────────────────── */}
      <MapControlsDock />

      {/* ── Listing Detail Overlay ─────────────────────────────────────────── */}
      <ListingDetailOverlay />

      {/* ── User Profile Overlay ───────────────────────────────────────────── */}
      <UserProfileOverlay />
    </>
  );
}
