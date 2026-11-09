'use client';
import { useMemo, useState, useEffect } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

function getDynamicField(fields: any[], id: string) {
  return fields?.find((f: any) => f._id === id)?.value || 0;
}

export default function PropertyRadarChart({ listing }: { listing: any }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const data = useMemo(() => {
    if (!listing) return [];

    const area = listing.area || 0;
    const pricePerM2 = listing.pricePerM2 || (area > 0 && listing.totalPrice ? listing.totalPrice / area : 0);
    const priceM2Million = pricePerM2 / 1000000;
    
    const bedrooms = getDynamicField(listing.dynamicFields, 'bedrooms');
    const bathrooms = getDynamicField(listing.dynamicFields, 'bathrooms');
    const facade = getDynamicField(listing.dynamicFields, 'facade');
    
    const amenitiesCount = listing.amenities?.length || 0;
    const isApartment = listing.propertyType === 'can_ho';
    const isStreetHouse = listing.propertyType === 'nha_mat_pho' || listing.propertyType === 'shophouse';

    // 1. Không gian sống
    let spaceScore = 0;
    const areaScore = Math.min(10, Math.max(1, area / 15));
    const roomScore = Math.min(10, (bedrooms * 1.5) + bathrooms);
    spaceScore = isApartment ? (areaScore * 0.7 + roomScore * 0.3) : (areaScore * 0.5 + roomScore * 0.5);
    spaceScore = Math.max(3, Math.round(spaceScore));

    // 2. Giao thông & Vị trí
    let trafficScore = 4;
    if (isApartment) trafficScore = 8; // Apartments usually have good road access
    else {
      if (facade > 10) trafficScore = 10;
      else if (facade >= 5) trafficScore = 8;
      else if (facade >= 3) trafficScore = 6;
      else if (facade > 0) trafficScore = 4;
    }

    // 3. Mức độ cao cấp (Luxury based on price/m2)
    let luxuryScore = 3;
    if (priceM2Million > 200) luxuryScore = 10;
    else if (priceM2Million > 100) luxuryScore = 9;
    else if (priceM2Million > 60) luxuryScore = 7;
    else if (priceM2Million > 30) luxuryScore = 5;

    // 4. Tiềm năng kinh doanh
    let businessScore = 2;
    if (isStreetHouse) businessScore = 10;
    else if (isApartment) businessScore = 4;
    else if (facade >= 5) businessScore = 7;
    else if (facade >= 3) businessScore = 4;

    // 5. Tiện nghi
    let amenityScore = Math.min(10, 3 + amenitiesCount * 1.5);
    if (isApartment) amenityScore = Math.min(10, amenityScore + 2);

    // 6. Nhịp sống / Tiện lợi (Quận vs Huyện)
    let densityScore = 6;
    const districtName = (listing.adminunit?.districtName || '').toLowerCase();
    if (districtName.includes('quận')) densityScore = 9;
    if (districtName.includes('huyện')) densityScore = 5;

    return [
      { subject: 'Không Gian', A: Math.min(10, spaceScore), fullMark: 10 },
      { subject: 'Giao Thông', A: trafficScore, fullMark: 10 },
      { subject: 'Tiện Nghi', A: Math.round(amenityScore), fullMark: 10 },
      { subject: 'Cao Cấp', A: luxuryScore, fullMark: 10 },
      { subject: 'Kinh Doanh', A: businessScore, fullMark: 10 },
      { subject: 'Nhịp Sống', A: densityScore, fullMark: 10 },
    ];
  }, [listing]);

  if (!data || data.length === 0) return null;

  if (!mounted) {
    return (
      <div className="bg-white p-5 border-b border-slate-100 animate-pulse">
        <h2 className="text-[0.9rem] font-bold text-slate-800 m-0 mb-1">Đánh giá chung (Radar)</h2>
        <p className="text-[0.75rem] text-slate-500 mb-4">Biểu đồ phân tích đa giác chấm điểm dựa trên diện tích, tiện ích, vị trí và giá trị.</p>
        <div className="w-full h-[280px] sm:h-[320px] bg-slate-50 rounded-xl mb-4" />
      </div>
    );
  }

  return (
    <div className="bg-white p-5 border-b border-slate-100">
      <h2 className="text-[0.9rem] font-bold text-slate-800 m-0 mb-1">Đánh giá chung (Radar)</h2>
      <p className="text-[0.75rem] text-slate-500 mb-4">Biểu đồ phân tích đa giác chấm điểm dựa trên diện tích, tiện ích, vị trí và giá trị.</p>
      
      <div className="w-full h-[280px] sm:h-[320px] -ml-2" style={{ minHeight: 0, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} />
            <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: '#94a3b8', fontSize: 10 }} tickCount={6} />
            <Tooltip 
              wrapperStyle={{ outline: 'none' }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontSize: '13px', fontWeight: 'bold' }}
              itemStyle={{ color: '#4f46e5' }}
              formatter={(value: any) => [`${value} / 10 điểm`, 'Đánh giá']}
            />
            <Radar name="Bất động sản này" dataKey="A" stroke="#4f46e5" strokeWidth={2} fill="#6366f1" fillOpacity={0.4} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
        {data.map(item => (
          <div key={item.subject} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-md">
            <span className="text-[0.75rem] text-slate-600 font-medium">{item.subject}</span>
            <span className="text-[0.8rem] font-bold text-indigo-600">{item.A}/10</span>
          </div>
        ))}
      </div>
    </div>
  );
}
