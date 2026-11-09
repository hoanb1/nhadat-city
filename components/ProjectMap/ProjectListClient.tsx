'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ListSkeleton } from '@/components/Skeleton/ListSkeleton';
import { useMapContext } from '@/components/Map/MapContext';
import { getProjectUrl, getImageUrl, formatMoney, formatArea } from '@/lib/utils/utils';
import { IconHomeOff, IconMapPin, IconMap2 } from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';

interface ProjectItemCardProps {
  item: any;
  priority?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onLocationClick?: (e: React.MouseEvent) => void;
  onClick?: (item: any) => void;
}

export function ProjectListItemCard({
  item,
  priority = false,
  onMouseEnter,
  onMouseLeave,
  onLocationClick,
  onClick
}: ProjectItemCardProps) {
  const imageUrl = getImageUrl(item.images?.[0], item._id, 400, 280);
  const price = item.price > 0 ? formatMoney(item.price) : 'Thỏa thuận';
  const area = item.totalArea || (item.area ? formatArea(item.area) : '');
  const projectLink = getProjectUrl(item);

  const getStatusBadge = (status: any) => {
    const s = String(status).toLowerCase();
    if (s === '3' || s === 'handedover' || s === 'đã bàn giao') {
      return (
        <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[0.7rem] font-bold px-2 py-0.5 rounded-[4px]">
          Đã bàn giao
        </span>
      );
    }
    if (s === '2' || s === 'onsale' || s === 'đang mở bán') {
      return (
        <span className="bg-blue-50 text-blue-700 border border-blue-100 text-[0.7rem] font-bold px-2 py-0.5 rounded-[4px]">
          Đang mở bán
        </span>
      );
    }
    if (s === '1' || s === 'upcoming' || s === 'sắp mở bán') {
      return (
        <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[0.7rem] font-bold px-2 py-0.5 rounded-[4px]">
          Sắp mở bán
        </span>
      );
    }
    return (
      <span className="bg-slate-50 text-slate-600 border border-slate-100 text-[0.7rem] font-bold px-2 py-0.5 rounded-[4px]">
        Dự án
      </span>
    );
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onClick) onClick(item);
  };

  return (
    <article
      className="group relative flex flex-col bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={handleClick}
    >
      <Link href={projectLink} className="absolute inset-0 z-0 opacity-0 pointer-events-none" aria-label={item.title}>
        {item.title}
      </Link>

      {imageUrl ? (
        <div className="relative w-full h-[190px] shrink-0 bg-slate-100 z-10 border-b border-slate-100">
          <Image
            unoptimized
            src={imageUrl}
            alt={item.title}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            priority={priority}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.srcset = '';
              img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            }}
          />
          {item.images && item.images.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-[0.7rem] font-bold px-2 py-0.5 rounded-[4px] backdrop-blur-sm">
              {item.images.length} ảnh
            </div>
          )}
        </div>
      ) : (
        <div className="relative w-full h-[190px] shrink-0 bg-slate-100 flex items-center justify-center text-slate-400 font-semibold text-[0.85rem] z-10 border-b border-slate-100">
          Không có ảnh
        </div>
      )}

      <div className="flex flex-col p-3.5 z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {getStatusBadge(item.status)}
            {area && (
              <span className="text-[0.75rem] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-[4px]">
                {area}
              </span>
            )}
          </div>
          <span className="font-extrabold text-amber-600 text-[1rem]">
            {price}
          </span>
        </div>

        <h3 className="m-0 text-[0.95rem] font-bold text-slate-800 leading-[1.4] line-clamp-2 transition-colors group-hover:text-indigo-700" title={item.title}>
          {item.title}
        </h3>

        <div className="mt-3.5 flex items-center justify-between text-[0.78rem] text-slate-500 gap-2 border-t border-slate-50 pt-2.5">
          {item.address ? (
            <div
              className="flex items-center gap-1.5 flex-1 min-w-0 group/loc cursor-pointer hover:text-indigo-600 transition-colors py-1 -my-1 rounded"
              onClick={(e) => {
                e.stopPropagation();
                if (onLocationClick) onLocationClick(e);
              }}
              title="Xem vị trí trên bản đồ"
            >
              <span className="truncate max-w-[85%] flex items-center">
                <IconMapPin width="1.2em" height="1.2em" className="mr-1 text-slate-400 shrink-0 group-hover/loc:text-indigo-500" />
                {item.address.split(',').slice(-2).join(', ')}
              </span>
              <div className="bg-slate-50 text-slate-400 border border-slate-100 w-6 h-6 rounded-sm flex items-center justify-center transition-colors group-hover/loc:bg-indigo-50 group-hover/loc:text-indigo-600 group-hover/loc:border-indigo-200 shrink-0">
                <IconMap2 width="1.1em" height="1.1em" />
              </div>
            </div>
          ) : (
            <div className="flex-1" />
          )}
        </div>
      </div>
    </article>
  );
}

