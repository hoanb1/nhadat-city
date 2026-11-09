'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { RealEstateCard } from '@/components/RealEstateCard';
import { ListSkeleton } from '@/components/Skeleton/ListSkeleton';
import { useMapContext } from '@/components/Map/MapContext';
import { getRealEstateUrl } from '@/lib/utils/utils';
import { IconHomeOff } from '@tabler/icons-react';

interface Props {
  initialItems: any[];
  province: string;
  ward?: string;
  filters: Record<string, any>;
}

export function RealEstateListClient({ initialItems, province, ward, filters }: Props) {
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
    const url = getRealEstateUrl(item);
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

                const res = await fetch(`/api/real-estate?${params}`);
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
        <span className="text-[0.85rem] text-slate-500 font-medium">{items.length} tin đăng</span>
      </div>

      <ul className="space-y-4 p-4 m-0 list-none bg-slate-50" role="list">
        {items.map((item, index) => (
          <li
            key={item._id}
            ref={index === items.length - 1 ? (lastItemRef as any) : null}
          >
            <RealEstateCard 
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
        <p className="text-center p-6 text-slate-400 text-[0.85rem] m-0 border-t border-slate-100">Đã hiển thị tất cả {items.length} tin đăng</p>
      )}

      {items.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center text-center p-12 text-slate-400 h-[50vh]">
          <IconHomeOff width="1em" height="1em" aria-hidden="true" className="text-[3rem] mb-3 text-slate-300" />
          <p className="m-0 text-[0.95rem]">Chưa có tin đăng nào trong khu vực này.</p>
        </div>
      )}
    </div>
  );
}
