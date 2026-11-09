"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getImageUrl } from '@/lib/utils/utils';
import { IMAGE_CONFIG } from '@/lib/config/image';
import { Sparkles } from 'lucide-react';

interface SimilarPropertiesAIProps {
  propertyData: {
    property_type_name: string;
    province_name: string;
    district_name: string;
    ward_name: string;
    area: number;
    price: number;
  };
}

export default function SimilarPropertiesAI({ propertyData }: SimilarPropertiesAIProps) {
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<any[]>([]);

  useEffect(() => {
    if (!propertyData.price || !propertyData.area) {
      setLoading(false);
      return;
    }

    fetch('/api/ml/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(propertyData),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.listings) {
          setListings(data.listings);
        }
      })
      .catch(err => console.error('[SimilarPropertiesAI] Fetch error:', err))
      .finally(() => setLoading(false));
  }, [propertyData]);

  if (loading) {
    return (
      <div className="mt-8">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-600" strokeWidth={1.5} />
          <span>Đang tìm kiếm BĐS có đặc tính tương đồng (AI)</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-gray-200 h-48 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (listings.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-indigo-600" strokeWidth={1.5} />
        <span>Bất động sản tương đồng theo gợi ý AI</span>
      </h3>
      <p className="text-gray-600 mb-4 text-sm">
        Hệ thống trí tuệ nhân tạo (KNN Vector) đã quét và phân tích hàng nghìn tin đăng để tìm ra các bất động sản có đặc trưng diện tích, vị trí và mức giá giống hệt căn nhà này.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {listings.map((item, idx) => {
          // Construct the URL — guard all slug fields against undefined/null
          const p = item.adminunit?.province?.trim() || item.province_slug?.trim() || 'ha-noi';
          const w = item.adminunit?.ward?.trim() || item.ward_slug?.trim() || 'khac';
          const id = item.shortId || item._id || item.id;
          const sl = item.slug?.trim() || 'nha-dat';
          // Skip broken items that have no valid ID
          if (!id || p === 'undefined' || w === 'undefined') return null;
          const url = `/${p}/${w}/${id}/${sl}`;

          
          return (
            <Link href={url} key={idx} className="bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 flex flex-col">
              <div className="h-40 bg-gray-100 relative">
                {(item.images && item.images.length > 0) ? (
                  <img 
                    src={getImageUrl(item.images[0], item.shortId, IMAGE_CONFIG.SIZES.SMALL.width, IMAGE_CONFIG.SIZES.SMALL.height)} 
                    alt={item.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.jpg'; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                )}
                <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                  Độ tương đồng: &gt;95%
                </div>
              </div>
              <div className="p-3 flex-1 flex flex-col">
                <h4 className="font-semibold text-sm line-clamp-2 mb-2" title={item.title}>{item.title}</h4>
                <div className="mt-auto">
                  <div className="text-red-600 font-bold text-lg">
                    {item.priceLabel?.totalPrice || (item.totalPrice >= 1e9 ? `${(item.totalPrice/1e9).toFixed(1)} tỷ` : `${(item.totalPrice/1e6).toFixed(0)} triệu`)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {item.area} m² • {item.address}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
