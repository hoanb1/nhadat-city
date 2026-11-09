import { Users, FileText, Activity, AlertCircle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useEffect, useState } from 'react'
import { useAuth, authFetch } from '../lib/AuthContext'

interface DashboardStats {
  totalUsers: number;
  totalListings: number;
  pendingListings: number;
  dailyCrawls: number;
  chartData: any[];
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { token, logout } = useAuth();

  useEffect(() => {
    authFetch('/api/admin/stats', token)
      .then(res => {
        if (res.status === 401 || res.status === 403) {
          logout();
          throw new Error('Unauthorized');
        }
        return res.json();
      })
      .then(json => {
        if (json && json.success) setData(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, logout]);

  if (loading) {
    return <div className="p-6 text-slate-500 animate-pulse">Đang tải dữ liệu tổng quan...</div>;
  }

  if (!data) return <div className="text-red-500 p-6">Lỗi kết nối API!</div>;

  return (
    <div className="flex flex-col gap-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Tổng Người dùng</p>
            <h3 className="text-2xl font-bold text-slate-800">{data.totalUsers.toLocaleString()}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Tin đăng đang live</p>
            <h3 className="text-2xl font-bold text-slate-800">{data.totalListings.toLocaleString()}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Lượt cào (Hôm nay)</p>
            <h3 className="text-2xl font-bold text-slate-800">{data.dailyCrawls.toLocaleString()}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-lg">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Tin chờ duyệt</p>
            <h3 className="text-2xl font-bold text-slate-800">{data.pendingListings.toLocaleString()}</h3>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-6">Tăng trưởng tin đăng & Người dùng</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val/1000}k`} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Line type="monotone" dataKey="listings" stroke="#4338ca" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} name="Tin đăng" />
              <Line type="monotone" dataKey="users" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} name="Người dùng" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
