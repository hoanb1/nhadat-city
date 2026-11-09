'use client';

import { useState, useCallback, useEffect } from 'react';
import { getImageUrl } from '@/lib/utils/utils';
import Image from 'next/image';
import { IconPhotoOff, IconZoomIn, IconGridDots, IconX } from '@tabler/icons-react';

interface Props {
  images: string[];
  listingId: string;
  title: string;
}

export default function ImageGallery({ images, listingId, title }: Props) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  const prev = useCallback(() => setActive(i => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setActive(i => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'Escape') setLightbox(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox, prev, next]);

  if (!images?.length) return (
    <div className="flex items-center gap-2 p-10 bg-slate-100 text-slate-400 justify-center text-[0.9rem] rounded-xl"><IconPhotoOff width="1.5em" height="1.5em" /> Chưa có hình ảnh</div>
  );

  return (
    <>
      {/* Mobile Slider View (Visible only on lg down) */}
      <div className="flex flex-col gap-1 lg:hidden">
        <div className="relative aspect-video overflow-hidden bg-slate-200 cursor-zoom-in group" onClick={() => setLightbox(true)}>
          <Image unoptimized src={getImageUrl(images[active], listingId, 800, 500)} alt={title} fill priority sizes="100vw" className="object-cover" />
          <span className="absolute bottom-3 right-3 bg-black/60 text-white text-[11px] font-semibold py-1 px-2.5 rounded-full backdrop-blur-sm">{active + 1} / {images.length}</span>
          {images.length > 1 && (
            <>
              <button className="absolute top-1/2 -translate-y-1/2 bg-black/45 text-white border-none w-9 h-9 rounded-full text-[22px] flex items-center justify-center left-2.5" onClick={e => { e.stopPropagation(); prev(); }}>‹</button>
              <button className="absolute top-1/2 -translate-y-1/2 bg-black/45 text-white border-none w-9 h-9 rounded-full text-[22px] flex items-center justify-center right-2.5" onClick={e => { e.stopPropagation(); next(); }}>›</button>
            </>
          )}
        </div>
        {images.length > 1 && (
          <div className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:thin] px-1">
            {images.slice(0, 8).map((img, i) => (
              <div key={i} className={`shrink-0 w-[72px] h-[54px] rounded-md overflow-hidden cursor-pointer relative border-2 transition-colors duration-150 ${i === active ? 'border-indigo-600' : 'border-transparent'}`} onClick={() => setActive(i)}>
                <Image unoptimized className="object-cover" src={getImageUrl(img, listingId, 160, 120)} alt="" fill sizes="72px" />
                {i === 7 && images.length > 8 && (
                  <div className="absolute inset-0 bg-black/60 text-white text-[12px] font-bold flex items-center justify-center">+{images.length - 8}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop Masonry Grid View (Visible only on lg up) */}
      <div className="hidden lg:grid grid-cols-4 grid-rows-2 gap-2 h-[450px] rounded-xl overflow-hidden relative group">
        {/* Large left image */}
        <div className="col-span-2 row-span-2 relative cursor-pointer overflow-hidden" onClick={() => { setActive(0); setLightbox(true); }}>
          <Image unoptimized src={getImageUrl(images[0], listingId, 1200, 800)} alt={title} fill priority sizes="50vw" className="object-cover transition-transform duration-500 hover:scale-105" />
          <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors duration-300" />
        </div>
        
        {/* Right images grid */}
        {images.slice(1, 5).map((img, idx) => (
          <div key={idx} className="relative cursor-pointer overflow-hidden" onClick={() => { setActive(idx + 1); setLightbox(true); }}>
            <Image unoptimized src={getImageUrl(img, listingId, 600, 400)} alt="" fill sizes="25vw" className="object-cover transition-transform duration-500 hover:scale-105" />
            <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors duration-300" />
          </div>
        ))}
        
        {/* View all photos button */}
        {images.length > 0 && (
          <button 
            className="absolute bottom-4 right-4 bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 px-4 py-2 rounded-lg font-semibold text-[13px] shadow-sm flex items-center gap-2 transition-all"
            onClick={() => { setActive(0); setLightbox(true); }}
          >
            <IconGridDots size={16} /> Hiển thị tất cả ảnh
          </button>
        )}
      </div>

      {/* Lightbox Overlay */}
      {lightbox && (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center backdrop-blur-md" onClick={() => setLightbox(false)}>
          <button className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 border border-white/20 text-white cursor-pointer z-10 w-10 h-10 flex items-center justify-center rounded-full transition-colors duration-200" onClick={() => setLightbox(false)} aria-label="Đóng"><IconX size={20} /></button>
          
          <button className="fixed top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/25 border-none text-white w-14 h-14 rounded-full text-[32px] flex items-center justify-center transition-colors duration-200 z-10 left-6" onClick={e => { e.stopPropagation(); prev(); }}>‹</button>
          
          <div className="relative w-[85vw] h-[80vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <Image unoptimized src={getImageUrl(images[active], listingId, 1600, 1000)} alt={title} fill className="object-contain" sizes="85vw" priority />
          </div>
          
          <button className="fixed top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/25 border-none text-white w-14 h-14 rounded-full text-[32px] flex items-center justify-center transition-colors duration-200 z-10 right-6" onClick={e => { e.stopPropagation(); next(); }}>›</button>
          
          <div className="absolute bottom-24 text-white/90 text-[14px] font-medium tracking-wide bg-black/50 px-4 py-1.5 rounded-full">{active + 1} / {images.length}</div>
          
          <div className="absolute bottom-5 flex gap-2 max-w-[85vw] overflow-x-auto p-2 [scrollbar-width:none]">
            {images.map((img, i) => (
              <div key={i} className={`shrink-0 w-[70px] h-[50px] rounded-lg overflow-hidden cursor-pointer relative border-[2.5px] transition-all duration-200 ${i === active ? 'border-white opacity-100 scale-110' : 'border-transparent opacity-50 hover:opacity-80'}`} onClick={e => { e.stopPropagation(); setActive(i); }}>
                <Image unoptimized className="object-cover" src={getImageUrl(img, listingId, 140, 100)} alt="" fill sizes="70px" />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
