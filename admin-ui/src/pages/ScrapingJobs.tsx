import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Play, RefreshCw, Database, AlertCircle, CheckCircle } from 'lucide-react';

interface ScrapingJob {
  _id: string;
  target: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  itemsScraped: number;
  errors: number;
}

export default function ScrapingJobs() {
  const { token } = useAuth();
  const [jobs, setJobs] = useState<ScrapingJob[]>([]);
  const [stats, setStats] = useState({ totalJobs: 0, successJobs: 0, failedJobs: 0, totalListings: 0, totalProjects: 0, validTargets: [] as string[] });
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [target, setTarget] = useState('meeyproject.com');

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/admin/scraping', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setJobs(json.data.logs);
        setStats(json.data.stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const triggerJob = async () => {
    setTriggering(true);
    try {
      const res = await fetch('/api/admin/scraping', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ target })
      });
      if (res.ok) fetchJobs();
    } catch (err) {
      console.error(err);
    } finally {
      setTriggering(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '--';
    return new Date(dateString).toLocaleString('vi-VN');
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'running': return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold"><RefreshCw size={12} className="animate-spin" /> Đang chạy</span>;
      case 'success': return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold"><CheckCircle size={12} /> Hoàn thành</span>;
      case 'failed': return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold"><AlertCircle size={12} /> Thất bại</span>;
      default: return <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">{status}</span>;
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Database className="text-indigo-600" /> Quản lý Scraping
          </h2>
          <p className="text-slate-500 mt-1">Giám sát và khởi chạy các tiến trình tự động lấy dữ liệu.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="text-slate-500 text-sm mb-1">Tổng tiến trình</div>
          <div className="text-3xl font-bold text-slate-800">{stats.totalJobs}</div>
        </div>
        <div className="bg-emerald-50 p-5 rounded-xl shadow-sm border border-emerald-100">
          <div className="text-emerald-600 text-sm mb-1">Thành công</div>
          <div className="text-3xl font-bold text-emerald-700">{stats.successJobs}</div>
        </div>
        <div className="bg-red-50 p-5 rounded-xl shadow-sm border border-red-100">
          <div className="text-red-600 text-sm mb-1">Thất bại</div>
          <div className="text-3xl font-bold text-red-700">{stats.failedJobs}</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8">
        <h3 className="font-bold text-slate-800 mb-4">Khởi chạy Bot thủ công</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <select 
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            {stats.validTargets && stats.validTargets.length > 0 ? (
              stats.validTargets.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))
            ) : (
              <>
                <option value="meeyproject.com">meeyproject.com (Dự án)</option>
                <option value="meeyland.com">meeyland.com (Tin BĐS)</option>
                <option value="tinbds.com/du-an">tinbds.com/du-an (Dự án DP)</option>
                <option value="tinbds.com">tinbds.com (Tin BĐS DP)</option>
              </>
            )}
          </select>
          <button 
            onClick={triggerJob}
            disabled={triggering}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {triggering ? <RefreshCw className="animate-spin" size={18} /> : <Play size={18} />}
            Chạy Bot Ngay
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800">Lịch sử hoạt động</h3>
          <button onClick={fetchJobs} className="text-slate-500 hover:text-indigo-600 p-1">
            <RefreshCw size={16} />
          </button>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-sm bg-white">
                  <th className="py-3 px-4 font-medium">Nguồn</th>
                  <th className="py-3 px-4 font-medium">Bắt đầu</th>
                  <th className="py-3 px-4 font-medium">Kết thúc</th>
                  <th className="py-3 px-4 font-medium text-center">Tin cào được</th>
                  <th className="py-3 px-4 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job._id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-800">{job.target}</td>
                    <td className="py-3 px-4 text-sm text-slate-600">{formatDate(job.startedAt)}</td>
                    <td className="py-3 px-4 text-sm text-slate-600">{formatDate(job.endedAt)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-bold text-indigo-600">{job.itemsScraped}</span>
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(job.status)}
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Chưa có lịch sử cào dữ liệu nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
