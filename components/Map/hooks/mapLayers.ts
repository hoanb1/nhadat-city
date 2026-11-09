'use client';
/**
 * mapLayers — Adds all MapLibre layers (clusters, spider, heatmap, parcel WMS/highlight/edges)
 * to the map after it loads. Client-only (uses maplibre-gl).
 */
import maplibreGl from 'maplibre-gl';
import { getMaplibreLabelExpression } from '@/lib/geo/landTypeLabels';


/** Haversine distance in meters */
export function getDistance(
  lng1: number, lat1: number,
  lng2: number, lat2: number,
): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Build GeoJSON LineStrings for parcel edges with length text */
export function buildEdgeFeatures(geometry: any) {
  const edges: any[] = [];
  const processRing = (ring: number[][]) => {
    for (let i = 0; i < ring.length - 1; i++) {
      const p1 = ring[i];
      const p2 = ring[i + 1];
      edges.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [p1, p2] },
        properties: { length: getDistance(p1[0], p1[1], p2[0], p2[1]).toFixed(1) + ' m' },
      });
    }
  };
  if (geometry?.type === 'Polygon') geometry.coordinates.forEach(processRing);
  else if (geometry?.type === 'MultiPolygon')
    geometry.coordinates.forEach((poly: any) => poly.forEach(processRing));
  return { type: 'FeatureCollection', features: edges };
}

/**
 * Initialise all map sources & layers.
 * Called once inside map.on('load', ...).
 */
export function initMapLayers(map: maplibreGl.Map, highlightedListingId: string | null) {
  // ── GeoJSON source for listings / clusters / spider ───────────────────────
  map.addSource('listings', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterMaxZoom: 16,
    clusterMinPoints: 5,
    clusterRadius: 50,
    clusterProperties: {
      'count': ['+', ['coalesce', ['get', 'count'], 1]],
    },
  });

  // Separate non-clustered source for spider lines (avoids supercluster breaking on LineStrings)
  map.addSource('listings-spider-lines', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  // Server-side clusters layer (count > 1)
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'listings',
    filter: ['>', ['coalesce', ['get', 'count'], 1], 1],
    paint: {
      'circle-color': ['step', ['coalesce', ['get', 'count'], 1], '#3b82f6', 20, '#2563eb', 100, '#1d4ed8'],
      'circle-radius': ['step', ['coalesce', ['get', 'count'], 1], 15, 20, 20, 100, 25],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  });

  // Heatmap layer (hidden by default)
  map.addLayer({
    id: 'real-estate-heatmap',
    type: 'heatmap',
    source: 'listings',
    layout: { visibility: 'none' },
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['coalesce', ['get', 'count'], 1], 1, 0.5, 100, 2, 1000, 5],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(33,102,172,0)',
        0.2, 'rgb(103,169,207)',
        0.4, 'rgb(209,229,240)',
        0.6, 'rgb(253,219,199)',
        0.8, 'rgb(239,138,98)',
        1, 'rgb(220,38,38)',
      ],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 15, 9, 25, 15, 50],
      'heatmap-opacity': 0.85,
    },
  }, 'clusters');

  // Spider lines
  map.addLayer({
    id: 'listings-lines',
    type: 'line',
    source: 'listings-spider-lines',
    filter: ['==', ['get', 'is_spider_line'], true],
    paint: { 'line-color': '#94a3b8', 'line-width': 1.5, 'line-dasharray': [2, 2] },
  });

  // Spider center ring
  map.addLayer({
    id: 'spider-center',
    type: 'circle',
    source: 'listings',
    filter: ['==', ['get', 'is_spider_center'], true],
    paint: {
      'circle-color': '#f8fafc', 'circle-radius': 11,
      'circle-stroke-width': 3, 'circle-stroke-color': '#64748b', 'circle-opacity': 1,
    },
  });

  // Spider center count label
  map.addLayer({
    id: 'spider-center-label',
    type: 'symbol',
    source: 'listings',
    filter: ['==', ['get', 'is_spider_center'], true],
    layout: {
      'text-field': ['to-string', ['get', 'spider_count']],
      'text-size': 11,
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: { 'text-color': '#475569', 'text-halo-color': '#fff', 'text-halo-width': 1 },
  });

  // Spider point markers
  map.addLayer({
    id: 'spider-point',
    type: 'circle',
    source: 'listings',
    filter: ['==', ['get', 'is_spider'], true],
    paint: {
      'circle-color': '#ef4444', 'circle-radius': 9,
      'circle-stroke-width': 2.5, 'circle-stroke-color': '#fff', 'circle-opacity': 1,
    },
  });

  // Spider price labels
  map.addLayer({
    id: 'spider-price-label',
    type: 'symbol',
    source: 'listings',
    filter: ['==', ['get', 'is_spider'], true],
    layout: { 'text-field': '', 'text-size': 10, 'text-allow-overlap': true, 'text-offset': [0, 1.6] },
    paint: { 'text-color': '#1e293b', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
  });

  // Cluster count labels
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'listings',
    filter: ['>', ['coalesce', ['get', 'count'], 1], 1],
    layout: { 'text-field': ['to-string', ['get', 'count']], 'text-size': 12, 'text-allow-overlap': true },
    paint: { 'text-color': '#ffffff' },
  });

  // Individual unclustered markers
  map.addLayer({
    id: 'unclustered-point',
    type: 'circle',
    source: 'listings',
    filter: ['all',
      ['<=', ['coalesce', ['get', 'count'], 1], 1],
      ['!=', ['get', 'is_spider'], true],
      ['!=', ['get', 'is_spider_center'], true],
    ],
    paint: {
      'circle-color': ['case', ['==', ['get', 'id'], highlightedListingId || ''], '#22c55e', '#ef4444'],
      'circle-radius': ['case', ['==', ['get', 'id'], highlightedListingId || ''], 12, 8],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
      'circle-opacity': 0.9,
    },
  });

  map.addLayer({
    id: 'unclustered-count',
    type: 'symbol',
    source: 'listings',
    filter: ['>', ['coalesce', ['get', 'count'], 1], 1],
    layout: { 'text-field': ['to-string', ['get', 'count']], 'text-size': 10, 'text-allow-overlap': true },
    paint: { 'text-color': '#ffffff' },
  });

  // ── Parcel highlight ──────────────────────────────────────────────────────
  map.addSource('parcel-highlight', {
    type: 'geojson', data: { type: 'FeatureCollection', features: [] }, maxzoom: 24, tolerance: 0,
  });
  map.addLayer({ id: 'parcel-highlight-fill', type: 'fill', source: 'parcel-highlight', paint: { 'fill-color': '#0ea5e9', 'fill-opacity': 0.5 } }, 'clusters');
  map.addLayer({ id: 'parcel-highlight-line', type: 'line', source: 'parcel-highlight', paint: { 'line-color': '#0284c7', 'line-width': 2 } }, 'clusters');

  // ── Parcel edge lengths ───────────────────────────────────────────────────
  map.addSource('parcel-edges', {
    type: 'geojson', data: { type: 'FeatureCollection', features: [] }, maxzoom: 24, tolerance: 0,
  });
  map.addLayer({
    id: 'parcel-edge-labels', type: 'symbol', source: 'parcel-edges',
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'length'],
      'text-size': 12,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: { 'text-color': '#0f172a', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
  });

  // ── Vietnam Island and Archipelago Labels ─────────────────────────────────
  try {
    addVietnamIslandsLabels(map);
  } catch (err) {
    console.error('[Map] Failed to add Vietnam islands labels:', err);
  }
}