interface Props {
  initialItems: any[];
  province: string;
  ward?: string;
  filters: Record<string, any>;
}

export function ProjectListClient({ initialItems, province, ward, filters }: Props) {
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialItems.length >= 30);
  
  let mapContext: any;
  try {
    mapContext = useMapContext();
  } catch (e) {}

  const { 
    listings: contextListings, 
    setHighlightedListingId,
    setHighlightedListingCoords,
    setSelectedListingId,
    setSelectedListing,
    map,
    page,
    setPage
  } = mapContext || {};

  // Sync with contextListings
  useEffect(() => {
    if (contextListings) {
      if (page === 1) {
        setItems(contextListings);
      } else {
        setItems(prev => {
          const combined = [...prev, ...contextListings];
          // Simple deduplication
          const seen = new Set();
          return combined.filter(it => {
            if (seen.has(it._id)) return false;
            seen.add(it._id);
            return true;
          });
        });
      }
      setHasMore(contextListings.length >= 30);
    }
  }, [contextListings, page]);

  const loadingRef = useRef(false);

  const handleLocationClick = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!map || !item.coordinates) return;
    
    setHighlightedListingId?.(item._id);
    setHighlightedListingCoords?.(item.coordinates);

    // Pan to the location without changing zoom to prevent drastic list re-fetches
    map.panTo(item.coordinates, { 
      duration: 1000,
      essential: true 
    });
  };

  const handleCardClick = (item: any) => {
    const url = getProjectUrl(item);
    const prevUrl = typeof window !== 'undefined' ? window.location.pathname : '/';
    window.history.pushState({ prevUrl, listingId: item._id }, '', url);
    // Only set ID — overlay will fetch full data from API
    setSelectedListingId?.(item._id);
  };

  const lastItemRef = useCallback(
    (node: HTMLElement | null) => {
      if (!node || loading || !hasMore || loadingRef.current) return;

      const observer = new IntersectionObserver(
        async (entries) => {
          if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
            if (mapContext) {
              setPage(page + 1);
            } else {
              // Standard non-map pagination
              loadingRef.current = true;
              setLoading(true);
              try {
                const params = new URLSearchParams();
                params.append('province', province);
                if (ward) params.append('ward', ward);
                params.append('limit', '30');
                params.append('offset', String(items.length));

                const res = await fetch(`/api/projects?${params}`);
                const json = await res.json();
                if (json.success && json.data.length > 0) {
                  setItems((prev) => [...prev, ...json.data]);
                  setHasMore(json.data.length >= 30);
                } else {
                  setHasMore(false);
                }
              } catch {
                setHasMore(false);
              } finally {
                setLoading(false);
                loadingRef.current = false;
              }
            }
          }
        },
        { rootMargin: '400px' }
      );

      observer.observe(node);
      return () => observer.disconnect();
    },
    [loading, hasMore, items.length, province, ward, mapContext, page, setPage]
  );

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white sticky top-0 z-10 shadow-sm">
        <span className="text-[0.85rem] text-slate-500 font-medium">{items.length} dự án</span>
      </div>

      <ul className="space-y-4 p-4 m-0 list-none bg-slate-50" role="list">
        {items.map((item, index) => (
          <li
            key={item._id}
            ref={index === items.length - 1 ? (lastItemRef as any) : null}
          >
            <ProjectListItemCard 
              item={item} 
              priority={index < 3}
              onMouseEnter={() => {
                setHighlightedListingId?.(item._id);
                setHighlightedListingCoords?.(item.coordinates);
              }}
              onMouseLeave={() => {
                setHighlightedListingId?.(null);
                setHighlightedListingCoords?.(null);
              }}
              onClick={handleCardClick}
              onLocationClick={(e) => handleLocationClick(item, e)}
            />
          </li>
        ))}
      </ul>

      {loading && <div className="p-3"><ListSkeleton count={3} /></div>}

      {!hasMore && items.length > 0 && (
        <p className="text-center p-6 text-slate-400 text-[0.85rem] m-0 border-t border-slate-100">Đã hiển thị tất cả {items.length} dự án</p>
      )}

      {items.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center text-center p-12 text-slate-400 h-[50vh]">
          <IconHomeOff width="1em" height="1em" aria-hidden="true" className="text-[3rem] mb-3 text-slate-300" />
          <p className="m-0 text-[0.95rem]">Chưa có dự án nào trong khu vực này.</p>
        </div>
      )}
    </div>
  );
}
