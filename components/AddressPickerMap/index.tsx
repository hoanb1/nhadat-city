'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MAP_API_URL, DEFAULT_PARCEL_LAYER_ID } from '@/lib/map/mapLayerUtils';
import { Search, MapPin, FileText } from 'lucide-react';

const NOMINATIM = process.env.NEXT_PUBLIC_NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
const MAP_STYLE = MAP_API_URL;

export interface ParcelData {
  soTo: number | null;
  soThua: number | null;
  dienTich: number | null;
  loaiDat: string | null;
  loaiDatName: string | null;
  geometry?: any;
}

// Helper: Haversine distance in meters
function getDistance(lng1: number, lat1: number, lng2: number, lat2: number) {
  const R = 6371e3;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper: Build GeoJSON LineStrings for parcel edges with length text
function buildEdgeFeatures(geometry: any) {
  const edges: any[] = [];
  const processRing = (ring: number[][]) => {
    for (let i = 0; i < ring.length - 1; i++) {
      const p1 = ring[i];
      const p2 = ring[i + 1];
      const dist = getDistance(p1[0], p1[1], p2[0], p2[1]);
      edges.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [p1, p2] },
        properties: { length: dist.toFixed(1) + ' m' }
      });
    }
  };
  
  if (geometry?.type === 'Polygon') {
    geometry.coordinates.forEach(processRing);
  } else if (geometry?.type === 'MultiPolygon') {
    geometry.coordinates.forEach((poly: any) => poly.forEach(processRing));
  }
  return { type: 'FeatureCollection', features: edges };
}


export interface AddressResult {
  address: string;
  province: string;
  district: string;
  ward: string;
  provinceName: string;
  districtName: string;
  wardName: string;
  lng: number;
  lat: number;
  parcel?: ParcelData | null;
}

interface Props {
  value?: AddressResult | null;
  onChange: (result: AddressResult) => void;
}

function toSlug(s: string) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const LOAI_DAT_COLOR: Record<string, string> = {
  ODT: '#2563eb', ONT: '#2563eb',
  RSX: '#16a34a', RPH: '#16a34a', RDD: '#16a34a',
  LUC: '#84cc16', LUA: '#84cc16', CLN: '#84cc16',
  TMD: '#f59e0b', SKK: '#f59e0b',
};

