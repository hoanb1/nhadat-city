import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { BarChart3, TrendingUp, Users, MousePointerClick, Activity } from 'lucide-react';

export default function Analytics() {
  const { token } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/admin/analytics', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
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

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(num);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[600px] bg-white rounded-xl shadow-sm">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <BarChart3 className="text-indigo-600" /> SEO & Analytics
        </h2>
        <p className="text-slate-500 mt-1">Báo cáo hiệu suất truy cập và từ khóa tìm kiếm (Số liệu thực tế).</p>
      </div>

      {data && (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <MousePointerClick size={24} />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500 mb-1">Lượt truy cập (Page Views)</div>
                <div className="text-2xl font-bold text-slate-800">{formatNumber(data.overview.pageViews)}</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users size={24} />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500 mb-1">Người dùng (Visitors)</div>
                <div className="text-2xl font-bold text-slate-800">{formatNumber(data.overview.uniqueVisitors)}</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Activity size={24} />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500 mb-1">Thời gian trung bình</div>
                <div className="text-2xl font-bold text-slate-800">{data.overview.avgSessionDuration}</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp size={24} />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500 mb-1">Tỷ lệ thoát (Bounce Rate)</div>
                <div className="text-2xl font-bold text-slate-800">{data.overview.bounceRate}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Placeholder */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
              <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3">Biểu đồ Truy cập (30 ngày)</h3>
              <div className="h-64 flex items-end justify-between gap-1 mt-4">
                {data.chartData.map((d: any, idx: number) => {
                  const heightPercent = Math.min((d.views / 6000) * 100, 100);
                  return (
                    <div key={idx} className="w-full h-full flex flex-col justify-end items-center group relative cursor-pointer">
                      <div className="w-full bg-indigo-500 rounded-t-sm hover:bg-indigo-400 transition-colors" style={{ height: `${heightPercent}%` }}></div>
                      {/* Tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-slate-800 text-white text-xs py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none">
                        {d.date}: {formatNumber(d.views)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-xs text-slate-400">
                <span>{data.chartData[0].date}</span>
                <span>{data.chartData[15].date}</span>
                <span>{data.chartData[29].date}</span>
              </div>
            </div>

            {/* Top Keywords */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <h3 className="font-bold text-slate-800">Top Từ Khóa SEO</h3>
              </div>
              <div className="p-0 overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-white border-b border-slate-100 text-xs text-slate-500">
                    <tr>
                      <th className="py-2 px-4 font-medium">Từ khóa</th>
                      <th className="py-2 px-4 font-medium text-right">Volume</th>
                      <th className="py-2 px-4 font-medium text-center">Top</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.topKeywords.map((kw: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-700 text-sm">{kw.keyword}</td>
                        <td className="py-3 px-4 text-right text-slate-500 text-sm">{formatNumber(kw.volume)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${kw.position <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                            {kw.position}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
