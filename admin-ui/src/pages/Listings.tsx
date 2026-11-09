import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Search, CheckCircle, XCircle, Trash2, MapPin, Tag, ExternalLink } from 'lucide-react';

interface Listing {
  _id: string;
  title: string;
  price?: { value: number; unit: string };
  area?: number;
  location?: { provinceName?: string; districtName?: string };
  address?: string;
  status: number;
  createdAt: string;
  images?: string[];
  url?: string;
  views?: number;
  likes?: number;
  adminunit?: { province?: string; ward?: string };
  shortId?: string;
}

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

function getRealEstateUrl(item: any): string {
  const province = item.adminunit?.province ? makeUrlSlug(item.adminunit.province) : 'ha-noi';
  const ward = item.adminunit?.ward ? makeUrlSlug(item.adminunit.ward) : '';
  const slug = makeUrlSlug(item.title || '');
  const id = item.shortId || item._id;
  return `https://nhadat.city/${province}/${ward}/${id}/${slug}`;
}

export default function Listings() {
  const { token } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchListings();
  }, [page, search, statusFilter]);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/listings?page=${page}&search=${search}&status=${statusFilter}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setListings(json.data.listings);
        setTotalPages(json.data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: number) => {
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) fetchListings();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteListing = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa tin đăng này?')) return;
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchListings();
    } catch (err) {
      console.error(err);
    }
  };

  const formatPrice = (price?: { value: number; unit: string }) => {
    if (!price || !price.value) return 'Thỏa thuận';
    return `${price.value} ${price.unit}`;
  };

  const getStatusBadge = (status: number) => {
    switch(status) {
      case 1:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold"><CheckCircle size={12} /> Đã duyệt</span>;
      case 0:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">Chờ duyệt</span>;
      case -1:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold"><XCircle size={12} /> Bị khóa</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">Không rõ</span>;
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm min-h-[600px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quản lý Tin Đăng</h2>
          <p className="text-slate-500 text-sm mt-1">Duyệt, khóa và xóa các tin bất động sản trên hệ thống.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Tìm theo tiêu đề, địa chỉ..." 
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select 
          className="px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="1">Đã duyệt</option>
          <option value="0">Chờ duyệt</option>
          <option value="-1">Bị khóa</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-slate-500 text-sm">
                <th className="py-3 px-4 font-medium min-w-[250px]">Tin đăng</th>
                <th className="py-3 px-4 font-medium min-w-[120px]">Giá & Diện tích</th>
                <th className="py-3 px-4 font-medium">Lượt tương tác</th>
                <th className="py-3 px-4 font-medium">Trạng thái</th>
                <th className="py-3 px-4 font-medium">Ngày đăng</th>
                <th className="py-3 px-4 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {listings.map(listing => (
                <tr key={listing._id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      {listing.images?.[0] ? (
                        <img src={listing.images[0].startsWith('http') ? listing.images[0] : `/api/image-api/v1/100/100/${listing.images[0]}.webp`} alt="thumb" className="w-12 h-12 rounded object-cover flex-shrink-0 border border-slate-200" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-400">
                          <Tag size={20} />
                        </div>
                      )}
                      <div>
                        <div className="flex items-start gap-1.5 flex-wrap">
                          <a href={getRealEstateUrl(listing)} target="_blank" rel="noreferrer" className="font-medium text-slate-800 hover:text-indigo-600 line-clamp-2 leading-tight">
                            {listing.title}
                          </a>
                          {listing.url && (
                            <a href={listing.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-600 mt-0.5 shrink-0" title="Link nguồn gốc (Batdongsan, Meeyland...)">
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <MapPin size={12} />
                          {listing.address || `${listing.location?.districtName}, ${listing.location?.provinceName}`}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-red-600 text-sm">{formatPrice(listing.price)}</div>
                    <div className="text-xs text-slate-600">{listing.area} m²</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1 text-xs">
                      <span className="text-slate-600 font-medium">👁 {listing.views || 0} Lượt xem</span>
                      <span className="text-slate-600 font-medium">❤️ {listing.likes || 0} Lượt thích</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {getStatusBadge(listing.status)}
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600">
                    {new Date(listing.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {listing.status !== 1 && (
                        <button onClick={() => updateStatus(listing._id, 1)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Duyệt tin">
                          <CheckCircle size={16} />
                        </button>
                      )}
                      {listing.status !== -1 && (
                        <button onClick={() => updateStatus(listing._id, -1)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Khóa tin">
                          <XCircle size={16} />
                        </button>
                      )}
                      <button onClick={() => deleteListing(listing._id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Xóa tin">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {listings.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Không có tin đăng nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button 
            disabled={page === 1} 
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-3 py-1.5 border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Trước
          </button>
          <span className="px-3 py-1.5 text-sm text-slate-600 flex items-center">Trang {page} / {totalPages}</span>
          <button 
            disabled={page === totalPages} 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Sau
          </button>
        </div>
      )}
    </div>
  );
}
