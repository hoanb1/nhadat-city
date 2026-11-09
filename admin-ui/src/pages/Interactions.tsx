import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { MessageSquare, Trash2, User, MessageCircle } from 'lucide-react';

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

export default function Interactions() {
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState<'comment' | 'chat'>('comment');

  useEffect(() => {
    fetchItems();
  }, [page, activeTab]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/interactions?page=${page}&type=${activeTab}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setItems(json.data.items || json.data.comments || []);
        setTotalPages(json.data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa ${activeTab === 'comment' ? 'bình luận' : 'tin nhắn'} này?`)) return;
    try {
      // In a real app we'd need to pass the collection to delete from, 
      // but for now we will just refresh if successful
      const res = await fetch(`/api/admin/interactions/${id}?type=${activeTab}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchItems();
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
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare className="text-indigo-600" /> Quản lý Tương tác
          </h2>
          <p className="text-slate-500 mt-1">Giám sát bình luận và tin nhắn trên hệ thống.</p>
        </div>
      </div>

      <div className="flex border-b border-slate-200 mb-6">
        <button
          className={`pb-3 px-4 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'comment' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => { setActiveTab('comment'); setPage(1); }}
        >
          Bình luận BĐS
        </button>
        <button
          className={`pb-3 px-4 font-medium text-sm border-b-2 transition-colors flex items-center gap-1 ${
            activeTab === 'chat' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => { setActiveTab('chat'); setPage(1); }}
        >
          <MessageCircle size={16} /> Tin nhắn cá nhân
        </button>
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
                  <th className="py-3 px-4 font-medium min-w-[200px]">Nội dung</th>
                  <th className="py-3 px-4 font-medium">{activeTab === 'comment' ? 'Người gửi' : 'Người gửi / Người nhận'}</th>
                  <th className="py-3 px-4 font-medium">Thời gian</th>
                  <th className="py-3 px-4 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item._id || idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">{item.message || item.content || 'N/A'}</div>
                      {item.realEstateId && (
                        <a href={getRealEstateUrl(item.listing, item.realEstateId)} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline">Xem tin đăng liên quan</a>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-slate-500">
                            <User size={10} />
                          </div>
                          <span className="text-sm font-medium text-slate-700">{item.senderId || item.userId || item.authorName || 'Ẩn danh'}</span>
                        </div>
                        {activeTab === 'chat' && item.receiverId && (
                          <div className="text-xs text-slate-500 flex items-center gap-1 pl-7">
                            <span>Đến:</span>
                            <span className="font-medium text-slate-600">{item.receiverId}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-500">
                      {formatDate(item.timestamp || item.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => deleteItem(item._id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors" title="Xóa">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-500">
                      Chưa có {activeTab === 'comment' ? 'bình luận' : 'tin nhắn'} nào
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
