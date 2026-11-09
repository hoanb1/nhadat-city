import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { AlertTriangle, CheckCircle, Clock, ExternalLink } from 'lucide-react';

function makeUrlSlug(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

function getRealEstateUrl(item: any, fallbackId?: string): string {
  if (!item) {
    if (fallbackId) {
      return `https://nhadat.city/ha-noi//${fallbackId}/`;
    }
    return '#';
  }
  const province = item.adminunit?.province ? makeUrlSlug(item.adminunit.province) : 'ha-noi';
  const ward = item.adminunit?.ward ? makeUrlSlug(item.adminunit.ward) : '';
  const slug = makeUrlSlug(item.title || '');
  const id = item.shortId || item._id || fallbackId || '';
  return `https://nhadat.city/${province}/${ward}/${id}/${slug}`;
}

export default function Reports() {
  const { token } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchReports();
  }, [page, statusFilter]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?page=${page}&status=${statusFilter}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setReports(json.data.reports);
        setTotalPages(json.data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, reviewed: boolean) => {
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ reviewed })
      });
      if (res.ok) fetchReports();
    } catch (err) {
      console.error(err);
    }
  };

  const updateListingStatus = async (id: string, status: number) => {
    if (!confirm('Bạn có chắc chắn muốn thay đổi trạng thái tin này?')) return;
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        alert('Đã cập nhật trạng thái tin đăng!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteListing = async (id: string) => {
    if (!confirm('Hành động này sẽ xóa vĩnh viễn tin đăng. Bạn có chắc chắn?')) return;
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert('Đã xóa tin đăng!');
      }
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
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="text-red-500" /> Quản lý Báo cáo Tin lỗi
          </h2>
          <p className="text-slate-500 mt-1">Xử lý các báo cáo vi phạm, thông tin sai lệch từ người dùng.</p>
        </div>
        
        <select 
          className="px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="all">Tất cả báo cáo</option>
          <option value="pending">Chờ xử lý</option>
          <option value="reviewed">Đã xử lý</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                  <th className="py-3 px-4 font-medium">Lý do báo cáo</th>
                  <th className="py-3 px-4 font-medium min-w-[200px]">Chi tiết</th>
                  <th className="py-3 px-4 font-medium">Tin đăng</th>
                  <th className="py-3 px-4 font-medium">Thời gian</th>
                  <th className="py-3 px-4 font-medium">Trạng thái</th>
                  <th className="py-3 px-4 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report, idx) => (
                  <tr key={report._id || idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {report.reason || 'Khác'}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {report.details || <span className="text-slate-400 italic">Không có chi tiết</span>}
                      {report.clientInfo?.ip && (
                        <div className="text-xs text-slate-400 mt-1 font-mono">IP: {report.clientInfo.ip}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {report.postId ? (
                        <a href={getRealEstateUrl(report.listing, report.postId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 hover:underline">
                          <ExternalLink size={14} /> Xem tin
                        </a>
                      ) : (
                        <span className="text-slate-400 text-sm">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-500">
                      {formatDate(report.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      {report.reviewed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                          <CheckCircle size={12} /> Đã xử lý
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                          <Clock size={12} /> Chờ xử lý
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex flex-col gap-2 items-end">
                        <div className="flex gap-2">
                          {!report.reviewed ? (
                            <button onClick={() => updateStatus(report._id, true)} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded text-xs font-medium transition-colors">
                              Đã xử lý
                            </button>
                          ) : (
                            <button onClick={() => updateStatus(report._id, false)} className="px-3 py-1.5 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded text-xs transition-colors">
                              Hoàn tác
                            </button>
                          )}
                        </div>
                        {report.postId && (
                          <div className="flex gap-1">
                            <button onClick={() => updateListingStatus(report.postId, -1)} className="px-2 py-1 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded text-[10px] font-medium transition-colors">
                              Khóa Tin
                            </button>
                            <button onClick={() => deleteListing(report.postId)} className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-[10px] font-medium transition-colors">
                              Xóa Tin
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      Chưa có báo cáo nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex justify-center gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Trước</button>
            <span className="px-3 py-1.5 text-sm text-slate-600">Trang {page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Sau</button>
          </div>
        )}
      </div>
    </div>
  );
}
