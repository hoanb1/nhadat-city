'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Map, ExternalLink, MapPin } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_API_URL, DEFAULT_PARCEL_LAYER_ID } from '@/lib/map/mapLayerUtils';

interface Props {
  coordinates: [number, number]; // [lng, lat]
  title: string;
}

export default function ProjectLocationMap({ coordinates, title }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    let mapInstance: any;
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
        } catch (err) {
          console.warn('[Map] Failed to fetch map token in location map:', err);
        }
      }

      if (isCancelled) return;

      const maplibre = await import('maplibre-gl');
      if (isCancelled || !mapContainerRef.current) return;

      // Base style
      const styleUrl = process.env.NEXT_PUBLIC_MAP_API_URL
        ? `${process.env.NEXT_PUBLIC_MAP_API_URL}/style.json`
        : 'https://basemaps.cartocdn.com/gl/raster-tiles-gl-style/style.json';

      const map = new maplibre.Map({
        container: mapContainerRef.current!,
        style: styleUrl,
        center: coordinates,
        zoom: 16,
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

      mapRef.current = map;
      mapInstance = map;

      map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');

      map.on('load', () => {
        if (isCancelled) return;
        setLoading(false);

        // 1. Add background cadastral lines Raster layer (PNG)
        const parcelLayer = DEFAULT_PARCEL_LAYER_ID;

        map.addSource('parcel-wms-embedded', {
          type: 'raster',
          tiles: [`${MAP_API_URL}/${parcelLayer}/{z}/{x}/{y}.png`],
          tileSize: 256,
          maxzoom: 22,
          bounds: [102.144494, 8.34309, 109.524792, 23.39345] // Vietnam bounds
        });

        map.addLayer({
          id: 'parcel-layer-embedded',
          type: 'raster',
          source: 'parcel-wms-embedded',
          minzoom: 13,
          paint: {
            'raster-opacity': 0.40
          }
        });

        // 2. Place standard MapLibre SVG red marker for 100% CSS alignment reliability
        new maplibre.Marker({ color: '#ef4444' })
          .setLngLat(coordinates)
          .setPopup(
            new maplibre.Popup({ offset: [0, -35], closeButton: false })
              .setHTML(`<div style="font-family:Inter,sans-serif;font-size:12px;font-weight:700;color:#1e293b;padding:2px 4px">${title}</div>`)
          )
          .addTo(map)
          .togglePopup();
      });
    };
    initMap();

    return () => {
      isCancelled = true;
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  }, [coordinates, title]);

  return (
    <div className="w-full mt-4 flex flex-col gap-3">
      {/* Map Card */}
      <div className="relative w-full h-[400px] rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-slate-100 group">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10 transition-opacity">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-semibold text-slate-500">Đang dựng bản đồ...</span>
            </div>
          </div>
        )}

        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 mt-1 bg-slate-50 border border-slate-100 rounded-xl p-3.5">
        <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
          <MapPin size={14} className="text-slate-500 shrink-0" />
          <span>Vị trí dự án: <span className="font-bold text-slate-700">{coordinates[1].toFixed(6)}, {coordinates[0].toFixed(6)}</span></span>
        </div>
        
        <Link
          href={`/du-an?lat=${coordinates[1]}&lng=${coordinates[0]}&zoom=18`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-indigo-200"
        >
          <Map size={15} /> Mở bản đồ quy hoạch lớn <ExternalLink size={13} />
        </Link>
      </div>
    </div>
  );
}
