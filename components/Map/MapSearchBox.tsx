'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { IconSearch, IconMapPin, IconHome, IconX, IconLoader2 } from '@tabler/icons-react';
import { useMapContext } from './MapContext';
import { formatMoney, formatArea, getImageUrl, getRealEstateUrl } from '@/lib/utils/utils';

interface GeoSuggestion {
  type: 'geo';
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface ListingSuggestion {
  type: 'listing';
  _id: string;
  title: string;
  totalPrice?: number;
  area?: number;
  address?: string;
  images?: string[];
  coordinates?: [number, number];
  adminunit?: any;
}

type Suggestion = GeoSuggestion | ListingSuggestion;

function getShortGeoName(display: string) {
  return display.split(', ').slice(0, 3).join(', ');
}

export default function MapSearchBox() {
  const { map, setSelectedListingId } = useMapContext();
  const [query, setQuery] = useState('');
  const [geoResults, setGeoResults] = useState<GeoSuggestion[]>([]);
  const [listingResults, setListingResults] = useState<ListingSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const allSuggestions: Suggestion[] = [
    ...listingResults,
    ...geoResults,
  ];

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setGeoResults([]);
      setListingResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const [geoRes, listingRes] = await Promise.allSettled([
        fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=vn&format=json&limit=4&addressdetails=1`, {
          headers: { 'Accept-Language': 'vi' },
        }).then(r => r.json()),
        fetch(`/api/real-estate/search?q=${encodeURIComponent(q)}&limit=5`).then(r => r.json()),
      ]);

      const geo: GeoSuggestion[] = (geoRes.status === 'fulfilled' ? geoRes.value : []).map((s: any) => ({ ...s, type: 'geo' as const }));
      const listings: ListingSuggestion[] = (listingRes.status === 'fulfilled' && listingRes.value.success ? listingRes.value.data : []).map((l: any) => ({ ...l, type: 'listing' as const }));

      setGeoResults(geo);
      setListingResults(listings);
      setOpen(geo.length > 0 || listings.length > 0);
      setActiveIdx(-1);
    } catch {
      setGeoResults([]);
      setListingResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectGeo = useCallback((s: GeoSuggestion) => {
    if (!map) return;
    map.flyTo({ center: [parseFloat(s.lon), parseFloat(s.lat)], zoom: 14, essential: true });
    setQuery(getShortGeoName(s.display_name));
    setGeoResults([]);
    setListingResults([]);
    setOpen(false);
    inputRef.current?.blur();
  }, [map]);

  const selectListing = useCallback((l: ListingSuggestion) => {
    const url = getRealEstateUrl(l);
    const prevUrl = typeof window !== 'undefined' ? window.location.pathname : '/';
    window.history.pushState({ prevUrl, listingId: l._id }, '', url);
    setSelectedListingId(l._id);
    if (map && l.coordinates) {
      map.flyTo({ center: l.coordinates, zoom: 16, essential: true });
    }
    setQuery(l.title);
    setGeoResults([]);
    setListingResults([]);
    setOpen(false);
    inputRef.current?.blur();
  }, [map, setSelectedListingId]);

  const selectSuggestion = useCallback((s: Suggestion) => {
    if (s.type === 'geo') selectGeo(s);
    else selectListing(s);
  }, [selectGeo, selectListing]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || allSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, allSuggestions.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      const target = activeIdx >= 0 ? allSuggestions[activeIdx] : allSuggestions[0];
      if (target) selectSuggestion(target);
    }
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
  };

  const hasResults = allSuggestions.length > 0;

  return (
    <div className="flex-1 relative" ref={containerRef}>
      <div className="flex items-center gap-2">
        {loading
          ? <IconLoader2 width="1.1em" height="1.1em" className="text-slate-400 animate-spin shrink-0" />
          : <IconSearch width="1.1em" height="1.1em" className="text-slate-400 shrink-0" />
        }
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); if (!e.target.value) { setGeoResults([]); setListingResults([]); setOpen(false); } }}
          onFocus={() => { if (hasResults) setOpen(true); }}
          onKeyDown={handleKeyDown}
          className="flex-1 border-none bg-transparent outline-none text-slate-900 text-[0.88rem] w-full placeholder-slate-400"
          placeholder="Tìm tin đăng, địa điểm..."
          autoComplete="off"
        />
        {query && (
          <button
            className="p-0.5 rounded-full text-slate-400 hover:text-slate-700 transition-colors bg-transparent border-none cursor-pointer shrink-0"
            onClick={() => { setQuery(''); setGeoResults([]); setListingResults([]); setOpen(false); inputRef.current?.focus(); }}
          >
            <IconX width="0.9em" height="0.9em" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && hasResults && (
        <div className="absolute top-[calc(100%+10px)] left-0 right-0 bg-white border border-slate-200 shadow-[0_8px_24px_rgba(0,0,0,0.1)] z-50 overflow-hidden rounded-sm max-h-[420px] overflow-y-auto [scrollbar-width:thin]">
          {/* Listing results */}
          {listingResults.length > 0 && (
            <>
              <div className="px-3.5 py-1.5 text-[0.72rem] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50">
                Tin đăng bất động sản
              </div>
              {listingResults.map((l, i) => {
                const isActive = i === activeIdx;
                const img = l.images?.[0] ? getImageUrl(l.images[0], l._id, 80, 60) : null;
                return (
                  <button
                    key={l._id}
                    className={`w-full text-left px-3.5 py-2 flex items-center gap-2.5 border-none cursor-pointer transition-colors ${isActive ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50'}`}
                    onMouseDown={e => { e.preventDefault(); selectListing(l); }}
                    onMouseEnter={() => setActiveIdx(i)}
                  >
                    {img ? (
                      <img src={img} alt="" className="w-10 h-8 object-cover rounded-sm shrink-0 bg-slate-100" />
                    ) : (
                      <div className="w-10 h-8 rounded-sm bg-slate-100 flex items-center justify-center shrink-0">
                        <IconHome width="1em" height="1em" className="text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[0.83rem] font-semibold leading-tight line-clamp-1 m-0 ${isActive ? 'text-indigo-800' : 'text-slate-800'}`}>{l.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {l.totalPrice ? <span className="text-[0.75rem] font-bold text-red-600">{formatMoney(l.totalPrice)}</span> : null}
                        {l.area ? <span className="text-[0.72rem] text-slate-500">{formatArea(l.area)}</span> : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {/* Geo results */}
          {geoResults.length > 0 && (
            <>
              <div className="px-3.5 py-1.5 text-[0.72rem] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50">
                Địa điểm
              </div>
              {geoResults.map((s, i) => {
                const idx = listingResults.length + i;
                const isActive = idx === activeIdx;
                return (
                  <button
                    key={s.place_id}
                    className={`w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 border-none cursor-pointer transition-colors text-[0.85rem] ${isActive ? 'bg-indigo-50 text-indigo-800' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                    onMouseDown={e => { e.preventDefault(); selectGeo(s); }}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <IconMapPin width="1em" height="1em" className={`mt-[2px] shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="leading-snug line-clamp-2">{getShortGeoName(s.display_name)}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
