'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useMapContext } from './MapContext';
import { X, Phone, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { formatMoney } from '@/lib/utils/utils';

export default function UserProfileOverlay() {
  const { selectedUserId, setSelectedUserId } = useMapContext();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedUserId) { setData(null); return; }
    
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }

    setLoading(true);
    fetch(`/api/user/profile/${selectedUserId}`)
      .then(r => r.json())
      .then(j => { 
        if (j.success) setData(j.data); 
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedUserId]);

  const handleClose = useCallback(() => {
    setSelectedUserId(null);
  }, [setSelectedUserId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [handleClose]);

  const isOpen = !!selectedUserId;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 z-[200] bg-black/50 backdrop-blur-[3px] transition-opacity duration-250 ease-out ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
        onClick={handleClose} 
      />

      {/* Modal */}
      <div 
        className={`fixed top-1/2 left-1/2 w-[95vw] max-w-[600px] h-[80vh] bg-white z-[201] flex flex-col rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.35)] overflow-hidden transition-all duration-300 max-md:max-w-[100vw] max-md:h-[100dvh] max-md:top-0 max-md:left-0 max-md:w-[100vw] max-md:rounded-none ${isOpen ? 'translate-x-[-50%] translate-y-[-50%] scale-100 opacity-100 pointer-events-auto max-md:translate-x-0 max-md:translate-y-0' : 'translate-x-[-50%] translate-y-[-46%] scale-95 opacity-0 pointer-events-none max-md:translate-x-0 max-md:translate-y-[20px]'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-dialog-title"
      >
        {/* Sticky header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 bg-white shrink-0 sticky top-0 z-10">
          <span id="user-dialog-title" className="flex-1 font-bold text-[0.88rem] text-slate-700">Thông tin người dùng</span>
          <button
            className="w-11 h-11 flex items-center justify-center border border-slate-200 bg-white rounded-sm cursor-pointer text-slate-500 transition-all duration-200 shrink-0 hover:bg-red-50 hover:text-red-500 hover:border-red-200"
            onClick={handleClose}
            title="Đóng (Esc)"
            aria-label="Đóng cửa sổ"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 [scrollbar-width:thin] p-6">
          {loading ? (
            <div className="flex flex-col gap-3">
              <div className="h-20 w-full rounded-xl bg-slate-100 animate-pulse" />
              <div className="h-10 w-[60%] rounded-md bg-slate-100 animate-pulse" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-32 rounded-xl bg-slate-100 animate-pulse" />
                <div className="h-32 rounded-xl bg-slate-100 animate-pulse" />
              </div>
            </div>
          ) : data ? (
            <div>
              {/* User Info - Premium Design */}
              <div className="bg-gradient-to-br from-slate-900 to-indigo-900 rounded-2xl p-6 mb-6 flex flex-col md:flex-row items-center md:items-start gap-5 text-white shadow-lg relative overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl transform translate-x-10 -translate-y-10" />
                
                <div className="relative shrink-0">
                  {data.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={data.user.image}
                      alt={data.user.name}
                      className="w-20 h-20 rounded-full object-cover border-4 border-white/20 shadow-md"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 to-orange-400 text-white flex items-center justify-center text-[2rem] font-bold border-4 border-white/20 shadow-md">
                      {data.user.name?.charAt(0) || 'U'}
                    </div>
                  )}
                  <span className="absolute -bottom-1 -right-1 bg-green-500 w-5 h-5 rounded-full border-2 border-slate-900 flex items-center justify-center" title="Online">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  </span>
                </div>
                
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-[1.4rem] font-black text-white mb-0.5 tracking-tight">{data.user.name}</h2>
                  <p className="text-indigo-200 text-[0.85rem] mb-2 font-medium">{data.user.email}</p>
                  
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start items-center">
                    {data.user.phone && (
                      <span className="py-1 px-3 bg-white/10 hover:bg-white/20 text-white rounded-full text-[0.75rem] font-bold transition-colors cursor-pointer flex items-center gap-1.5">
                        <Phone size={13} strokeWidth={1.5} /> {data.user.phone}
                      </span>
                    )}
                    <span className="py-1 px-3 bg-indigo-500/30 text-indigo-100 rounded-full text-[0.75rem] font-bold flex items-center gap-1.5">
                      <ShieldCheck size={13} strokeWidth={1.5} /> Thành viên
                    </span>
                  </div>
                </div>
              </div>

              {/* Listings */}
              <h3 className="text-[1rem] font-bold text-slate-800 mb-4">Tin đăng ({data.listings.length})</h3>
              
              {data.listings.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.listings.map((listing: any) => (
                    <div key={listing._id} className="group bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all flex flex-col justify-between relative overflow-hidden">
                      {/* Hover gradient border accent */}
                      <div className="absolute inset-0 border-2 border-transparent group-hover:border-indigo-500/10 rounded-xl pointer-events-none transition-colors" />
                      
                      <div>
                        <h4 className="font-bold text-slate-800 mb-1 line-clamp-2 text-[0.9rem] group-hover:text-indigo-600 transition-colors">{listing.title}</h4>
                        <div className="flex items-center gap-1 text-xs text-slate-400 mb-2">
                          <span className="inline-block w-1.5 h-1.5 bg-slate-300 rounded-full" />
                          <span className="line-clamp-1">{listing.address}</span>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-50">
                        <div>
                          <span className="text-indigo-600 font-extrabold text-[0.95rem]">
                            {listing.totalPrice ? formatMoney(listing.totalPrice) : 'Liên hệ'}
                          </span>
                          {listing.area && (
                            <span className="text-slate-400 text-[0.75rem] ml-1 font-medium">
                              / {listing.area}m²
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm">
                        <Link 
                          href={(() => {
                            const pSlug = listing.adminunit?.province?.trim();
                            const wSlug = listing.adminunit?.ward?.trim();
                            const id = listing.shortId || listing._id;
                            if (!id || !pSlug || pSlug === 'undefined') return '#';
                            return wSlug && wSlug !== 'undefined'
                              ? `/${pSlug}/${wSlug}/${id}/${listing.slug || 'nha-dat'}`
                              : `/${pSlug}/${id}/${listing.slug || 'nha-dat'}`;
                          })()}

                          className="font-medium text-indigo-600 hover:text-indigo-800 line-clamp-2 leading-snug"
                          onClick={handleClose}
                        >
                          Chi tiết <span className="transform group-hover:translate-x-0.5 transition-transform">→</span>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-xl">
                  Người dùng này chưa có tin đăng nào.
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">
              Không tìm thấy thông tin người dùng.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
