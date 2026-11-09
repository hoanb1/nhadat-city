import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Activity, Cpu, HardDrive, Server, Clock, RefreshCw } from 'lucide-react';

interface ServerStats {
  cpu: { model: string; cores: number; load: number[] };
  memory: { total: number; used: number; free: number; percent: number };
  disk: { total: number; used: number; free: number; percent: number };
  uptime: string;
}

export default function ServerMonitor() {
  const { token } = useAuth();
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [flushing, setFlushing] = useState(false);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Tự động làm mới mỗi 10s
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const resStats = fetch('/api/admin/server-stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resHealth = fetch('/api/admin/system/health', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const [statsJson, healthJson] = await Promise.all([
        (await resStats).json(),
        (await resHealth).json()
      ]);

      if (statsJson.success) setStats(statsJson.data);
      if (healthJson.success) setHealth(healthJson.connections);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const flushCache = async () => {
    if (!confirm('Bạn có chắc chắn muốn dọn dẹp toàn bộ Cache? Toàn bộ phiên lưu nháp và cấu hình đệm sẽ bị xóa!')) return;
    setFlushing(true);
    try {
      const res = await fetch('/api/admin/system/cache-flush', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      alert(json.message);
      fetchStats();
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi dọn dẹp cache!');
    } finally {
      setFlushing(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading && !stats) {
    return (
      <div className="flex justify-center items-center min-h-[600px] bg-white rounded-xl shadow-sm">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Server className="text-indigo-600" /> Server Monitor
          </h2>
          <p className="text-slate-500 mt-1">Giám sát tài nguyên hệ thống theo thời gian thực.</p>
        </div>
        <button onClick={fetchStats} className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 hover:text-indigo-600 transition-colors shadow-sm flex items-center gap-2">
          <RefreshCw size={18} /> Làm mới
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Uptime Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm col-span-1 md:col-span-2 lg:col-span-3 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Clock size={24} />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500 mb-1">Thời gian hoạt động (Uptime)</div>
              <div className="text-xl font-bold text-slate-800">{stats.uptime}</div>
              <div className="text-xs text-slate-400 mt-1">Hệ điều hành Ubuntu Linux</div>
            </div>
          </div>

          {/* CPU Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                <Cpu size={20} />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">CPU Usage</h3>
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <div className="text-sm text-slate-600 mb-2 font-medium">{stats.cpu.model} ({stats.cpu.cores} Cores)</div>
              <div className="mb-2">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">Load Avg (1m)</span>
                  <span className="font-bold text-slate-800">{stats.cpu.load[0].toFixed(2)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className={`h-2 rounded-full ${stats.cpu.load[0] > stats.cpu.cores ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min((stats.cpu.load[0] / stats.cpu.cores) * 100, 100)}%` }}></div>
                </div>
              </div>
              <div className="text-xs text-slate-500">Load trung bình trong 5m: {stats.cpu.load[1].toFixed(2)} | 15m: {stats.cpu.load[2].toFixed(2)}</div>
            </div>
          </div>

          {/* RAM Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
                <Activity size={20} />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">Memory (RAM)</h3>
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex justify-between text-4xl font-black text-slate-800 mb-4">
                {stats.memory.percent}%
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 mb-4">
                <div className={`h-3 rounded-full ${stats.memory.percent > 85 ? 'bg-red-500' : stats.memory.percent > 60 ? 'bg-amber-500' : 'bg-purple-500'}`} style={{ width: `${stats.memory.percent}%` }}></div>
              </div>
              <div className="flex justify-between text-sm">
                <div className="text-slate-500">Đã dùng: <span className="font-medium text-slate-800">{formatBytes(stats.memory.used)}</span></div>
                <div className="text-slate-500">Tổng: <span className="font-medium text-slate-800">{formatBytes(stats.memory.total)}</span></div>
              </div>
            </div>
          </div>

          {/* Disk Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                <HardDrive size={20} />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">Disk Usage</h3>
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex justify-between text-4xl font-black text-slate-800 mb-4">
                {stats.disk.percent}%
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 mb-4">
                <div className={`h-3 rounded-full ${stats.disk.percent > 90 ? 'bg-red-500' : stats.disk.percent > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${stats.disk.percent}%` }}></div>
              </div>
              <div className="flex justify-between text-sm">
                <div className="text-slate-500">Trống: <span className="font-medium text-slate-800">{formatBytes(stats.disk.free)}</span></div>
                <div className="text-slate-500">Tổng: <span className="font-medium text-slate-800">{formatBytes(stats.disk.total)}</span></div>
              </div>
            </div>
          </div>

        </div>
      )}

      {health && (
        <div className="mt-8 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-800">Trạng thái Kết nối & Dịch vụ</h3>
            <button 
              onClick={flushCache} 
              disabled={flushing}
              className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {flushing ? 'Đang dọn dẹp...' : 'Dọn dẹp Cache (Flush Redis)'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500 font-medium mb-1">MongoDB (Database)</div>
                <div className="font-bold text-slate-800">{health.mongodb}</div>
              </div>
              <div className={`w-3 h-3 rounded-full ${health.mongodb === 'Connected' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
            </div>
            
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500 font-medium mb-1">Redis (Cache)</div>
                <div className="font-bold text-slate-800">{health.redis}</div>
                <div className="text-xs text-slate-400 mt-1">{health.redisKeys} keys đang lưu</div>
              </div>
              <div className={`w-3 h-3 rounded-full ${health.redis === 'Connected' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
            </div>
            
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500 font-medium mb-1">Milvus (AI Vector DB)</div>
                <div className="font-bold text-slate-800">{health.milvus}</div>
              </div>
              <div className={`w-3 h-3 rounded-full ${health.milvus === 'Connected' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
