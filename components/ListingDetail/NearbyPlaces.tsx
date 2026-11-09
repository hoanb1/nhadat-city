'use client';

import { useEffect, useState } from 'react';
import { GraduationCap, Stethoscope, ShoppingCart, Landmark, TreePine, UtensilsCrossed, MapPin, Navigation, Phone, Globe, Clock, Building } from 'lucide-react';
import { useMapContext } from '@/components/Map/MapContext';

interface POI {
  name: string;
  fullAddress: string;
  distance: number;
  type: string;
  phone?: string;
  website?: string;
  openingHours?: string;
  lat?: number;
  lng?: number;
}

interface LocationContext {
  fullAddress: string;
  road: string;
  suburb: string;
  ward: string;
  district: string;
  city: string;
}

interface Props {
  coordinates?: number[]; // [lng, lat]
}

const CATEGORY_ICONS: Record<string, any> = {
  school: GraduationCap,
  hospital: Stethoscope,
  shopping: ShoppingCart,
  bank: Landmark,
  park: TreePine,
  restaurant: UtensilsCrossed,
};

const CATEGORY_COLORS: Record<string, string> = {
  school: 'from-blue-500 to-cyan-500',
  hospital: 'from-rose-500 to-pink-500',
  shopping: 'from-amber-500 to-orange-500',
  bank: 'from-emerald-500 to-green-500',
  park: 'from-lime-500 to-emerald-500',
  restaurant: 'from-violet-500 to-purple-500',
};

export default function NearbyPlaces({ coordinates }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('school');

  let map: any = null;
  try {
    const context = useMapContext();
    map = context.map;
  } catch (e) {
    // Not in a MapProvider context
  }

  useEffect(() => {
    if (!coordinates || coordinates.length < 2) { setLoading(false); return; }

    const [lng, lat] = coordinates;
    fetch(`/api/nearby?lat=${lat}&lng=${lng}&radius=2000`)
      .then(r => r.json())
      .then(d => { if (d.success) { setData(d.data); setActiveTab(Object.keys(d.data.categories).find(k => d.data.categories[k].length > 0) || 'school'); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [coordinates]);

  if (loading) {
    return (
      <div className="bg-white sm:rounded-2xl sm:border border-slate-200 p-5 sm:p-7 shadow-sm animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-48 mb-4" />
        <div className="h-40 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (!data || data.total === 0) return null;

  const categories = data.categories;
  const labels = data.labels;
  const locationContext: LocationContext | null = data.locationContext;
  const activePOIs: POI[] = categories[activeTab] || [];

  return (
    <div className="bg-white sm:rounded-2xl sm:border border-slate-200 p-5 sm:p-7 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white">
          <Navigation size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Tiện ích xung quanh</h2>
          <p className="text-xs text-slate-500">{data.total} tiện ích trong bán kính 2km</p>
        </div>
      </div>

      {/* Location Context from Nominatim */}
      {locationContext && (locationContext.road || locationContext.suburb) && (
        <div className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-xl mb-4 text-sm text-slate-700">
          <Building size={16} className="text-slate-400 shrink-0 mt-0.5" />
          <div>
            {locationContext.road && <span className="font-semibold">{locationContext.road}</span>}
            {locationContext.suburb && <span>, {locationContext.suburb}</span>}
            {locationContext.ward && <span>, {locationContext.ward}</span>}
            {locationContext.district && <span>, {locationContext.district}</span>}
            {locationContext.city && <span>, {locationContext.city}</span>}
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        {Object.entries(labels).map(([key, label]) => {
          const Icon = CATEGORY_ICONS[key];
          const count = categories[key]?.length || 0;
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-gradient-to-r ' + CATEGORY_COLORS[key] + ' text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {Icon && <Icon size={14} />}
              {label as string}
              {count > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white/20' : 'bg-slate-200'}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* POI List */}
      {activePOIs.length > 0 ? (
        <div className="space-y-2">
          {activePOIs.map((poi, i) => (
            <div 
              key={i} 
              className={`flex items-center justify-between py-2.5 px-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors ${map ? 'cursor-pointer' : ''}`}
              onClick={() => {
                if (map && poi.lng && poi.lat) {
                  map.flyTo({
                    center: [poi.lng, poi.lat],
                    zoom: 16,
                    essential: true
                  });
                }
              }}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                  <MapPin size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800 truncate">{poi.name}</div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                    <span className="capitalize">{poi.type?.replace(/_/g, ' ')}</span>
                    {poi.phone && (
                      <a href={`tel:${poi.phone}`} className="flex items-center gap-0.5 text-blue-600 hover:underline">
                        <Phone size={9} />{poi.phone}
                      </a>
                    )}
                    {poi.openingHours && (
                      <span className="flex items-center gap-0.5">
                        <Clock size={9} />{poi.openingHours}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 ml-2 ${
                poi.distance < 0.5 ? 'bg-emerald-100 text-emerald-700' :
                poi.distance < 1 ? 'bg-blue-100 text-blue-700' :
                'bg-slate-200 text-slate-600'
              }`}>
                {poi.distance < 1 ? `${Math.round(poi.distance * 1000)}m` : `${poi.distance.toFixed(1)}km`}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400 text-sm">
          Không tìm thấy tiện ích loại này trong khu vực
        </div>
      )}

      {/* SEO-friendly text summary (hidden visually but readable by crawlers) */}
      {data.seoSummary && (
        <p className="mt-4 text-xs text-slate-400 leading-relaxed">
          {data.seoSummary}
        </p>
      )}
    </div>
  );
}