export default function AddressPickerMap({ value, onChange }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [query, setQuery] = useState(value?.address || '');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [parcelLoading, setParcelLoading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize map
  useEffect(() => {
    let ml: any;
    let isCancelled = false;

    const initMap = async () => {
      // Ensure token is fetched
      if (!(window as any).__mapToken) {
        try {
          const res = await fetch('/api/map-token');
          if (res.ok) {
            const { token } = await res.json();
            (window as any).__mapToken = token;
          }
        } catch {}
      }

      if (isCancelled) return;

      const maplibreGl = await import('maplibre-gl');
      if (isCancelled || !mapContainerRef.current || mapRef.current) return;

      ml = new maplibreGl.Map({
        container: mapContainerRef.current,
        style: `${MAP_STYLE}/style.json`,
        center: [value?.lng ?? 105.8342, value?.lat ?? 21.0278],
        zoom: value ? 15 : 12,
        maxZoom: 22,
        attributionControl: false,
        transformRequest: (url: string) => {
          let targetUrl = url;
          if (url.startsWith('/')) {
            const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nhadat.city';
            targetUrl = `${origin}${url}`;
          }
          if (targetUrl.includes('/map-api')) {
            const token = (window as any).__mapToken || '';
            if (token) {
              return {
                url: targetUrl,
                headers: { 'Authorization': `Bearer ${token}` },
              };
            }
          }
          return { url: targetUrl };
        },
      });

      ml.addControl(new maplibreGl.NavigationControl({ showCompass: false }), 'top-right');

      ml.on('load', () => {
        if (isCancelled) return;
        setMapLoaded(true);
        if (value?.lng && value?.lat) {
          const m = new maplibreGl.Marker({ color: '#ef4444' })
            .setLngLat([value.lng, value.lat])
            .addTo(ml);
          markerRef.current = m;
        }

        const parcelLayer = DEFAULT_PARCEL_LAYER_ID;

        // Add cadastral Raster layer
        ml.addSource('parcel-wms', {
          type: 'raster',
          tiles: [
            `${MAP_STYLE}/${parcelLayer}/{z}/{x}/{y}.png`
          ],
          tileSize: 256,
          maxzoom: 22,
          bounds: [102.144494, 8.34309, 109.524792, 23.39345], // Vietnam bounds
        });
        ml.addLayer({
          id: 'parcel-wms-layer',
          type: 'raster',
          source: 'parcel-wms',
          minzoom: 14,
          paint: {
            'raster-opacity': 0.40
          }
        });

        // Add highlight layers
        ml.addSource('parcel-highlight', { 
          type: 'geojson', 
          data: { type: 'FeatureCollection', features: [] },
          maxzoom: 24,
          tolerance: 0
        });
        ml.addLayer({
          id: 'parcel-highlight-fill',
          type: 'fill',
          source: 'parcel-highlight',
          paint: { 'fill-color': '#0ea5e9', 'fill-opacity': 0.5 }
        });
        ml.addLayer({
          id: 'parcel-highlight-line',
          type: 'line',
          source: 'parcel-highlight',
          paint: { 'line-color': '#0284c7', 'line-width': 2 }
        });

        // Add edge length layers
        ml.addSource('parcel-edges', { 
          type: 'geojson', 
          data: { type: 'FeatureCollection', features: [] },
          maxzoom: 24,
          tolerance: 0
        });
        ml.addLayer({
          id: 'parcel-edge-labels',
          type: 'symbol',
          source: 'parcel-edges',
          layout: {
            'symbol-placement': 'line',
            'text-field': ['get', 'length'],
            'text-size': 12,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: {
            'text-color': '#0f172a',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2
          }
        });
      });

      // Click map → place marker + reverse geocode + parcel info
      ml.on('click', async (e: any) => {
        const { lng, lat } = e.lngLat;
        placeMarker(ml, maplibreGl, lng, lat);
        await reverseGeocodeWithParcel(lng, lat);
      });

      mapRef.current = ml;
    };

    initMap();

    return () => {
      isCancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const placeMarker = (map: any, mgl: any, lng: number, lat: number) => {
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = new mgl.Marker({ color: '#ef4444' })
      .setLngLat([lng, lat])
      .addTo(map);
    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15), duration: 500 });
  };

  const parseNominatim = (data: any, lng: number, lat: number) => {
    const a = data.address || {};
    const provinceName = a.city || a.province || a.state || 'Hà Nội';
    const province = toSlug(provinceName.replace(/^(thành phố|tỉnh)\s*/i, ''));
    const districtName = a.suburb || a.city_district || a.district || a.town || '';
    const district = toSlug(districtName.replace(/^(quận|huyện|thị xã)\s*/i, ''));
    const wardName = a.quarter || a.neighbourhood || a.village || a.hamlet || '';
    const ward = toSlug(wardName.replace(/^(phường|xã|thị trấn)\s*/i, ''));
    const parts = [
      a.house_number && a.road ? `${a.house_number} ${a.road}` : a.road || '',
      wardName, districtName, provinceName,
    ].filter(Boolean);
    return { address: parts.join(', '), province, district, ward, provinceName, districtName, wardName, lng, lat };
  };

  // Fetch parcel info from our API proxy
  const fetchParcel = async (lng: number, lat: number): Promise<ParcelData | null> => {
    try {
      const res = await fetch(`/api/parcel-info?lng=${lng}&lat=${lat}`, {
        signal: AbortSignal.timeout(8000),
      });
      const json = await res.json();
      if (json.success && json.data) {
        return {
          soTo: json.data.soTo ?? null,
          soThua: json.data.soThua ?? null,
          dienTich: json.data.dienTich ?? null,
          loaiDat: json.data.loaiDat ?? null,
          loaiDatName: json.data.loaiDatName ?? null,
          geometry: json.data.geometry ?? null,
        };
      }
    } catch {}
    return null;
  };

  const renderParcelGeom = (geom: any) => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const srcHl = map.getSource('parcel-highlight');
    if (srcHl) srcHl.setData(geom ? { type: 'Feature', properties: {}, geometry: geom } : { type: 'FeatureCollection', features: [] });
    const srcEdges = map.getSource('parcel-edges');
    if (srcEdges) srcEdges.setData(geom ? buildEdgeFeatures(geom) : { type: 'FeatureCollection', features: [] });
  };


  const reverseGeocodeWithParcel = async (lng: number, lat: number) => {
    setParcelLoading(true);
    try {
      // Run both in parallel
      const [nominatimData, parcelData] = await Promise.allSettled([
        fetch(`${NOMINATIM}/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=vi`)
          .then(r => r.json()),
        fetchParcel(lng, lat),
      ]);

      const addrResult = nominatimData.status === 'fulfilled'
        ? parseNominatim(nominatimData.value, lng, lat)
        : { address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, province: '', district: '', ward: '', provinceName: '', districtName: '', wardName: '', lng, lat };

      const parcel = parcelData.status === 'fulfilled' ? parcelData.value : null;

      renderParcelGeom(parcel?.geometry);

      setQuery(addrResult.address);

      onChange({ ...addrResult, parcel });
    } finally {
      setParcelLoading(false);
    }
  };

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const url = `${NOMINATIM}/search?format=json&q=${encodeURIComponent(q + ', Việt Nam')}&addressdetails=1&limit=6&accept-language=vi&countrycodes=vn`;
      const r = await fetch(url);
      setSuggestions(await r.json());
    } catch {}
    setLoading(false);
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 400);
  };

  const selectSuggestion = async (s: any) => {
    const lng = parseFloat(s.lon);
    const lat = parseFloat(s.lat);
    const result = parseNominatim(s, lng, lat);
    setQuery(result.address);
    setSuggestions([]);

    setParcelLoading(true);
    const parcel = await fetchParcel(lng, lat);
    setParcelLoading(false);
    
    renderParcelGeom(parcel?.geometry);
    
    onChange({ ...result, parcel });


    if (mapRef.current && mapLoaded) {
      const mgl = await import('maplibre-gl');
      placeMarker(mapRef.current, mgl, lng, lat);
      mapRef.current.flyTo({ center: [lng, lat], zoom: 16, duration: 800 });
    }
  };

  const parcel = value?.parcel;
  const parcelColor = parcel?.loaiDat ? (LOAI_DAT_COLOR[parcel.loaiDat] || '#64748b') : '#64748b';

  const showSoTo = parcel && parcel.soTo !== null && parcel.soTo !== undefined && String(parcel.soTo) !== '—' && String(parcel.soTo).trim() !== '';
  const showSoThua = parcel && parcel.soThua !== null && parcel.soThua !== undefined && String(parcel.soThua) !== '—' && String(parcel.soThua).trim() !== '';
  const showLoaiDat = parcel && (parcel.loaiDatName || parcel.loaiDat) && parcel.loaiDatName !== '—' && parcel.loaiDat !== '—';

  return (
    <div className="flex flex-col gap-1.5">
      {/* Search input */}
      <div className="flex items-center border-[1.5px] border-slate-200 rounded-lg bg-white px-2.5">
        <Search className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={1.5} />
        <input
          className="flex-1 py-[11px] px-2 border-none outline-none text-[0.88rem] font-inherit bg-transparent"
          placeholder="Tìm địa chỉ hoặc click trực tiếp lên bản đồ để xác định vị trí..."
          value={query}
          onChange={handleInput}
          autoComplete="off"
        />
        {(loading || parcelLoading) && <span className="text-slate-400 text-[0.85rem]">...</span>}
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <ul className="list-none m-0 p-0 border border-slate-200 rounded-lg bg-white shadow-[0_8px_24px_rgba(0,0,0,0.1)] max-h-[220px] overflow-y-auto z-[100] relative">
          {suggestions.map((s, i) => (
            <li key={i} onClick={() => selectSuggestion(s)} className={`flex items-start gap-2 py-2.5 px-3.5 cursor-pointer text-[0.83rem] text-slate-700 transition-colors duration-150 hover:bg-slate-50 ${i === suggestions.length - 1 ? '' : 'border-b border-slate-100'}`}>
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" strokeWidth={1.5} />
              <span className="flex-1 leading-relaxed">{s.display_name}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Mini map */}
      <div ref={mapContainerRef} className="w-full h-[260px] rounded-xl overflow-hidden border-[1.5px] border-slate-200 bg-slate-100" />

      {/* Location + Parcel info */}
      {value?.lat && (
        <div className="flex flex-col gap-2">
          {/* Coordinates */}
          <div className="text-[0.75rem] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg py-[7px] px-3 flex gap-2 flex-wrap items-center">
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.5} /> {value.lat.toFixed(6)}, {value.lng.toFixed(6)}</span>
            {value.wardName && <span className="text-slate-300">·</span>}
            {value.wardName && <span>{value.wardName}, {value.districtName}</span>}
          </div>

          {/* Parcel info block */}
          {parcelLoading && (
            <div className="text-[0.78rem] text-slate-400 py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg">Đang tra thông tin thửa đất...</div>
          )}
          {!parcelLoading && parcel && (
            <div className="bg-white border-[1.5px] border-slate-200 rounded-xl py-3 px-3.5">
              <div className="flex items-center gap-2 mb-2.5">
                <FileText className="w-4 h-4 text-slate-600" strokeWidth={1.5} />
                <strong className="text-[0.88rem] text-slate-800 flex-1">Thông tin thửa đất</strong>
                {parcel.loaiDat && parcel.loaiDat !== '—' && (
                  <span className="text-white text-[0.7rem] font-bold py-0.5 px-2 rounded-full" style={{ background: parcelColor }}>
                    {parcel.loaiDat}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {showSoTo && (
                  <div className="bg-slate-50 rounded-lg py-2 px-2.5 border border-slate-100 flex flex-col gap-[3px]">
                    <span className="text-[0.68rem] text-slate-400 font-semibold uppercase tracking-[0.5px]">Số tờ</span>
                    <strong className="text-[1rem] font-extrabold text-slate-800">{parcel.soTo}</strong>
                  </div>
                )}
                {showSoThua && (
                  <div className="bg-slate-50 rounded-lg py-2 px-2.5 border border-slate-100 flex flex-col gap-[3px]">
                    <span className="text-[0.68rem] text-slate-400 font-semibold uppercase tracking-[0.5px]">Số thửa</span>
                    <strong className="text-[1rem] font-extrabold text-slate-800">{parcel.soThua}</strong>
                  </div>
                )}
                {parcel.dienTich != null && (
                  <div className={`bg-slate-50 rounded-lg py-2 px-2.5 border border-slate-100 flex flex-col gap-[3px] ${
                    (showSoTo && showSoThua)
                      ? 'sm:col-span-1 col-span-2'
                      : (showSoTo || showSoThua)
                        ? 'col-span-1'
                        : 'col-span-2 sm:col-span-3'
                  }`}>
                    <span className="text-[0.68rem] text-slate-400 font-semibold uppercase tracking-[0.5px]">Diện tích thửa</span>
                    <strong className="text-[0.9rem] font-extrabold text-slate-800">{parcel.dienTich.toFixed(1)} m²</strong>
                  </div>
                )}
                {showLoaiDat && (
                  <div className="bg-slate-50 rounded-lg py-2 px-2.5 border border-slate-100 flex flex-col gap-[3px] col-span-2 sm:col-span-3">
                    <span className="text-[0.68rem] text-slate-400 font-semibold uppercase tracking-[0.5px]">Loại đất</span>
                    <strong className="text-[0.82rem] font-extrabold" style={{ color: parcelColor }}>
                      {parcel.loaiDatName || parcel.loaiDat}
                    </strong>
                  </div>
                )}
              </div>
            </div>
          )}
          {!parcelLoading && !parcel && value?.lat && (
            <div className="text-[0.75rem] text-slate-400 py-[7px] px-3">Không có dữ liệu thửa đất tại vị trí này (phóng to mức 15 trở lên để tra cứu)</div>
          )}
        </div>
      )}
    </div>
  );
}
