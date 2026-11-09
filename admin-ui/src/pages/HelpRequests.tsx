import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { LifeBuoy, Trash2, MapPin, Calendar, User } from 'lucide-react';

export default function HelpRequests() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/help-requests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (Array.isArray(json)) setRequests(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa yêu cầu hỗ trợ này?')) return;
    try {
      const res = await fetch(`/api/admin/help-requests/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchRequests();
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '--';
    return new Date(dateString).toLocaleString('vi-VN');
  };

  return (
    <div className="p-6 bg-slate-50 min-h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <LifeBuoy className="text-indigo-600" /> Yêu cầu Hỗ trợ (Help Requests)
          </h2>
          <p className="text-slate-500 mt-1">Quản lý các yêu cầu cần tư vấn, mua/thuê nhà từ khách hàng.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                  <th className="py-3 px-4 font-medium">Người đăng</th>
                  <th className="py-3 px-4 font-medium min-w-[250px]">Nội dung yêu cầu</th>
                  <th className="py-3 px-4 font-medium min-w-[200px]">Vị trí</th>
                  <th className="py-3 px-4 font-medium">Thời gian</th>
                  <th className="py-3 px-4 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {requests.map(req => (
                  <tr key={req._id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                          <User size={16} />
                        </div>
                        <div>
                          <div className="font-medium text-slate-800 text-sm">{req.user?.name || 'Khách ẩn danh'}</div>
                          {req.user?.id && <div className="text-xs text-slate-500 truncate max-w-[120px]">{req.user.id}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800 text-sm mb-1">{req.name}</div>
                      <div className="text-sm text-slate-600 line-clamp-2">{req.description}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-start gap-1 text-sm text-slate-600">
                        <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                        <span className="line-clamp-2">{req.location || 'Không xác định'}</span>
                      </div>
                      {req.coordinates && (
                        <div className="text-xs text-slate-400 ml-5 mt-1 font-mono">
                          [{req.coordinates[0]?.toFixed(4)}, {req.coordinates[1]?.toFixed(4)}]
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="flex items-center gap-1 text-slate-600"><Calendar size={12}/> Tạo: {formatDate(req.createdAt)}</span>
                        {req.expirationDate && (
                          <span className="flex items-center gap-1 text-red-500 font-medium">Hết hạn: {formatDate(req.expirationDate)}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => handleDelete(req._id)} className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors" title="Xóa yêu cầu">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}

                {requests.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">Chưa có yêu cầu hỗ trợ nào.</td>
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
