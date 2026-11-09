'use client';

import { useEffect, useState } from 'react';
import { useMapContext } from './MapContext';
import length from '@turf/length';
import { featureCollection, lineString } from '@turf/helpers';

export default function MeasurementTool({ active, onToggle }: { active: boolean, onToggle: () => void }) {
  const { map } = useMapContext();
  const [points, setPoints] = useState<[number, number][]>([]);
  const [distance, setDistance] = useState<number>(0);

  useEffect(() => {
    if (!map) return;

    if (!active) {
      setPoints([]);
      setDistance(0);
      if (map.getSource('measure-source')) {
        (map.getSource('measure-source') as any).setData(featureCollection([]));
      }
      map.getCanvas().style.cursor = '';
      return;
    }

    map.getCanvas().style.cursor = 'crosshair';

    // Ensure source and layers exist
    if (!map.getSource('measure-source')) {
      map.addSource('measure-source', {
        type: 'geojson',
        data: featureCollection([])
      });

      map.addLayer({
        id: 'measure-lines',
        type: 'line',
        source: 'measure-source',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#f59e0b', 'line-width': 3 }
      });

      map.addLayer({
        id: 'measure-points',
        type: 'circle',
        source: 'measure-source',
        paint: { 'circle-color': '#fff', 'circle-radius': 5, 'circle-stroke-width': 2, 'circle-stroke-color': '#f59e0b' }
      });
    }

    const onClick = (e: any) => {
      const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      setPoints(prev => {
        const next = [...prev, coords];
        
        // Update map data
        const features: any[] = next.map(pt => ({ type: 'Feature', geometry: { type: 'Point', coordinates: pt } }));
        if (next.length > 1) {
          features.push(lineString(next));
          setDistance(length(lineString(next), { units: 'kilometers' }));
        }
        (map.getSource('measure-source') as any).setData(featureCollection(features));
        
        return next;
      });
    };

    map.on('click', onClick);

    return () => {
      map.off('click', onClick);
      if (active) map.getCanvas().style.cursor = '';
    };
  }, [map, active]);

  if (!active) return null;

  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white py-3 px-5 rounded-lg shadow-[0_4px_15px_rgba(0,0,0,0.15)] z-20 text-center border border-slate-200">
      <h4 className="m-0 mb-2 text-slate-800 text-[1rem]">Thước đo khoảng cách</h4>
      <p className="text-[0.9rem] text-slate-500 mb-3">
        Click lên bản đồ để vẽ đường đo.<br />
        <strong>Khoảng cách:</strong> <span className="text-blue-600 font-bold">{distance < 1 ? (distance * 1000).toFixed(0) + ' m' : distance.toFixed(2) + ' km'}</span>
      </p>
      <button className="bg-slate-100 border-none py-1.5 px-3 rounded text-slate-700 font-medium mx-1 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => { setPoints([]); setDistance(0); (map?.getSource('measure-source') as any)?.setData(featureCollection([])); }}>Xoá</button>
      <button className="bg-slate-100 border-none py-1.5 px-3 rounded text-slate-700 font-medium mx-1 cursor-pointer hover:bg-slate-200 transition-colors" onClick={onToggle}>Đóng</button>
    </div>
  );
}
