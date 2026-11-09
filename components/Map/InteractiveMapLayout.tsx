'use client';

import React, { useEffect, useRef } from 'react';
import { useMapContext } from './MapContext';
import MainMapClientDynamic from './MainMapClientDynamic';
import MapOverlayUI from './MapOverlayUI';
import { IconChevronDown, IconMapPin, IconMaximize, IconMinimize, IconMap } from '@tabler/icons-react';

interface InteractiveMapLayoutProps {
  listingCount?: number;
  locationName?: string;
  mapElement?: React.ReactNode;
  children: React.ReactNode;
}

export default function InteractiveMapLayout({
  listingCount = 0,
  locationName = '',
  mapElement,
  children
}: InteractiveMapLayoutProps) {
  const { map, isMapFullscreen, setIsMapFullscreen } = useMapContext();
  const seoSectionRef = useRef<HTMLDivElement>(null);

  // Resize map when fullscreen toggle changes
  useEffect(() => {
    if (map) {
      setTimeout(() => {
        try {
          map.resize();
        } catch (err) {
          console.warn('[InteractiveMapLayout Warning]: Failed to resize map', err);
        }
      }, 300);
    }
  }, [isMapFullscreen, map]);

  const scrollToSeoContent = () => {
    if (seoSectionRef.current) {
      seoSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="w-full flex flex-col relative bg-slate-950">
      {/* ── Top Map Container (65vh by default so web content below is visible; 100dvh when fullscreen) ── */}
      <div 
        className={`w-full relative flex flex-col border-b border-slate-800 transition-[height] duration-300 ease-in-out ${
          isMapFullscreen ? 'h-[100dvh]' : 'h-[65vh] min-h-[480px]'
        }`}
      >
        {mapElement ? (
          mapElement
        ) : (
          <div className="w-full h-full relative flex flex-col">
            <div className="absolute inset-0 z-0 bg-slate-50">
              <MainMapClientDynamic />
            </div>
            <MapOverlayUI />
          </div>
        )}

        {/* Floating Pill: Indicator to scroll down to full webpage content */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          <button
            onClick={scrollToSeoContent}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900/90 hover:bg-slate-900 text-white backdrop-blur-md border border-slate-700/80 shadow-2xl rounded-full text-xs font-bold cursor-pointer transition-all hover:scale-105 group"
            title="Cuộn xuống để xem toàn bộ nội dung bài viết và danh sách tin đăng"
          >
            <IconMapPin size={15} className="text-emerald-400 group-hover:scale-110 transition-transform" />
            <span>Xem bài viết & tin đăng {locationName}</span>
            <IconChevronDown size={15} className="text-emerald-400 animate-bounce" />
          </button>

          <button
            onClick={() => setIsMapFullscreen(prev => !prev)}
            className="p-2.5 bg-slate-900/90 hover:bg-slate-900 text-slate-200 hover:text-white backdrop-blur-md border border-slate-700/80 shadow-2xl rounded-full text-xs cursor-pointer transition-all hidden sm:flex items-center justify-center"
            title={isMapFullscreen ? 'Thu nhỏ bản đồ' : 'Toàn màn hình bản đồ'}
          >
            {isMapFullscreen ? <IconMinimize size={15} /> : <IconMaximize size={15} />}
          </button>
        </div>
      </div>

      {/* ── SSR SEO Content & Listings Section ── */}
      <div ref={seoSectionRef} id="seo-content-section" className="w-full relative">
        {children}

        {/* Back to top map button at the bottom */}
        <div className="w-full flex justify-center py-6 border-t border-slate-900 bg-slate-950">
          <button
            onClick={scrollToTop}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-emerald-600 border border-slate-800 hover:border-emerald-500 text-slate-300 hover:text-white rounded-full text-xs font-semibold cursor-pointer transition-all shadow-md"
          >
            <IconMap size={15} />
            <span>Quay lại xem bản đồ quy hoạch</span>
          </button>
        </div>
      </div>
    </div>
  );
}
