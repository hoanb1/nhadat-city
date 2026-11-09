'use client';

import { useEffect, useRef, useState } from 'react';
import maplibreGl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapContext } from '../Map/MapContext';
import { formatMoney, makeUrlSlug, getImageUrl } from '@/lib/utils/utils';
import { initMapLayers, buildEdgeFeatures } from '../Map/hooks/mapLayers';
import { fetchProjectMapClusters } from './projectClusterData';

interface ParcelInfo {
  soTo: number;
  soThua: number;
  dienTich: number;
  loaiDat: string;
  loaiDatName: string;
  maXa: number;
  lng: number;
  lat: number;
}

export default function ProjectMapClient() {
  const { 
    setMap, 
    setListings, 
    filters,
    selectedListingId, setSelectedListingId,
    selectedListing, setSelectedListing,
    highlightedListingId, setHighlightedListingId,
    highlightedListingCoords, setHighlightedListingCoords,
    showHeatmap, setShowHeatmap,
    page, setPage,
    initialCenter,
    initialZoom,
    initialParcelId,
    province,
    ward,
    locationName,
    selectedParcel: parcel,
    setSelectedParcel: setParcel
  } = useMapContext();
  const setSelectedListingIdRef = useRef(setSelectedListingId);
  useEffect(() => { setSelectedListingIdRef.current = setSelectedListingId; }, [setSelectedListingId]);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibreGl.Map | null>(null);
  const highlightedMarkerRef = useRef<maplibreGl.Marker | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [parcelLoading, setParcelLoading] = useState(false);
  const parcelPopupRef = useRef<maplibreGl.Popup | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !mapContainerRef.current || mapRef.current) return;

    const mapApiUrl = process.env.NEXT_PUBLIC_MAP_API_URL || 'https://map-api.nhadat.city/map-api/v1';

    const emptyStyle: any = {
      version: 8,
      sources: {},
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: { 'background-color': '#f8f9fa' }
        }
      ]
    };

    let defaultCenter: [number, number] = [105.8412, 21.0245];
    let defaultZoom = 12;

    try {
      const savedState = localStorage.getItem('nhadat_mapViewState');
      if (savedState) {
        const { center, zoom } = JSON.parse(savedState);
        if (center && Array.isArray(center) && center.length === 2 && typeof zoom === 'number') {
          defaultCenter = center as [number, number];
          defaultZoom = zoom;
        }
      }
    } catch (e) {
      console.error('Failed to parse map state', e);
    }

    if (initialCenter) defaultCenter = initialCenter;
    if (initialZoom) defaultZoom = initialZoom;

    let map: maplibreGl.Map;
    try {
      map = new maplibreGl.Map({
        container: mapContainerRef.current,
        style: emptyStyle,
        center: defaultCenter,
        zoom: defaultZoom,
        minZoom: 5,
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
    } catch (err) {
      console.error('Failed to initialize WebGL Map:', err);
      setMapError(true);
      return;
    }

    mapRef.current = map;

    // Save state on moveend
    map.on('moveend', () => {
      const currentCenter = map.getCenter();
      const currentZoom = map.getZoom();
      localStorage.setItem('nhadat_mapViewState', JSON.stringify({
        center: [currentCenter.lng, currentCenter.lat],
        zoom: currentZoom
      }));
    });

    map.on('load', () => {
      // Hide server-rendered listing preview overlay (LCP element) once map is ready
      const preview = document.getElementById('listing-ssr-preview');
      if (preview) {
        preview.style.transition = 'opacity 0.4s ease-out';
        preview.style.opacity = '0';
        setTimeout(() => { preview.style.display = 'none'; }, 400);
      }

      // ── Fetch map token for Bearer auth on tile requests ────────────────
      const fetchMapToken = async () => {
        try {
          const res = await fetch('/api/map-token');
          if (res.ok) {
            const { token } = await res.json();
            (window as any).__mapToken = token;
          }
        } catch (err) {
          console.warn('[Map] Failed to fetch map token:', err);
        }
      };

      fetchMapToken().then(() => {
        try {
          initMapLayers(map, highlightedListingId);
        } catch (err) {
          console.error('[Map] initMapLayers failed:', err);
        }
      });

      const tokenRefreshInterval = setInterval(fetchMapToken, 4 * 60 * 1000);
      map.on('remove', () => clearInterval(tokenRefreshInterval));

      // ── Initialize popups ────────────────────────────────────────────────
      const clickPopup = new maplibreGl.Popup({ closeButton: true, maxWidth: '260px' });
      const hoverPopup = new maplibreGl.Popup({ closeButton: false, closeOnClick: true, maxWidth: '240px', className: 'listing-hover-popup' });

      let activeHoverId: string | null = null;
      let hoverTimeout: NodeJS.Timeout | null = null;
      hoverPopup.on('close', () => { activeHoverId = null; });

      map.on('mouseenter', 'unclustered-point', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        
        const props = e.features![0].properties;
        if (props.count > 1 || !props.id || activeHoverId === props.id) return;
        
        activeHoverId = props.id;
        const coords = (e.features![0].geometry as any).coordinates.slice();
        
        const imgUrl = props.imageId ? getImageUrl(props.imageId, props.id, 400, 280) : '';
        const imgHtml = imgUrl 
          ? `<div style="padding:6px 6px 0 6px;background:#fff"><div style="width:100%;height:130px;background-image:url('${imgUrl}');background-size:cover;background-position:center;border-radius:4px"></div></div>` 
          : `<div style="padding:6px 6px 0 6px;background:#fff"><div style="width:100%;height:130px;background:#f1f5f9;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;font-weight:600">Không có ảnh</div></div>`;
          
        const html = `
          <div id="hp-${props.id}" style="font-family:Inter,sans-serif;cursor:pointer;padding:0;width:220px;border-radius:8px;overflow:hidden;box-shadow:0 10px 25px -5px rgba(0,0,0,0.1),0 8px 10px -6px rgba(0,0,0,0.1)">
            ${imgHtml}
            <div style="padding:12px;background:#fff">
              <div style="font-weight:800;color:#e53e3e;font-size:15px;margin-bottom:6px;line-height:1">${formatMoney(props.price)}${props.area ? ` <span style="color:#64748b;font-weight:600;font-size:13px;margin-left:4px">· ${props.area}m²</span>` : ''}</div>
              <div style="font-size:12px;color:#334155;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-weight:500" title="${props.title}">${props.title || 'Đang cập nhật...'}</div>
            </div>
          </div>
        `;

        hoverPopup.setLngLat(coords).setHTML(html).addTo(map);
        
        const popupEl = hoverPopup.getElement();
        if (popupEl) {
          popupEl.onmouseenter = () => { if (hoverTimeout) clearTimeout(hoverTimeout); };
          popupEl.onmouseleave = () => { hoverPopup.remove(); activeHoverId = null; };
        }
        
        setTimeout(() => {
          const el = document.getElementById(`hp-${props.id}`);
          if (el) {
            el.onclick = (ev) => {
              ev.stopPropagation();
              const slug = makeUrlSlug(props.title || '');
              const listingUrl = `/du-an/${props.id}/${slug}`;
              window.history.pushState({ prevUrl: window.location.pathname, listingId: props.id }, '', listingUrl);
              setSelectedListingIdRef.current(props.id);
              hoverPopup.remove();
            };
          }
        }, 10);
      });

      map.on('mouseleave', 'unclustered-point', () => {
        map.getCanvas().style.cursor = '';
        hoverTimeout = setTimeout(() => {
          hoverPopup.remove();
          activeHoverId = null;
        }, 3000);
      });

      map.on('mouseenter', 'clusters', (e) => { 
        map.getCanvas().style.cursor = 'pointer'; 
        if (!e.features?.length) return;
        const props = e.features[0].properties;
        const count = props.count;
        const coords = (e.features[0].geometry as any).coordinates.slice();
        hoverPopup.setLngLat(coords)
          .setHTML(`<div style="padding:4px 8px;font-weight:bold">${count} tin đăng</div>`)
          .addTo(map);
      });
      map.on('mouseleave', 'clusters', () => { 
        map.getCanvas().style.cursor = ''; 
        hoverPopup.remove();
      });

      // Build filter query params from MapContext filters
      const buildFilterParams = (f: typeof filters) => {
        const p = new URLSearchParams();
        if (f.propertyType?.length) p.set('propertyType', f.propertyType.join(','));
        if (f.direction?.length) p.set('direction', f.direction.join(','));
        if (f.minPrice != null) p.set('minPrice', String(f.minPrice));
        if (f.maxPrice != null) p.set('maxPrice', String(f.maxPrice));
        if (f.minArea != null) p.set('minArea', String(f.minArea));
        if (f.maxArea != null) p.set('maxArea', String(f.maxArea));
        if (f.minPricePerM2 != null) p.set('minPricePerM2', String(f.minPricePerM2));
        if (f.maxPricePerM2 != null) p.set('maxPricePerM2', String(f.maxPricePerM2));
        if (f.dateRange === null) p.set('dateRange', 'all');
        else if (f.dateRange != null) p.set('dateRange', String(f.dateRange));
        return p.toString();
      };

      // Fetch data based on bounds + filters.
      const fetchListings = (currentFilters = filters) => {
        if (!mapRef.current) return;
        const m = mapRef.current;
        const bounds = m.getBounds();
        const polygon = {
          type: 'Polygon',
          coordinates: [[
            [bounds.getWest(), bounds.getNorth()],
            [bounds.getEast(), bounds.getNorth()],
            [bounds.getEast(), bounds.getSouth()],
            [bounds.getWest(), bounds.getSouth()],
            [bounds.getWest(), bounds.getNorth()]
          ]]
        };
        const polygonStr = encodeURIComponent(JSON.stringify(polygon));
        const filterStr = buildFilterParams(currentFilters);
        const sep = filterStr ? '&' : '';

        // --- Fetch 1: sidebar list (paginated) ---
        const listLimit = 30;
        const listOffset = (page - 1) * listLimit;
        fetch(`/api/projects?limit=${listLimit}&offset=${listOffset}&polygon=${polygonStr}${sep}${filterStr}`)
          .then(res => res.json())
          .then(listJson => { if (listJson.success) setListings(listJson.data); })
          .catch(err => console.error('[Map] Sidebar fetch failed', err));

        // Only fetch clusters on page 1
        if (page > 1) return;

        // --- Fetch 2: map clusters (via extracted hook) ---
        fetchProjectMapClusters({ polygonStr, filterStr, map: mapRef.current!, setLoading });
      };

      // Store fetchListings on map object so filter effect can call it
      (map as any)._fetchListings = fetchListings;

      map.on('moveend', () => {
        setPage(1); // Reset page to 1 on move
        fetchListings();
      });
      fetchListings();


      // ── Dedicated spider-point handlers (must be registered BEFORE generic click) ──
      const showListingPopup = (props: any, coords: number[], mapRef2: maplibreGl.Map) => {
        const { id, title, price, province, ward, area, imageId } = props;
        if (!id) return;
        const slug = makeUrlSlug(title || '');
        const listingUrl = `/du-an/${id}/${slug}`;
        window.history.pushState({ prevUrl: window.location.pathname, listingId: id }, '', listingUrl);
        setSelectedListingIdRef.current(id);

        const imgUrl = imageId ? getImageUrl(imageId, id, 400, 280) : '';
        const imgHtml = imgUrl
          ? `<div style="padding:6px 6px 0 6px;background:#fff"><div style="width:100%;height:130px;background-image:url('${imgUrl}');background-size:cover;background-position:center;border-radius:4px"></div></div>`
          : `<div style="padding:6px 6px 0 6px;background:#fff"><div style="width:100%;height:130px;background:#f1f5f9;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;font-weight:600">Không có ảnh</div></div>`;

        const html = `
          <div id="click-hp-${id}" style="font-family:Inter,sans-serif;cursor:pointer;padding:0;width:220px;border-radius:8px;overflow:hidden;box-shadow:0 10px 25px -5px rgba(0,0,0,0.15)">
            ${imgHtml}
            <div style="padding:12px;background:#fff">
              <div style="font-weight:800;color:#e53e3e;font-size:15px;margin-bottom:6px;line-height:1">${formatMoney(price)}${area ? ` <span style="color:#64748b;font-weight:600;font-size:13px;margin-left:4px">· ${area}m²</span>` : ''}</div>
              <div style="font-size:12px;color:#334155;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-weight:500" title="${title}">${title || 'Đang cập nhật...'}</div>
            </div>
          </div>
        `;
        clickPopup.setLngLat(coords as [number, number]).setHTML(html).addTo(mapRef2);
        setTimeout(() => {
          const el = document.getElementById(`click-hp-${id}`);
          if (el) el.onclick = (ev) => { ev.stopPropagation(); clickPopup.remove(); };
        }, 10);
      };

      map.on('click', 'spider-point', (e) => {
        if (!e.features?.length) return;
        e.originalEvent.stopPropagation();
        const props = e.features[0].properties;
        const coords = (e.features[0].geometry as any).coordinates.slice();
        showListingPopup(props, coords, map);
      });

      map.on('mouseenter', 'spider-point', (e) => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        map.getCanvas().style.cursor = 'pointer';
        if (!e.features?.length) return;
        const props = e.features[0].properties;
        if (activeHoverId === props.id) return;
        activeHoverId = props.id;
        const coords = (e.features[0].geometry as any).coordinates.slice();
        const imgUrl = props.imageId ? getImageUrl(props.imageId, props.id, 400, 280) : '';
        const imgHtml = imgUrl
          ? `<div style="padding:6px 6px 0 6px;background:#fff"><div style="width:100%;height:130px;background-image:url('${imgUrl}');background-size:cover;background-position:center;border-radius:4px"></div></div>`
          : `<div style="padding:6px 6px 0 6px;background:#fff"><div style="width:100%;height:130px;background:#f1f5f9;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;font-weight:600">Không có ảnh</div></div>`;
        const html = `
          <div id="hp-${props.id}" style="font-family:Inter,sans-serif;cursor:pointer;padding:0;width:220px;border-radius:8px;overflow:hidden;box-shadow:0 10px 25px -5px rgba(0,0,0,0.1),0 8px 10px -6px rgba(0,0,0,0.1)">
            ${imgHtml}
            <div style="padding:12px;background:#fff">
              <div style="font-weight:800;color:#e53e3e;font-size:15px;margin-bottom:6px;line-height:1">${formatMoney(props.price)}${props.area ? ` <span style="color:#64748b;font-weight:600;font-size:13px;margin-left:4px">· ${props.area}m²</span>` : ''}</div>
              <div style="font-size:12px;color:#334155;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-weight:500" title="${props.title}">${props.title || 'Đang cập nhật...'}</div>
            </div>
          </div>`;
        hoverPopup.setLngLat(coords).setHTML(html).addTo(map);

        const popupEl = hoverPopup.getElement();
        if (popupEl) {
          popupEl.onmouseenter = () => { if (hoverTimeout) clearTimeout(hoverTimeout); };
          popupEl.onmouseleave = () => { hoverPopup.remove(); activeHoverId = null; };
        }

        setTimeout(() => {
          const el = document.getElementById(`hp-${props.id}`);
          if (el) {
            el.onclick = (ev) => {
              ev.stopPropagation();
              const slug = makeUrlSlug(props.title || '');
              const listingUrl = `/du-an/${props.id}/${slug}`;
              window.history.pushState({ prevUrl: window.location.pathname, listingId: props.id }, '', listingUrl);
              setSelectedListingIdRef.current(props.id);
              hoverPopup.remove();
            };
          }
        }, 10);
      });

      map.on('mouseleave', 'spider-point', () => {
        map.getCanvas().style.cursor = '';
        hoverTimeout = setTimeout(() => {
          hoverPopup.remove();
          activeHoverId = null;
        }, 3000);
      });

      // ── Centralized Click Handler for ALL interactions (with 5px bbox for touch/mouse accuracy) ──
      map.on('click', async (e) => {
        const bbox: [maplibreGl.PointLike, maplibreGl.PointLike] = [
          [e.point.x - 5, e.point.y - 5],
          [e.point.x + 5, e.point.y + 5]
        ];
        const listingFeatures = map.queryRenderedFeatures(bbox, {
          layers: ['unclustered-point', 'spider-point', 'clusters', 'cluster-count']
        });

        // If user clicked a listing or cluster, handle it and return early
        if (listingFeatures.length > 0) {
          // Check if they clicked an individual listing (unclustered-point or spider-point)
          const unclusteredFeature = listingFeatures.find(f => f.layer.id === 'unclustered-point' || f.layer.id === 'spider-point');
          if (unclusteredFeature) {
            const props = unclusteredFeature.properties;
            const coords = (unclusteredFeature.geometry as any).coordinates.slice();
            showListingPopup(props, coords, map);
            return;
          }

          // Check if they clicked a cluster (clusters or cluster-count)
          const clusterFeature = listingFeatures.find(f => f.layer.id === 'clusters' || f.layer.id === 'cluster-count');
          if (clusterFeature) {
            const coords = (clusterFeature.geometry as any).coordinates;
            const currentZoom = map.getZoom();
            map.easeTo({ center: coords, zoom: Math.min(22, currentZoom + 2) });
            return;
          }
        }
        
        // ── If NO markers were clicked, proceed with Parcel info fetching ──
        const { lng, lat } = e.lngLat;

        // Remove previous parcel popup
        if (parcelPopupRef.current) {
          parcelPopupRef.current.remove();
          parcelPopupRef.current = null;
        }

        // Show loading popup at click position
        setParcelLoading(true);
        setParcel(null);

        const loadingPopup = new maplibreGl.Popup({ closeButton: true, maxWidth: '260px', anchor: 'bottom', offset: [0, -10] })
          .setLngLat([lng, lat])
          .setHTML('<div style="padding:10px 14px;font-family:Inter,sans-serif;font-size:13px;color:#64748b">Đang tra cứu dữ liệu quy hoạch thửa đất...</div>')
          .addTo(map);
        parcelPopupRef.current = loadingPopup;

        try {
          const res = await fetch(`/api/parcel-info?lng=${lng}&lat=${lat}`);
          const json = await res.json();

          if (parcelPopupRef.current === loadingPopup && map.getContainer()) {
            if (json.success && json.data) {
              const d = json.data;
              const loaiColor = d.loaiDat === 'ODT' || d.loaiDat === 'ONT' ? '#2563eb' :
                d.loaiDat?.startsWith('R') ? '#16a34a' : '#d97706';
              
              // Draw highlight and edges if geometry is present
              if (d.geometry) {
                const srcHl = map.getSource('parcel-highlight') as maplibreGl.GeoJSONSource;
                if (srcHl) srcHl.setData({ type: 'Feature', properties: {}, geometry: d.geometry });
                const srcEdges = map.getSource('parcel-edges') as maplibreGl.GeoJSONSource;
                if (srcEdges) srcEdges.setData(buildEdgeFeatures(d.geometry) as any);
              }

              const addressHtml = d.wardName || d.districtName || d.provinceName
                ? `<div style="margin-bottom:6px;padding:8px 10px;background:#fff7ed;border-radius:8px;border:1px solid #fed7aa">
                    <div style="font-size:10px;color:#ea580c;font-weight:600;margin-bottom:3px">ĐỊA CHỈ THAM KHẢO</div>
                    <div style="font-size:11px;color:#7c2d12;line-height:1.5">${[d.wardName, d.districtName, d.provinceName].filter(Boolean).join(', ')}</div>
                  </div>` : '';

              const soToHtml = d.soTo && d.soTo !== '—' ? `
                <div style="background:#f8fafc;border-radius:8px;padding:8px 10px;border:1px solid #e2e8f0">
                  <div style="font-size:10px;color:#94a3b8;font-weight:600;margin-bottom:2px">SỐ TỜ</div>
                  <div style="font-size:18px;font-weight:800;color:#1e293b">${d.soTo}</div>
                </div>
              ` : '';

              const soThuaHtml = d.soThua && d.soThua !== '—' ? `
                <div style="background:#f8fafc;border-radius:8px;padding:8px 10px;border:1px solid #e2e8f0">
                  <div style="font-size:10px;color:#94a3b8;font-weight:600;margin-bottom:2px">SỐ THỬA</div>
                  <div style="font-size:18px;font-weight:800;color:#1e293b">${d.soThua}</div>
                </div>
              ` : '';

              const gridHtml = (soToHtml || soThuaHtml) ? `
                <div style="display:grid;grid-template-columns:${soToHtml && soThuaHtml ? '1fr 1fr' : '1fr'};gap:8px;margin-bottom:10px">
                  ${soToHtml}
                  ${soThuaHtml}
                </div>
              ` : '';

              const dienTichHtml = d.dienTich ? `
                <div style="margin-bottom:8px;padding:8px 10px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0">
                  <div style="font-size:10px;color:#16a34a;font-weight:600;margin-bottom:2px">DIỆN TÍCH</div>
                  <div style="font-size:16px;font-weight:800;color:#16a34a">${d.dienTich.toFixed(1)} m²</div>
                </div>
              ` : '';

              const hasLoaiDat = (d.loaiDat || d.loaiDatName) && d.loaiDat !== '—' && d.loaiDatName !== '—';
              const loaiDatHtml = hasLoaiDat ? `
                <div style="margin-bottom:8px;padding:6px 10px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe">
                  <div style="font-size:10px;color:#2563eb;font-weight:600;margin-bottom:2px">LOẠI ĐẤT</div>
                  <div style="font-size:12px;font-weight:700;color:${loaiColor}">${d.loaiDat || ''}${d.loaiDat && d.loaiDatName ? ' — ' : ''}${d.loaiDatName || ''}</div>
                </div>
              ` : '';

              loadingPopup.setHTML(`
                <div style="font-family:Inter,sans-serif;padding:14px 16px;min-width:220px">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                    <strong style="font-size:14px;color:#1e293b">Thông tin thửa đất</strong>
                  </div>
                  ${gridHtml}
                  ${dienTichHtml}
                  ${loaiDatHtml}
                  ${addressHtml}
                  <div style="margin-top:10px;padding-top:8px;border-top:1px solid #f1f5f9">
                    <div style="font-size:10px;color:#94a3b8;margin-bottom:8px">
                      ${lng.toFixed(6)}, ${lat.toFixed(6)}
                    </div>
                    <button id="btn-share-parcel-${d.thuaId}" style="width:100%;padding:8px;background:#2563eb;color:white;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px" onclick="navigator.clipboard.writeText('https://nhadat.city/parcel-boundary/${d.provinceSlug || province || 'undefined'}/${d.wardSlug || ward || 'undefined'}/${d.thuaId}').then(() => { this.innerHTML='Đã sao chép link'; setTimeout(()=>this.innerHTML='Sao chép link thửa đất', 2000) })">
                      Sao chép link thửa đất
                    </button>
                    <div style="margin-top:8px;font-size:9px;color:#94a3b8;line-height:1.4;text-align:justify;font-style:italic">
                      * Chú ý: Thông tin về thửa đất chỉ có tính chất tham khảo. Vui lòng liên hệ với các cơ quan chức năng để có thông tin chính thức.
                    </div>
                  </div>
                </div>
              `);

              setParcel({
                thuaId: d.thuaId,
                soTo: d.soTo, soThua: d.soThua,
                dienTich: d.dienTich, loaiDat: d.loaiDat,
                loaiDatName: d.loaiDatName, maXa: d.maXa,
                provinceSlug: d.provinceSlug || '',
                wardSlug: d.wardSlug || '',
                wardName: d.wardName || '',
                districtName: d.districtName || '',
                provinceName: d.provinceName || '',
                lng, lat
              });

              loadingPopup.on('close', () => {
                if (parcelPopupRef.current === loadingPopup) {
                  setParcel(null);
                  parcelPopupRef.current = null;
                  const hl = map.getSource('parcel-highlight') as maplibreGl.GeoJSONSource;
                  if (hl) hl.setData({ type: 'FeatureCollection', features: [] });
                  const ed = map.getSource('parcel-edges') as maplibreGl.GeoJSONSource;
                  if (ed) ed.setData({ type: 'FeatureCollection', features: [] });
                  if (window.location.pathname.includes('/parcel-boundary')) {
                    const fallbackUrl = (province && ward) ? `/${province}/${ward}` : (province ? `/${province}` : '/');
                    window.history.replaceState(null, '', fallbackUrl);
                  }
                }
              });
            } else {
              loadingPopup.setHTML(
                '<div style="padding:12px 16px;font-family:Inter,sans-serif;font-size:13px;color:#64748b">Không tìm thấy thông tin thửa đất tại vị trí này.<br><span style="font-size:11px">Hãy zoom vào ≥ cấp 15 và click vào thửa đất.</span></div>'
              );
              // Clear previous highlight
              const srcHl = map.getSource('parcel-highlight') as maplibreGl.GeoJSONSource;
              if (srcHl) srcHl.setData({ type: 'FeatureCollection', features: [] });
              const srcEdges = map.getSource('parcel-edges') as maplibreGl.GeoJSONSource;
              if (srcEdges) srcEdges.setData({ type: 'FeatureCollection', features: [] });
            }
          }
        } catch {
          if (parcelPopupRef.current === loadingPopup) {
            loadingPopup.setHTML('<div style="padding:12px;font-family:Inter,sans-serif;font-size:13px;color:#ef4444">Lỗi kết nối</div>');
          }
        } finally {
          setParcelLoading(false);
        }
      });

      // ── Show/hide parcel layer toggle hint ──
      map.on('zoom', () => {
        const z = map.getZoom();
        const hint = document.getElementById('parcel-zoom-hint');
        if (hint) hint.style.display = z < 15 ? 'block' : 'none';
      });

      // ── Handle initialParcelId ──
      if (initialParcelId) {
        setParcelLoading(true);
        fetch(`/api/parcel-by-id?uuid=${initialParcelId}`)
          .then(res => res.json())
          .then(json => {
            if (json.success && json.data) {
              const d = json.data;
              const loaiColor = d.loaiDat === 'ODT' || d.loaiDat === 'ONT' ? '#2563eb' :
                d.loaiDat?.startsWith('R') ? '#16a34a' : '#d97706';
              
              if (d.geometry) {
                const srcHl = map.getSource('parcel-highlight') as maplibreGl.GeoJSONSource;
                if (srcHl) srcHl.setData({ type: 'Feature', properties: {}, geometry: d.geometry });
                const srcEdges = map.getSource('parcel-edges') as maplibreGl.GeoJSONSource;
                if (srcEdges) srcEdges.setData(buildEdgeFeatures(d.geometry) as any);

                try {
                  let minX = 180, maxX = -180, minY = 90, maxY = -90;
                  const coords = d.geometry.type === 'MultiPolygon' ? d.geometry.coordinates[0][0] : d.geometry.coordinates[0];
                  coords.forEach((c: any) => {
                    if (c[0] < minX) minX = c[0];
                    if (c[0] > maxX) maxX = c[0];
                    if (c[1] < minY) minY = c[1];
                    if (c[1] > maxY) maxY = c[1];
                  });
                  const cx = (minX + maxX) / 2;
                  const cy = (minY + maxY) / 2;
                  
                  map.flyTo({ center: [cx, cy], duration: 1000 });

                  const soToHtml = d.soTo && d.soTo !== '—' ? `
                    <div style="background:#f8fafc;border-radius:8px;padding:8px 10px;border:1px solid #e2e8f0">
                      <div style="font-size:10px;color:#94a3b8;font-weight:600;margin-bottom:2px">SỐ TỜ</div>
                      <div style="font-size:18px;font-weight:800;color:#1e293b">${d.soTo}</div>
                    </div>
                  ` : '';

                  const soThuaHtml = d.soThua && d.soThua !== '—' ? `
                    <div style="background:#f8fafc;border-radius:8px;padding:8px 10px;border:1px solid #e2e8f0">
                      <div style="font-size:10px;color:#94a3b8;font-weight:600;margin-bottom:2px">SỐ THỬA</div>
                      <div style="font-size:18px;font-weight:800;color:#1e293b">${d.soThua}</div>
                    </div>
                  ` : '';

                  const gridHtml = (soToHtml || soThuaHtml) ? `
                    <div style="display:grid;grid-template-columns:${soToHtml && soThuaHtml ? '1fr 1fr' : '1fr'};gap:8px;margin-bottom:10px">
                      ${soToHtml}
                      ${soThuaHtml}
                    </div>
                  ` : '';

                  const dienTichHtml = d.dienTich ? `
                    <div style="margin-bottom:8px;padding:8px 10px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0">
                      <div style="font-size:10px;color:#16a34a;font-weight:600;margin-bottom:2px">DIỆN TÍCH</div>
                      <div style="font-size:16px;font-weight:800;color:#16a34a">${d.dienTich.toFixed(1)} m²</div>
                    </div>
                  ` : '';

                  const hasLoaiDat = (d.loaiDat || d.loaiDatName) && d.loaiDat !== '—' && d.loaiDatName !== '—';
                  const loaiDatHtml = hasLoaiDat ? `
                    <div style="padding:6px 10px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;margin-bottom:8px">
                      <div style="font-size:10px;color:#2563eb;font-weight:600;margin-bottom:2px">LOẠI ĐẤT</div>
                      <div style="font-size:12px;font-weight:700;color:${loaiColor}">${d.loaiDat || ''}${d.loaiDat && d.loaiDatName ? ' — ' : ''}${d.loaiDatName || ''}</div>
                    </div>
                  ` : '';

                  const popupContent = document.createElement('div');
                  popupContent.innerHTML = `
                    <div style="font-family:Inter,sans-serif;padding:14px 16px;min-width:220px">
                      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                        <strong style="font-size:14px;color:#1e293b">Thông tin thửa đất</strong>
                      </div>
                      ${gridHtml}
                      ${dienTichHtml}
                      ${loaiDatHtml}
                      <div style="margin-top:10px;padding-top:8px;border-top:1px solid #f1f5f9">
                        <div style="font-size:10px;color:#94a3b8;margin-bottom:8px">
                          ${cx.toFixed(6)}, ${cy.toFixed(6)}
                        </div>
                        <button id="btn-share-parcel-${d.thuaId}" style="width:100%;padding:8px;background:#2563eb;color:white;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px" onclick="navigator.clipboard.writeText('https://nhadat.city/parcel-boundary/${d.provinceSlug || province || 'undefined'}/${d.wardSlug || ward || 'undefined'}/${d.thuaId}').then(() => { this.innerHTML='Đã sao chép link'; setTimeout(()=>this.innerHTML='Sao chép link thửa đất', 2000) })">
                          Sao chép link thửa đất
                        </button>
                        <div style="margin-top:8px;font-size:9px;color:#94a3b8;line-height:1.4;text-align:justify;font-style:italic">
                          * Chú ý: Thông tin về thửa đất chỉ có tính chất tham khảo. Vui lòng liên hệ với các cơ quan chức năng để có thông tin chính thức.
                        </div>
                      </div>
                    </div>
                  `;

                  const pPopup = new maplibreGl.Popup({ closeOnClick: false, maxWidth: '280px' })
                    .setLngLat([cx, cy])
                    .setDOMContent(popupContent)
                    .addTo(map);

                  parcelPopupRef.current = pPopup;
                  setParcel({
                    thuaId: d.thuaId,
                    soTo: d.soTo, soThua: d.soThua,
                    dienTich: d.dienTich, loaiDat: d.loaiDat,
                    loaiDatName: d.loaiDatName, maXa: d.maXa,
                    provinceSlug: d.provinceSlug || '',
                    wardSlug: d.wardSlug || '',
                    wardName: d.wardName || '',
                    districtName: d.districtName || '',
                    provinceName: d.provinceName || '',
                    lng: cx, lat: cy
                  });

                  pPopup.on('close', () => {
                    if (parcelPopupRef.current === pPopup) {
                      setParcel(null);
                      parcelPopupRef.current = null;
                      const hl = map.getSource('parcel-highlight') as maplibreGl.GeoJSONSource;
                      if (hl) hl.setData({ type: 'FeatureCollection', features: [] });
                      const ed = map.getSource('parcel-edges') as maplibreGl.GeoJSONSource;
                      if (ed) ed.setData({ type: 'FeatureCollection', features: [] });
                      if (window.location.pathname.includes('/parcel-boundary')) {
                        const fallbackUrl = (province && ward) ? `/${province}/${ward}` : (province ? `/${province}` : '/');
                        window.history.replaceState(null, '', fallbackUrl);
                      }
                    }
                  });
                } catch (e) {
                  console.error(e);
                }
              }
            }
          })
          .catch(console.error)
          .finally(() => setParcelLoading(false));
      }

      setMap(map);
    });

    return () => {
      setMap(null);
      map.remove();
      mapRef.current = null;
    };
  }, [mounted, setMap]);

  // Re-fetch when filters change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !(map as any)._fetchListings) return;
    setPage(1); // Reset page on filter change
    (map as any)._fetchListings(filters);
  }, [filters, setPage]);

  // Re-fetch when page changes (infinite scroll)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !(map as any)._fetchListings || page === 1) return;
    (map as any)._fetchListings(filters);
  }, [page, filters]);

  // Handle marker highlight
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('unclustered-point')) return;
    
    map.setPaintProperty('unclustered-point', 'circle-color', [
      'case',
      ['==', ['get', 'id'], highlightedListingId || ''], '#f97316', // Highlighted: Orange
      ['>', ['coalesce', ['get', 'count'], 1], 1], '#8b5cf6', // Clustered: Purple
      '#2563eb' // Default Project: Blue
    ]);
    map.setPaintProperty('unclustered-point', 'circle-radius', [
      'case',
      ['==', ['get', 'id'], highlightedListingId || ''], 16,
      ['>', ['coalesce', ['get', 'count'], 1], 1], [
        'interpolate', ['linear'], ['coalesce', ['get', 'count'], 1],
        2, 12,
        50, 16,
        200, 20,
        1000, 24
      ],
      8
    ]);
  }, [highlightedListingId]);

  // Handle exact coordinate marker for highlighted item (bypasses clustering)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (highlightedListingCoords) {
      if (!highlightedMarkerRef.current) {
        const el = document.createElement('div');
        el.style.position = 'relative';
        el.style.width = '20px';
        el.style.height = '20px';
        el.style.backgroundColor = '#f97316';
        el.style.borderRadius = '50%';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';
        el.style.zIndex = '10';

        const ring = document.createElement('div');
        ring.className = 'animate-ping absolute inset-0 rounded-full bg-orange-500 opacity-75';
        el.appendChild(ring);

        highlightedMarkerRef.current = new maplibreGl.Marker({ element: el })
          .setLngLat(highlightedListingCoords)
          .addTo(map);
      } else {
        highlightedMarkerRef.current.setLngLat(highlightedListingCoords);
      }
    } else {
      if (highlightedMarkerRef.current) {
        highlightedMarkerRef.current.remove();
        highlightedMarkerRef.current = null;
      }
    }
  }, [highlightedListingCoords]);

  // Handle Heatmap toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('real-estate-heatmap')) return;
    
    map.setLayoutProperty(
      'real-estate-heatmap', 
      'visibility', 
      showHeatmap ? 'visible' : 'none'
    );
    
    // Dim markers when heatmap is on
    const markerOpacity = showHeatmap ? 0.15 : 1;
    map.setPaintProperty('clusters', 'circle-opacity', markerOpacity);
    map.setPaintProperty('clusters', 'circle-stroke-opacity', markerOpacity);
    map.setPaintProperty('unclustered-point', 'circle-opacity', markerOpacity);
    map.setPaintProperty('unclustered-point', 'circle-stroke-opacity', markerOpacity);
    map.setPaintProperty('unclustered-count', 'text-opacity', markerOpacity);
    map.setPaintProperty('cluster-count', 'text-opacity', markerOpacity);
  }, [showHeatmap]);

  if (!mounted) {
    return <div style={{ width: '100vw', height: '100vh', background: '#e2e8f0' }} />;
  }

  return (
    <div className="w-full h-full relative" id="main-map-container">
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-50 p-4 text-center">
          <div>
            <h3 className="text-slate-800 font-bold text-lg mb-1">Không thể tải bản đồ 3D</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">Trình duyệt của bạn không hỗ trợ WebGL. Vui lòng bật phần cứng tăng tốc hoặc dùng trình duyệt phiên bản mới nhất.</p>
          </div>
        </div>
      )}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full bg-[#f8fafc]"
        style={{ cursor: parcelLoading ? 'wait' : 'grab' }}
        aria-label="Bản đồ chính"
      />
      {/* Parcel zoom hint */}
      <div
        id="parcel-zoom-hint"
        style={{
          display: 'none',
          position: 'absolute',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15,23,42,0.85)',
          color: '#fff',
          padding: '7px 16px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'Inter,sans-serif',
          pointerEvents: 'none',
          backdropFilter: 'blur(8px)',
          whiteSpace: 'nowrap',
          zIndex: 10,
        }}
      >
        Phóng to cấp 15+ để xem và chọn thửa đất
      </div>
    </div>
  );
}
