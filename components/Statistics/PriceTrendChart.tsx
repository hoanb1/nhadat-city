'use client';
import { useEffect, useState } from 'react';
import { useMapContext } from '../Map/MapContext';
import { StatisticsDashboard } from './StatisticsDashboard';
import { X } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function PriceTrendChart({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { filters, map } = useMapContext();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const fetchStats = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        const f = filters as any;
        if (f.province) query.set('province', f.province);
        if (f.ward) query.set('ward', f.ward);
        if (f.loaiDatId) query.set('loaiDatId', f.loaiDatId.toString());
        
        // Dynamic Spatial Bounds
        if (map) {
          const bounds = map.getBounds();
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          query.set('sw', `${sw.lng},${sw.lat}`);
          query.set('ne', `${ne.lng},${ne.lat}`);
        }
        
        const res = await fetch(`/api/statistics?${query.toString()}`);
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [isOpen, filters]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Thống kê thị trường</h2>
            <div className="text-sm text-slate-500 mt-1">
              Khu vực: <span className="font-medium text-blue-600">{map ? 'Theo khung nhìn hiện tại trên bản đồ' : (filters as any).ward ? `Phường ${(filters as any).ward}, ` : (filters as any).province ? `Tỉnh ${(filters as any).province}` : 'Toàn quốc'}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors" aria-label="Đóng">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <StatisticsDashboard data={data} loading={loading} />
        </div>
      </div>
    </div>
  );
}