/**
 * Adds labels for Vietnamese islands and archipelagos (Hoàng Sa, Trường Sa, Phú Quốc, Thổ Chu, Bạch Long Vĩ...)
 * to the map, styled beautifully and showing at appropriate zoom levels.
 */
export function addVietnamIslandsLabels(map: maplibreGl.Map) {
  if (map.getSource('vietnam-islands-labels')) return;

  const islandsGeoJSON: any = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [112.2, 16.3] },
        properties: {
          name: 'Quần đảo Hoàng Sa\n(Việt Nam)',
          category: 'low-zoom',
          textSize: 13,
        },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [114.3, 8.8] },
        properties: {
          name: 'Quần đảo Trường Sa\n(Việt Nam)',
          category: 'low-zoom',
          textSize: 13,
        },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [103.96, 10.23] },
        properties: {
          name: 'Đảo Phú Quốc',
          category: 'low-zoom',
          textSize: 12,
        },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [103.48, 9.30] },
        properties: {
          name: 'Quần đảo Thổ Chu\n(Việt Nam)',
          category: 'med-zoom',
          textSize: 11,
        },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [107.73, 20.13] },
        properties: {
          name: 'Đảo Bạch Long Vĩ\n(Việt Nam)',
          category: 'med-zoom',
          textSize: 11,
        },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [106.61, 8.69] },
        properties: {
          name: 'Quần đảo Côn Đảo\n(Việt Nam)',
          category: 'med-zoom',
          textSize: 11,
        },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [108.94, 10.52] },
        properties: {
          name: 'Đảo Phú Quý',
          category: 'med-zoom',
          textSize: 11,
        },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [109.12, 15.39] },
        properties: {
          name: 'Đảo Lý Sơn',
          category: 'med-zoom',
          textSize: 11,
        },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [106.99, 20.80] },
        properties: {
          name: 'Đảo Cát Bà',
          category: 'med-zoom',
          textSize: 11,
        },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [107.76, 20.99] },
        properties: {
          name: 'Quần đảo Cô Tô',
          category: 'med-zoom',
          textSize: 11,
        },
      },
    ],
  };

  map.addSource('vietnam-islands-labels', {
    type: 'geojson',
    data: islandsGeoJSON,
  });

  // Low-zoom layer (visible from zoom 4.5)
  map.addLayer({
    id: 'vietnam-islands-labels-low',
    type: 'symbol',
    source: 'vietnam-islands-labels',
    minzoom: 4.5,
    filter: ['==', ['get', 'category'], 'low-zoom'],
    layout: {
      'text-field': ['get', 'name'],
      'text-size': ['get', 'textSize'],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-allow-overlap': true,
      'text-ignore-placement': false,
      'text-offset': [0, 0],
      'text-justify': 'center',
      'text-anchor': 'center',
    },
    paint: {
      'text-color': '#1e3a8a', // Premium deep navy blue
      'text-halo-color': '#ffffff',
      'text-halo-width': 2,
      'text-halo-blur': 0.5,
    },
  });

  // Medium-zoom layer (visible from zoom 7.5)
  map.addLayer({
    id: 'vietnam-islands-labels-med',
    type: 'symbol',
    source: 'vietnam-islands-labels',
    minzoom: 7.5,
    filter: ['==', ['get', 'category'], 'med-zoom'],
    layout: {
      'text-field': ['get', 'name'],
      'text-size': ['get', 'textSize'],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-allow-overlap': true,
      'text-ignore-placement': false,
      'text-offset': [0, 0],
      'text-justify': 'center',
      'text-anchor': 'center',
    },
    paint: {
      'text-color': '#1e3a8a', // Premium deep navy blue
      'text-halo-color': '#ffffff',
      'text-halo-width': 2,
      'text-halo-blur': 0.5,
    },
  });
}

