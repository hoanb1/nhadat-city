'use client';

import { useState } from 'react';
import { useMapContext } from './MapContext';
import dynamic from 'next/dynamic';

const MeasurementTool = dynamic(() => import('./MeasurementTool'), { ssr: false });
const ChatWidget = dynamic(() => import('./ChatWidget').then(mod => mod.ChatWidget), { ssr: false });
const PriceTrendChart = dynamic(() => import('../Statistics/PriceTrendChart').then(mod => mod.PriceTrendChart), { ssr: false });
const LayerListClient = dynamic(() => import('./LayerListClient'), { ssr: false });
import { IconPlus, IconMinus, IconCurrentLocation, IconStack2, IconRuler, IconChartBar, IconSparkles, IconMaximize, IconMinimize } from '@tabler/icons-react';

export default function MapControlsDock() {
  const { map, isMapFullscreen, setIsMapFullscreen } = useMapContext();
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChartOpen, setIsChartOpen] = useState(false);

  const zoomIn = () => map?.zoomIn();
  const zoomOut = () => map?.zoomOut();
  const geolocate = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        map?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 14,
        });
      });
    }
  };

  return (
    <>
      {/* Map tool controls: zoom, geolocate, layers, measure, chart, fullscreen */}
      <div className="absolute right-4 bottom-10 flex flex-col gap-3 z-10">
        {/* Fullscreen Toggle */}
        <div className="flex flex-col bg-white rounded-lg shadow-md overflow-hidden">
          <button 
            className={`w-10 h-10 flex items-center justify-center bg-white border-none text-[1.2rem] cursor-pointer transition-colors ${isMapFullscreen ? 'text-indigo-600 bg-indigo-50 font-bold' : 'text-slate-700 hover:bg-slate-50 hover:text-indigo-600'}`}
            onClick={() => setIsMapFullscreen(prev => !prev)}
            title={isMapFullscreen ? 'Thu nhỏ bản đồ' : 'Toàn màn hình bản đồ'}
            aria-label={isMapFullscreen ? 'Thu nhỏ bản đồ' : 'Toàn màn hình bản đồ'}
          >
            {isMapFullscreen ? <IconMinimize width="1em" height="1em" /> : <IconMaximize width="1em" height="1em" />}
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex flex-col bg-white rounded-lg shadow-md overflow-hidden">
          <button className="w-10 h-10 flex items-center justify-center bg-white border-none border-b border-slate-200 text-slate-700 text-[1.2rem] cursor-pointer hover:bg-slate-50 hover:text-blue-600 transition-colors" onClick={zoomIn} title="Phóng to" aria-label="Phóng to"><IconPlus width="1em" height="1em"  /></button>
          <button className="w-10 h-10 flex items-center justify-center bg-white border-none text-slate-700 text-[1.2rem] cursor-pointer hover:bg-slate-50 hover:text-blue-600 transition-colors" onClick={zoomOut} title="Thu nhỏ" aria-label="Thu nhỏ"><IconMinus width="1em" height="1em"  /></button>
        </div>

        {/* Geolocation */}
        <div className="flex flex-col bg-white rounded-lg shadow-md overflow-hidden">
          <button className="w-10 h-10 flex items-center justify-center bg-white border-none text-slate-700 text-[1.2rem] cursor-pointer hover:bg-slate-50 hover:text-blue-600 transition-colors" onClick={geolocate} title="Vị trí của tôi" aria-label="Vị trí của tôi"><IconCurrentLocation width="1em" height="1em"  /></button>
        </div>

        {/* Layers */}
        <div className="flex flex-col bg-white rounded-lg shadow-md overflow-visible relative">
          <button className={`w-10 h-10 flex items-center justify-center bg-white border-none text-slate-700 text-[1.2rem] cursor-pointer transition-colors ${showLayerMenu ? 'bg-slate-50 text-blue-600' : 'hover:bg-slate-50 hover:text-blue-600'}`} onClick={() => setShowLayerMenu(!showLayerMenu)} title="Lớp bản đồ" aria-label="Lớp bản đồ">
            <IconStack2 width="1em" height="1em"  />
          </button>
          <div className="absolute right-[50px] bottom-0 bg-white rounded-lg shadow-[0_2px_15px_rgba(0,0,0,0.2)] w-[320px] max-h-[80vh] overflow-hidden flex flex-col" style={{ display: showLayerMenu ? 'block' : 'none' }}>
            <LayerListClient />
          </div>
        </div>

        {/* Rule / Measure */}
        <div className="flex flex-col bg-white rounded-lg shadow-md overflow-hidden">
          <button className={`w-10 h-10 flex items-center justify-center bg-white border-none text-[1.2rem] cursor-pointer transition-colors ${measuring ? 'bg-slate-50 text-blue-600' : 'text-slate-700 hover:bg-slate-50 hover:text-blue-600'}`} onClick={() => setMeasuring(!measuring)} title="Thước đo khoảng cách (Quy Hoạch)" aria-label="Thước đo"><IconRuler width="1em" height="1em"  /></button>
        </div>

        {/* Chart */}
        <div className="flex flex-col bg-white rounded-lg shadow-md overflow-hidden">
          <button 
            className="w-10 h-10 flex items-center justify-center bg-white border-none text-slate-700 text-[1.2rem] cursor-pointer hover:bg-slate-50 hover:text-blue-600 transition-colors" 
            title="Biểu đồ báo cáo" 
            aria-label="Biểu đồ"
            onClick={() => setIsChartOpen(true)}
          >
            <IconChartBar width="1em" height="1em"  />
          </button>
        </div>
      </div>

      {/* AI Chat FAB — left on mobile (avoids map tools), right on desktop */}
      <div className="fixed bottom-6 left-3 md:left-auto md:right-3 z-[9998] flex flex-col items-end gap-3">
        <ChatWidget isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          title="AI Tư Vấn Bất Động Sản"
          aria-label="Mở chat AI"
          style={{
            width: 56, height: 56,
            borderRadius: '50%',
            background: isChatOpen
              ? '#1d4ed8'
              : 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
            border: 'none',
            boxShadow: '0 4px 24px rgba(37,99,235,0.45)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white',
            transition: 'transform 0.2s, box-shadow 0.2s',
            position: 'relative',
            transform: isChatOpen ? 'scale(0.92)' : 'scale(1)',
          }}
        >
          <IconSparkles size={26} />
          {/* Pulse ring when closed */}
          {!isChatOpen && (
            <span style={{
              position: 'absolute', inset: -4,
              borderRadius: '50%',
              border: '2px solid rgba(37,99,235,0.35)',
              animation: 'pulse-ring 2s ease-out infinite',
            }} />
          )}
        </button>
      </div>

      <PriceTrendChart isOpen={isChartOpen} onClose={() => setIsChartOpen(false)} />
      <MeasurementTool active={measuring} onToggle={() => setMeasuring(false)} />

      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.8; }
          70%  { transform: scale(1.4); opacity: 0; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </>
  );
}
