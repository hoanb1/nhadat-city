"use client";

import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface AnomalyBadgeProps {
  propertyData: {
    property_type_name: string;
    province_name: string;
    district_name: string;
    ward_name: string;
    area: number;
    listed_price: number;
  };
}

export default function AnomalyBadge({ propertyData }: AnomalyBadgeProps) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{ is_anomaly: boolean; anomaly_score: number; message: string } | null>(null);

  useEffect(() => {
    if (!propertyData.listed_price || !propertyData.area) {
      setLoading(false);
      return;
    }

    fetch('/api/ml/detect-anomaly', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(propertyData),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setResult(data.data);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [propertyData]);

  if (loading) return <div className="animate-pulse bg-gray-200 h-6 w-32 rounded mt-2"></div>;
  if (!result) return null;

  if (result.is_anomaly || result.anomaly_score < -0.45) {
    return (
      <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm font-medium w-fit">
        <AlertTriangle size={16} />
        <span>AI Cảnh báo: Mức giá có dấu hiệu bất thường so với khu vực!</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-md text-sm font-medium w-fit">
      <ShieldCheck size={16} />
      <span>AI Xác nhận: Mức giá an toàn</span>
    </div>
  );
}
