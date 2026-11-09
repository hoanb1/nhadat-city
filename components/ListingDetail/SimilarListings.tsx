'use client';

import { useState, useEffect, useRef } from 'react';
import { formatMoney, formatArea, getImageUrl, getRealEstateUrl, makeUrlSlug } from '@/lib/utils/utils';

interface Props {
  listingId: string;
  initialItems?: any[];
}

const TAG_LABELS: Record<string, string> = {
  same_seller: 'Cùng người đăng',
  same_area: 'Cùng khu vực',
  similar_price: 'Giá tương tự',
};

import Link from 'next/link';
import Image from 'next/image';
import { IconRuler2, IconBuildingEstate } from '@tabler/icons-react';

function MiniCard({ item }: { item: any }) {
  const img = item.images?.[0]
    ? getImageUrl(item.images[0], item._id, 320, 220)
    : '/placeholder.jpg';
  const url = getRealEstateUrl(item);

  return (
    <Link 
      href={url} 
      className="shrink-0 w-[200px] cursor-pointer rounded-sm overflow-hidden bg-white border border-slate-200 transition-all duration-200 hover:border-indigo-300 hover:shadow-[0_4px_20px_rgba(79,70,229,0.12)] hover:-translate-y-[2px]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-200">
        <Image unoptimized src={img} alt={item.title} fill sizes="200px" className="object-cover" />
        {item._similarTag && (
          <span className="absolute top-1.5 left-1.5 bg-indigo-600/90 text-white text-[10px] font-bold py-0.5 px-[7px] rounded-sm">{TAG_LABELS[item._similarTag] || ''}</span>
        )}
      </div>
      <div className="p-2.5 px-3">
        <p className="text-[0.78rem] font-semibold text-slate-800 leading-[1.35] m-0 mb-1.5 line-clamp-2">{item.title}</p>
        <div className="text-[0.9rem] font-extrabold text-red-600 mb-1">{formatMoney(item.totalPrice || item.price)}</div>
        {item.area && (
          <div className="text-[0.72rem] text-slate-500 flex items-center gap-1">
            <IconRuler2 width="1em" height="1em"  />{formatArea(item.area)}
            {item.pricePerM2 ? <> · {formatMoney(item.pricePerM2)}/m²</> : null}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function SimilarListings({ listingId, initialItems = [] }: Props) {
  const [items, setItems] = useState<any[]>(initialItems);
  const [loading, setLoading] = useState(initialItems.length === 0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialItems.length > 0) return;
    if (!listingId) return;
    fetch(`/api/real-estate/${listingId}/similar?limit=12`)
      .then(r => r.json())
      .then(j => { if (j.success) setItems(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [listingId, initialItems.length]);

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 216, behavior: 'smooth' });
  };

  if (!loading && items.length === 0) return null;

  return (
    <section className="pt-5 px-5 pb-0 border-t border-slate-100">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-[0.95rem] font-bold text-slate-800 m-0 flex items-center gap-1.5">
          <IconBuildingEstate width="1em" height="1em"  /> Bất động sản tương tự
        </h3>
        <div className="flex gap-1.5">
          <button onClick={() => scroll(-1)} className="w-7.5 h-7.5 rounded-sm border-[1.5px] border-slate-200 bg-white text-[18px] cursor-pointer flex items-center justify-center text-slate-600 transition-all duration-200 hover:border-indigo-600 hover:text-indigo-600">‹</button>
          <button onClick={() => scroll(1)} className="w-7.5 h-7.5 rounded-sm border-[1.5px] border-slate-200 bg-white text-[18px] cursor-pointer flex items-center justify-center text-slate-600 transition-all duration-200 hover:border-indigo-600 hover:text-indigo-600">›</button>
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory [scrollbar-width:thin]" ref={scrollRef}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[200px] h-[220px] rounded-sm bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-shimmer" />
            ))
          : items.map(item => (
              <MiniCard
                key={item._id}
                item={item}
              />
            ))}
      </div>
    </section>
  );
}
