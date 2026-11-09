'use client';
/**
 * clusterData — Handles fetching map cluster data and building
 * GeoJSON features (including spiderfication for zoom >= 17).
 */
import maplibreGl from 'maplibre-gl';

interface ClusterItem {
  _id: string;
  shortId?: string;
  title?: string;
  totalPrice?: number;
  price?: number;
  area?: number;
  images?: string[];
  count?: number;
  coordinates: [number, number];
  adminunit?: { province?: string; ward?: string };
}

export interface FetchClusterOptions {
  polygonStr: string;
  filterStr: string;
  map: maplibreGl.Map;
  setLoading: (v: boolean) => void;
}

export function buildClusterFeatures(rawData: ClusterItem[], zoom: number): any[] {
  const features: any[] = [];

  // Group by exact coordinates for spiderfication
  const coordGroups: Record<string, ClusterItem[]> = {};
  rawData.forEach((item) => {
    const key = `${item.coordinates[0]},${item.coordinates[1]}`;
    if (!coordGroups[key]) coordGroups[key] = [];
    coordGroups[key].push(item);
  });

  Object.values(coordGroups).forEach((group) => {
    if (group.length > 1 && zoom >= 17) {
      // Spider mode
      const [lng, lat] = group[0].coordinates;
      const n = group.length;

      // Calculate a zoom-dependent radius in degrees so that the screen pixel distance remains constant.
      // Base radius of ~0.00015 degrees at zoom 17.
      const baseRadius17 = Math.max(0.00015, n * 0.00005);
      const radius = baseRadius17 * Math.pow(2, 17 - zoom);

      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { is_spider_center: true, spider_count: n },
      });

      group.forEach((item, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const offLng = lng + radius * Math.cos(angle);
        const offLat = lat + radius * Math.sin(angle);

        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [offLng, offLat] },
          properties: {
            id: item.shortId || item._id,
            title: item.title || '',
            price: item.totalPrice ?? item.price ?? 0,
            imageId: Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : '',
            area: item.area ?? 0,
            count: 1,
            is_spider: true,
            province: item.adminunit?.province ?? '',
            ward: item.adminunit?.ward ?? '',
          },
        });

        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[lng, lat], [offLng, offLat]] },
          properties: { is_spider_line: true },
        });
      });
    } else {
      group.forEach((item) => {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: item.coordinates },
          properties: {
            id: item.shortId || item._id,
            title: item.title || '',
            price: item.totalPrice ?? item.price ?? 0,
            imageId: Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : '',
            count: item.count ?? 1,
            province: item.adminunit?.province ?? '',
            ward: item.adminunit?.ward ?? '',
            area: item.area ?? 0,
          },
        });
      });
    }
  });

  return features;
}

export async function fetchProjectMapClusters({ polygonStr, filterStr, map, setLoading }: FetchClusterOptions) {
  const sep = filterStr ? '&' : '';
  setLoading(true);
  try {
    const res = await fetch(`/api/projects/map-clusters?limit=2000&polygon=${polygonStr}${sep}${filterStr}`);
    const mapJson = await res.json();

    if (mapJson.success && map && map.style) {
      const source = map.getSource('listings') as maplibreGl.GeoJSONSource;
      if (!source) return;

      const zoom = map.getZoom();
      const rawData = (mapJson.data as ClusterItem[]).filter(
        (item) => Array.isArray(item.coordinates) && item.coordinates.length === 2,
      );

      const features = buildClusterFeatures(rawData, zoom);
      
      const points = features.filter((f) => f.geometry.type === 'Point');
      const lines = features.filter((f) => f.geometry.type === 'LineString');

      source.setData({ type: 'FeatureCollection', features: points });
      
      const linesSource = map.getSource('listings-spider-lines') as maplibreGl.GeoJSONSource;
      if (linesSource) {
        linesSource.setData({ type: 'FeatureCollection', features: lines });
      }
    }
  } catch (err) {
    console.error('[Map] Cluster fetch failed:', err);
  } finally {
    setLoading(false);
  }
}
