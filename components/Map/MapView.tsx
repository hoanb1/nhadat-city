'use client';

import { useEffect, useRef } from 'react';

interface Props {
  province: string;
  ward: string;
  items: any[];
}

// MapLibre is dynamically imported here — will NOT be in initial JS bundle
export default function MapView({ province, ward, items }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let cleanup: (() => void) | undefined;

    // Dynamic import — MapLibre only loads when this component mounts
    import('maplibre-gl').then((maplibre) => {
      const map = new maplibre.Map({
        container: mapContainerRef.current!,
        style: `${process.env.NEXT_PUBLIC_MAP_API_URL}/style.json`,
        center: [105.8412, 21.0245], // Default: Hà Nội
        zoom: 14,
        attributionControl: false,
      });

      mapRef.current = map;

      map.on('load', () => {
        // Add markers for items
        if (items.length > 0) {
          const geojson = {
            type: 'FeatureCollection' as const,
            features: items
              .filter((item) => item.coordinates?.coordinates)
              .map((item) => ({
                type: 'Feature' as const,
                geometry: item.coordinates,
                properties: {
                  id: item._id,
                  title: item.title,
                  price: item.totalPrice,
                },
              })),
          };

          map.addSource('listings', {
            type: 'geojson',
            data: geojson,
            cluster: true,
            clusterMinPoints: 5,
          });

          map.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'listings',
            filter: ['has', 'point_count'],
            paint: {
              'circle-color': '#3b82f6',
              'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 30, 40],
              'circle-opacity': 0.8,
            },
          });

          map.addLayer({
            id: 'unclustered-point',
            type: 'circle',
            source: 'listings',
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-color': '#ef4444',
              'circle-radius': 8,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#fff',
            },
          });
        }
      });

      cleanup = () => map.remove();
    });

    return () => cleanup?.();
  }, []);

  return (
    <div
      ref={mapContainerRef}
      className="map-view"
      style={{ width: '100%', height: '400px' }}
      aria-label="Bản đồ bất động sản"
    />
  );
}
