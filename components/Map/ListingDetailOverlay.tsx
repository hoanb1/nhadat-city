'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useMapContext } from './MapContext';
import { X } from 'lucide-react';
import ListingDetailContent from '@/components/ListingDetail/ListingDetailContent';
import ProjectDetailContent from '@/components/ProjectDetail/ProjectDetailContent';

export default function ListingDetailOverlay() {
  const { selectedListingId, setSelectedListingId, selectedListing, setSelectedListing } = useMapContext();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch full listing detail when ID changes
  useEffect(() => {
    if (!selectedListingId) { setSelectedListing(null); return; }
    
    // Reset scroll to top when changing listings
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }

    // Always fetch from API for full data (card data is partial)
    if (selectedListing && String(selectedListing._id) === selectedListingId && selectedListing.description !== undefined) return;
    setSelectedListing(null);
    fetch(`/api/real-estate/${selectedListingId}`)
      .then(r => r.json())
      .then(j => { if (j.success) setSelectedListing(j.data); })
      .catch(console.error);
  }, [selectedListingId]);

  // Listen to browser back/forward (popstate)
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state?.listingId) {
        // Forward → re-open that listing
        setSelectedListingId(e.state.listingId);
      } else {
        // Back → close modal
        setSelectedListingId(null);
        setSelectedListing(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setSelectedListingId, setSelectedListing]);

  const handleClose = useCallback(() => {
    // history.back() triggers popstate → popstate handler closes modal
    // This keeps the history stack correct for browser nav
    if (typeof window !== 'undefined' && window.history.state?.listingId) {
      window.history.back();
    } else {
      setSelectedListingId(null);
      setSelectedListing(null);
    }
  }, [setSelectedListingId, setSelectedListing]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [handleClose]);

  const isOpen = !!selectedListingId;
  const listing = selectedListing;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 z-[200] bg-black/50 backdrop-blur-[3px] transition-opacity duration-250 ease-out ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
        onClick={handleClose} 
      />

      {/* Modal */}
      <div 
        className={`fixed top-1/2 left-1/2 w-[95vw] max-w-[800px] h-[90vh] bg-white z-[201] flex flex-col rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.35)] overflow-hidden transition-all duration-300 max-md:max-w-[100vw] max-md:h-[100dvh] max-md:top-0 max-md:left-0 max-md:w-[100vw] max-md:rounded-none ${isOpen ? 'translate-x-[-50%] translate-y-[-50%] scale-100 opacity-100 pointer-events-auto max-md:translate-x-0 max-md:translate-y-0' : 'translate-x-[-50%] translate-y-[-46%] scale-95 opacity-0 pointer-events-none max-md:translate-x-0 max-md:translate-y-[20px]'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="listing-dialog-title"
      >
        {/* Sticky header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 bg-white shrink-0 sticky top-0 z-10">
          <span id="listing-dialog-title" className="flex-1 font-bold text-[0.88rem] text-slate-700">
            {listing?.propertyType === 'du_an' ? 'Chi tiết dự án' : 'Chi tiết bất động sản'}
          </span>
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
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 [scrollbar-width:thin]">
          {!listing ? (
            /* Skeleton */
            <div className="flex flex-col">
              <div className="w-full aspect-video rounded-none bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-shimmer" />
              <div className="p-5 flex flex-col gap-3">
                <div className="h-3.5 w-[80%] rounded-md bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-shimmer" />
                <div className="h-3.5 w-[60%] rounded-md bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-shimmer" />
                <div className="h-10 rounded-[10px] bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-shimmer" />
                <div className="h-3.5 w-full rounded-md bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-shimmer" />
                <div className="h-3.5 w-[90%] rounded-md bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-shimmer" />
                <div className="h-3.5 w-[70%] rounded-md bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-shimmer" />
              </div>
            </div>
          ) : listing.propertyType === 'du_an' ? (
            <ProjectDetailContent project={listing} currentUrl={typeof window !== 'undefined' ? window.location.href : ''} isInModal={true} />
          ) : (
            <ListingDetailContent listing={listing} currentUrl={typeof window !== 'undefined' ? window.location.href : ''} />
          )}
        </div>
      </div>
    </>
  );
}
