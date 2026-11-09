'use client';
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { BarChart3, TrendingUp, BadgeDollarSign, Activity } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const TYPE_STROKE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function StatisticsDashboard({ data, loading }: { data: any, loading: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (loading || !mounted) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <div>Đang phân tích dữ liệu...</div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 flex flex-col justify-center">
          <div className="text-blue-600 text-[0.85rem] font-bold uppercase tracking-wide mb-1 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" strokeWidth={1.5} />
            <span>Tổng lượng tin đăng</span>
          </div>
          <div className="text-3xl font-extrabold text-blue-900">{data.overall.totalListings.toLocaleString()} <span className="text-lg font-semibold text-blue-600/70">tin</span></div>
        </div>
        <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 flex flex-col justify-center">
          <div className="text-emerald-600 text-[0.85rem] font-bold uppercase tracking-wide mb-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" strokeWidth={1.5} />
            <span>Giá trung bình / m²</span>
          </div>
          <div className="text-3xl font-extrabold text-emerald-900">{(data.overall.avgPriceM2 / 1000000).toFixed(1)} <span className="text-lg font-semibold text-emerald-600/70">Triệu đ</span></div>
        </div>
        <div className="bg-purple-50 p-5 rounded-2xl border border-purple-100 flex flex-col justify-center">
          <div className="text-purple-600 text-[0.85rem] font-bold uppercase tracking-wide mb-1 flex items-center gap-2">
            <BadgeDollarSign className="w-4 h-4" strokeWidth={1.5} />
            <span>Tổng giá trị TB</span>
          </div>
          <div className="text-3xl font-extrabold text-purple-900">{(data.overall.avgPrice / 1000000000).toFixed(2)} <span className="text-lg font-semibold text-purple-600/70">Tỷ đ</span></div>
        </div>
      </div>

      {/* Outlier filter badge */}
      {data.outlierInfo && data.outlierInfo.filteredCount > 0 && (
        <div className="flex items-center gap-2 text-[0.75rem] text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 -mt-2">
          <Activity className="w-4 h-4 text-slate-500 shrink-0" strokeWidth={1.5} />
          <span>
            Đã lọc giá trị ngoại lai bằng Z-score (±6σ).
            Ngưỡng hợp lệ:{' '}
            <strong className="text-slate-600">{data.outlierInfo.dynamicMin} – {data.outlierInfo.dynamicMax} Triệu/m²</strong>
            {' '}(Giá TB: {data.outlierInfo.mean ? (data.outlierInfo.mean / 1_000_000).toFixed(1) : '--'} Triệu/m²,
            σ: {data.outlierInfo.stdDev ? (data.outlierInfo.stdDev / 1_000_000).toFixed(1) : '--'} Triệu/m²)
          </span>
        </div>
      )}

      {/* Main Chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
          Biến động giá & nguồn cung
        </h3>
        <div className="h-[320px] w-full" style={{ minHeight: 0, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <LineChart data={data.trends} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `${(val / 1000000).toFixed(0)}`} dx={-10} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={10} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}
                formatter={(value: any, name: any) => [name === 'avgPriceM2' ? `${(value / 1000000).toFixed(1)} Triệu/m²` : `${value} tin`, name === 'avgPriceM2' ? 'Giá m² (Triệu)' : 'Số lượng tin']}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '13px', fontWeight: 600, color: '#475569' }} />
              <Line yAxisId="left" type="monotone" dataKey="avgPriceM2" name="Giá m² (Triệu)" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 7 }} />
              <Line yAxisId="right" type="monotone" dataKey="count" name="Số lượng tin" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 7 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Price by Property Type Trend */}
      {data.priceByType && data.priceByType.length > 0 && data.topTypes && data.topTypes.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-700 mb-1 flex items-center gap-2">
            Biến động giá theo loại BĐS
            <span className="text-xs font-normal text-slate-400">(Triệu đ/m²)</span>
          </h3>
          <p className="text-xs text-slate-400 mb-5">So sánh giá trung bình theo tháng giữa các phân khúc</p>
          <div className="h-[300px] w-full" style={{ minHeight: 0, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={data.priceByType} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${v}tr`} dx={-5} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any, name: any) => {
                    const found = data.topTypes.find((t: any) => t.key === name);
                    return [`${value} Triệu/m²`, found ? found.label : name];
                  }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#475569', paddingTop: '12px' }}
                  formatter={(value: string) => {
                    const found = data.topTypes.find((t: any) => t.key === value);
                    return found ? found.label : value;
                  }}
                />
                {data.topTypes.map((type: any, idx: number) => (
                  <Line
                    key={type.key}
                    type="monotone"
                    dataKey={type.key}
                    name={type.key}
                    stroke={TYPE_STROKE[idx % TYPE_STROKE.length]}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Grid of Sub-Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
        {/* Price Segments */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wide">Phân khúc giá</h3>
          <div className="h-[220px] w-full" style={{ minHeight: 0, minWidth: 0 }}>
            {data.priceSegments && data.priceSegments.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={data.priceSegments} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} interval={0} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" name="Số tin" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                    {data.priceSegments.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="text-sm text-slate-400">Không có dữ liệu</div>}
          </div>
        </div>

        {/* Property Types */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wide">Loại hình BĐS</h3>
          <div className="h-[220px] w-full" style={{ minHeight: 0, minWidth: 0 }}>
            {data.propertyTypes && data.propertyTypes.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={data.propertyTypes}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="name"
                  >
                    {data.propertyTypes.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="text-sm text-slate-400">Không có dữ liệu</div>}
          </div>
        </div>

        {/* Directions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wide">Phân bổ hướng nhà</h3>
          <div className="h-[220px] w-full" style={{ minHeight: 0, minWidth: 0 }}>
            {data.directions && data.directions.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={data.directions} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" name="Số tin" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                    {data.directions.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="text-sm text-slate-400">Không có dữ liệu</div>}
          </div>
        </div>

        {/* Area Segments */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wide">Phân khúc diện tích</h3>
          <div className="h-[220px] w-full" style={{ minHeight: 0, minWidth: 0 }}>
            {data.areaSegments && data.areaSegments.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={data.areaSegments} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} dx={-5} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" name="Số lượng" fill="#14b8a6" radius={[0, 4, 4, 0]}>
                    {data.areaSegments.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 6) % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="text-sm text-slate-400">Không có dữ liệu</div>}
          </div>
        </div>

        {/* Listing Modes (Sale vs Rent) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wide">Nhu cầu bán / cho thuê</h3>
          <div className="h-[220px] w-full" style={{ minHeight: 0, minWidth: 0 }}>
            {data.listingModes && data.listingModes.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={data.listingModes}
                    cx="50%"
                    cy="50%"
                    innerRadius={0}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="name"
                    label={({ cx, cy, midAngle = 0, innerRadius, outerRadius, value, index }: any) => {
                      const RADIAN = Math.PI / 180;
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={14} fontWeight="bold">{value > 0 ? value : ''}</text>;
                    }}
                  >
                    <Cell key="cell-0" fill="#3b82f6" /> {/* Bán */}
                    <Cell key="cell-1" fill="#ef4444" /> {/* Thuê */}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="text-sm text-slate-400">Không có dữ liệu</div>}
          </div>
        </div>

        {/* Facade Segments */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wide">Mặt tiền / ngõ (m)</h3>
          <div className="h-[220px] w-full" style={{ minHeight: 0, minWidth: 0 }}>
            {data.facadeSegments && data.facadeSegments.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={data.facadeSegments} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} interval={0} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" name="Số tin" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                    {data.facadeSegments.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="text-sm text-slate-400">Không có dữ liệu</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
