'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatMoney, formatArea, getImageUrl } from '@/lib/utils/utils';
import { Home, Eye } from 'lucide-react';

const STATUS_LABEL: Record<number, { label: string; color: string }> = {
  2:  { label: 'Đang hiển thị', color: '#16a34a' },
  1:  { label: 'Chờ duyệt', color: '#d97706' },
  0:  { label: 'Hết hạn', color: '#94a3b8' },
  '-1': { label: 'Đã xóa', color: '#ef4444' },
};

export default function ManageListingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('all');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    setLoading(true);
    fetch(`/api/user/listings?status=${filter}`)
      .then(r => r.json())
      .then(j => { if (j.success) setListings(j.data); })
      .finally(() => setLoading(false));
  }, [status, filter]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Xóa tin: "${title}"?`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/user/listings?id=${id}`, { method: 'DELETE' });
      const j = await res.json();
      if (j.success) setListings(prev => prev.filter(l => String(l._id) !== id));
      else alert(j.error || 'Xóa thất bại');
    } catch { alert('Lỗi kết nối'); }
    finally { setDeleting(null); }
  };

  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return (
      <div className="min-h-dvh bg-slate-50 font-sans">
        <div className="max-w-[900px] my-20 mx-auto px-5 flex flex-col gap-3">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-shimmer" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 py-3.5 px-5 sticky top-0 z-10">
        <div className="max-w-[900px] mx-auto flex items-center gap-4">
          <Link href="/profile" className="text-slate-500 no-underline text-[0.9rem] font-semibold transition-colors duration-200 hover:text-blue-600">← Hồ sơ</Link>
          <h1 className="flex-1 text-[1.1rem] font-extrabold text-slate-800 m-0">Quản lý tin đăng</h1>
          <Link href="/post" className="bg-blue-600 text-white no-underline py-[9px] px-[18px] rounded-lg text-[0.85rem] font-bold whitespace-nowrap transition-colors duration-200 hover:bg-blue-700">
            + Đăng tin mới
          </Link>
        </div>
      </header>

      <main className="max-w-[900px] mx-auto py-6 px-5">
        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-5">
          {(['all', 'active', 'expired'] as const).map(f => (
            <button key={f} className={`py-2 px-[18px] rounded-full border-[1.5px] border-slate-200 bg-white text-[0.85rem] font-semibold text-slate-500 cursor-pointer transition-all duration-200 ${filter === f ? '!bg-blue-600 !text-white !border-blue-600' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Tất cả' : f === 'active' ? 'Đang hiển thị' : 'Hết hạn'}
            </button>
          ))}
          <span className="ml-auto text-[0.8rem] text-slate-400 font-semibold">{listings.length} tin</span>
        </div>

        {/* List */}
        {listings.length === 0 && !loading ? (
          <div className="text-center py-15 px-5 flex flex-col items-center gap-3">
            <Home className="w-12 h-12 text-slate-300" strokeWidth={1.5} />
            <p className="text-slate-500">Bạn chưa có tin đăng nào.</p>
            <Link href="/post" className="bg-blue-600 text-white no-underline py-3 px-7 rounded-xl font-bold">Đăng tin ngay</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {listings.map(item => {
              const st = STATUS_LABEL[item.status] || STATUS_LABEL[0];
              const img = item.images?.[0] ? getImageUrl(item.images[0], String(item._id), 120, 90) : null;
              const expireDays = item.expireAt
                ? Math.ceil((new Date(item.expireAt).getTime() - Date.now()) / 86400000)
                : null;

              return (
                <div key={String(item._id)} className="bg-white border border-slate-200 rounded-2xl p-4 flex sm:flex-nowrap flex-wrap gap-3.5 items-start transition-shadow duration-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                  {img
                    ? <div className="relative w-[100px] h-[75px] shrink-0"><Image unoptimized src={img} alt="" fill sizes="100px" className="rounded-lg object-cover bg-slate-200" /></div>
                    : <div className="w-[100px] h-[75px] rounded-lg shrink-0 bg-slate-200 flex items-center justify-center text-slate-400"><Home className="w-7 h-7" strokeWidth={1.5} /></div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span className="text-[0.75rem] font-bold" style={{ color: st.color }}>● {st.label}</span>
                      {expireDays !== null && expireDays > 0 && (
                        <span className="text-[0.7rem] text-amber-600 bg-yellow-100 py-0.5 px-2 rounded-lg font-semibold">Còn {expireDays} ngày</span>
                      )}
                    </div>
                    <p className="text-[0.9rem] font-bold text-slate-800 m-0 mb-2 line-clamp-2">{item.title}</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-red-600 font-extrabold text-[0.9rem]">{formatMoney(item.totalPrice || item.price)}</span>
                      {item.area > 0 && <span className="text-[0.78rem] text-slate-500">{formatArea(item.area)}</span>}
                      <span className="text-[0.75rem] text-slate-400 flex items-center gap-1"><Eye className="w-3.5 h-3.5" strokeWidth={1.5} /> {item.views || 0}</span>
                    </div>
                  </div>
                  <div className="flex sm:flex-col flex-row gap-2 shrink-0">
                    <Link
                      href={`/${item.adminunit?.province || 'ha-noi'}/${item.adminunit?.ward || 'bds'}/${item.shortId || item._id}/${item.slug || 'chi-tiet'}`}
                      className="py-[7px] px-3.5 rounded-lg text-[0.8rem] font-bold cursor-pointer no-underline text-center border transition-all duration-200 bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-600 hover:text-white"
                      target="_blank"
                    >
                      Xem
                    </Link>
                    <button
                      className="py-[7px] px-3.5 rounded-lg text-[0.8rem] font-bold cursor-pointer text-center border transition-all duration-200 bg-red-50 text-red-500 border-red-200 hover:not(:disabled):bg-red-500 hover:not(:disabled):text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handleDelete(String(item._id), item.title)}
                      disabled={deleting === String(item._id)}
                    >
                      {deleting === String(item._id) ? '...' : 'Xóa'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
