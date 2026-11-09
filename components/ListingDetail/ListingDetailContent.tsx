
'use client';

import dynamic from 'next/dynamic';
import { formatMoney, formatArea, formatDate } from '@/lib/utils/utils';
import { Phone, MapPin, Calendar, Eye, ExternalLink, Copy, Share2, ShieldCheck, Compass, Layers, DoorOpen, Bath, Ruler, Home, Maximize, MoveHorizontal, Sofa, Tag, ArrowUpRight, Zap, Mail, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

import ImageGallery from './ImageGallery';

import SimilarListings from './SimilarListings';
const CommentSection = dynamic(() => import('./CommentSection'), { ssr: false, loading: () => <div className="h-32 bg-slate-50 animate-pulse rounded-sm mt-4"></div> });
const PropertyRadarChart = dynamic(() => import('./PropertyRadarChart'), { ssr: false, loading: () => <div className="h-64 bg-slate-50 animate-pulse rounded-sm mt-4"></div> });

// ── Value-added components (unique to NhaDat.City) ──
const MortgageCalculator = dynamic(() => import('./MortgageCalculator'), { ssr: false, loading: () => <div className="h-48 bg-slate-50 animate-pulse rounded-2xl mt-4"></div> });
import AreaPriceAnalysis from './AreaPriceAnalysis';
import NearbyPlaces from './NearbyPlaces';
import LegalGuide from './LegalGuide';
import AutoFAQ from './AutoFAQ';
const AnomalyBadge = dynamic(() => import('@/components/property/AnomalyBadge'), { ssr: false });
const SimilarPropertiesAI = dynamic(() => import('@/components/property/SimilarPropertiesAI'), { ssr: false, loading: () => <div className="h-48 bg-slate-50 animate-pulse mt-4"></div> });

/* ─── helpers ─── */
const PROPERTY_TYPE_LABEL: Record<string, string> = {
  nha_pho: 'Nhà phố', can_ho: 'Căn hộ', dat_nen: 'Đất nền',
  biet_thu: 'Biệt thự', phong_tro: 'Phòng trọ', van_phong: 'Văn phòng',
  nha_mat_pho: 'Nhà mặt phố', shophouse: 'Shophouse', kho_xuong: 'Kho xưởng',
  nha_rieng: 'Nhà riêng', can_ho_chung_cu: 'Căn hộ chung cư',
  biet_thu_lien_ke: 'Biệt thự liền kề', dat: 'Đất', dat_nen_du_an: 'Đất nền dự án',
  kho_nha_xuong: 'Kho nhà xưởng', trang_trai_khu_nghi_duong: 'Trang trại nghỉ dưỡng',
  nha_dat: 'Nhà đất',
};
const LEGAL_LABEL: Record<string, string> = {
  so_do: 'Sổ đỏ', so_hong: 'Sổ hồng', hop_dong: 'Hợp đồng mua bán',
  giay_to_hop_le: 'Giấy tờ hợp lệ', khong_co_giay_to: 'Không có giấy tờ',
};
const DIRECTION_LABEL: Record<string, string> = {
  dong: 'Đông', tay: 'Tây', nam: 'Nam', bac: 'Bắc',
  dong_nam: 'Đông Nam', dong_bac: 'Đông Bắc', tay_nam: 'Tây Nam', tay_bac: 'Tây Bắc',
};

function getDynamicField(fields: any[], id: string) {
  return fields?.find((f: any) => f._id === id)?.value || 0;
}

function copyText(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

interface Props {
  listing: any;
  currentUrl?: string;
  similarListings?: any[];
}

export default function ListingDetailContent({ listing, currentUrl, similarListings = [] }: Props) {
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!listing) return null;

  // Support both old dynamicFields format and new flat fields
  const bedrooms  = listing.bedrooms || getDynamicField(listing.dynamicFields, 'bedrooms');
  const bathrooms = listing.bathrooms || getDynamicField(listing.dynamicFields, 'bathrooms');
  const floors    = listing.totalFloor || getDynamicField(listing.dynamicFields, 'floor');
  const facade    = listing.facade || getDynamicField(listing.dynamicFields, 'facade');
  const depth     = listing.depth || getDynamicField(listing.dynamicFields, 'depth');
  const id        = String(listing._id);
  const desc      = listing.description || '';
  const shortDesc = desc.length > 600 ? desc.substring(0, 600) + '…' : desc;

  // Contact: support both old format (contact.phone) and new (contact.phones)
  const contactName = listing.contact?.fullName || listing.contact?.name || '';
  const phone = listing.contact?.phones?.[0] || listing.contact?.phone || '';
  const contactEmail = listing.contact?.email || '';

  // New rich fields from MeeyLand
  const direction = listing.direction || (listing.direction && DIRECTION_LABEL[listing.direction]) || '';
  const legalPaper = listing.legalPaper || (listing.legalDocs && LEGAL_LABEL[listing.legalDocs]) || listing.legalDocs || '';
  const wideRoad = listing.wideRoad || '';
  const furniture = listing.furniture;
  const advantages: string[] = listing.advantages || [];
  const userType = listing.userType || '';
  const pricePerM2 = listing.pricePerM2 || (listing.totalPrice && listing.area ? Math.round(listing.totalPrice / listing.area) : 0);

  const handleCopy = () => {
    copyText(currentUrl || window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const url = currentUrl || window.location.href;
    if (navigator.share) {
      navigator.share({ title: listing.title, url }).catch(() => {});
    } else {
      copyText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const ContactCard = ({ isSticky = false }) => (
    <div className={`${isSticky ? 'sticky top-24' : 'mt-6'} bg-white sm:rounded-2xl sm:border border-slate-200 p-6 shadow-sm flex flex-col gap-5`}>
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-gradient-to-br from-indigo-800 to-indigo-600 text-white flex items-center justify-center font-extrabold text-2xl rounded-full shadow-inner">{contactName.charAt(0)?.toUpperCase() || 'C'}</div>
        <div>
          <div className="text-lg font-bold text-slate-900">{contactName || 'Chủ bất động sản'}</div>
          <div className="text-sm text-slate-500 mt-1 flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-500" />
            {userType || 'Đã xác thực'}
          </div>
        </div>
      </div>
      
      <div className="flex flex-col gap-3">
        {phone ? (
          <>
            <a href={`tel:${phone}`} className="w-full flex items-center justify-center gap-2 py-3.5 px-4 text-[0.95rem] font-bold no-underline transition-all duration-200 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] hover:-translate-y-[1px]">
              <Phone size={18} /> {phone}
            </a>
            <a href={`https://zalo.me/${phone}`} target="_blank" rel="nofollow noreferrer" className="w-full flex items-center justify-center gap-2 py-3 px-4 text-[0.95rem] font-bold no-underline transition-all duration-200 bg-white text-[#0068ff] border-2 border-[#0068ff] hover:bg-[#0068ff]/5 rounded-xl">
              Chat Zalo
            </a>
          </>
        ) : (
          <div className="p-4 bg-amber-50 text-amber-800 rounded-xl text-sm border border-amber-200">Tin đăng này đang được cập nhật thông tin liên hệ.</div>
        )}
        {contactEmail && (
          <a href={`mailto:${contactEmail}`} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold no-underline text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors">
            <Mail size={16} /> {contactEmail}
          </a>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-[1280px] mx-auto px-0 sm:px-4 lg:px-8 py-0 lg:py-6 bg-white sm:bg-slate-50 min-h-screen">
      
      {/* ── Gallery ── */}
      <ImageGallery images={listing.images || []} listingId={id} title={listing.title} />

      <div className="flex flex-col gap-6 mt-0 lg:mt-8">
        
        {/* Left Column (Main Content) */}
        <div className="flex flex-col gap-6">
          
          <div className="bg-white sm:rounded-2xl sm:border border-slate-200 p-5 sm:p-7 shadow-sm">
            {/* ── Title block ── */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {listing.propertyType && (
                <span className="text-[12px] font-bold py-1 px-3 rounded-md bg-indigo-50 text-indigo-700 tracking-wide">{PROPERTY_TYPE_LABEL[listing.propertyType] || listing.propertyType}</span>
              )}
              {legalPaper && (
                <span className="text-[12px] font-bold py-1 px-3 rounded-md flex items-center gap-1.5 bg-emerald-50 text-emerald-700 tracking-wide">
                  <ShieldCheck size={14} /> {legalPaper}
                </span>
              )}
              {listing.levelTransaction && (
                <span className="text-[12px] font-bold py-1 px-3 rounded-md bg-red-50 text-red-700 tracking-wide">
                  {listing.levelTransaction}
                </span>
              )}
            </div>
            
            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 leading-snug mb-4 tracking-tight">{listing.title}</h1>
            
            <AnomalyBadge 
              propertyData={{
                property_type_name: PROPERTY_TYPE_LABEL[listing.propertyType] || 'Nhà',
                province_name: listing.adminunit?.provinceName || 'Hà Nội',
                district_name: listing.adminunit?.districtName || '',
                ward_name: listing.adminunit?.wardName || '',
                area: listing.area || 0,
                listed_price: listing.totalPrice || listing.price || 0
              }} 
            />
            <div className="mt-4"></div>

            <div className="flex items-start justify-between gap-4 flex-wrap pb-6 border-b border-slate-100">
              {listing.address && (
                <div className="flex flex-col gap-2 flex-1">
                  <span className="flex items-start gap-1.5 text-[0.95rem] text-slate-600 font-medium">
                    <MapPin size={18} className="text-red-500 shrink-0 mt-[2px]" />
                    {listing.address}
                  </span>
                  {listing.adminunit?.province && (
                    <Link href={`/thong-ke/${listing.adminunit.province}`} className="inline-flex items-center gap-1.5 text-[0.8rem] font-bold text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg w-fit no-underline">
                      <TrendingUp size={14} /> Xem thống kê giá {listing.adminunit.provinceName || 'khu vực này'}
                    </Link>
                  )}
                </div>
              )}
              <div className="flex gap-4 items-center shrink-0">
                <div className="flex gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                  <button className="w-9 h-9 rounded-md bg-white text-slate-700 hover:text-indigo-600 shadow-sm flex items-center justify-center transition-all hover:shadow" onClick={handleShare} title="Chia sẻ"><Share2 size={16} /></button>
                  <button className="relative w-9 h-9 rounded-md bg-white text-slate-700 hover:text-indigo-600 shadow-sm flex items-center justify-center transition-all hover:shadow" onClick={handleCopy} title={copied ? 'Đã copy!' : 'Copy link'}>
                    <Copy size={16} />
                    {copied && <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[11px] py-1 px-2 rounded whitespace-nowrap">Đã copy!</span>}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Price banner ── */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-6">
              <div>
                <div className="text-sm text-slate-500 font-semibold mb-1">Mức giá</div>
                <div className="text-3xl font-black text-indigo-700 tracking-tight">{formatMoney(listing.totalPrice || listing.price)}</div>
              </div>
              
              {listing.area && pricePerM2 > 0 && (
                <div className="border-l-2 border-slate-100 pl-6">
                  <div className="text-sm text-slate-500 font-semibold mb-1">Đơn giá</div>
                  <div className="text-xl font-bold text-slate-700">{formatMoney(pricePerM2)}/m²</div>
                </div>
              )}

              <div className="border-l-2 border-slate-100 pl-6 flex-1 hidden sm:block">
                <div className="text-sm text-slate-500 font-semibold mb-1">Diện tích</div>
                <div className="text-xl font-bold text-slate-700">{formatArea(listing.area)}</div>
              </div>
            </div>
          </div>

          <ContactCard isSticky={false} />

          {/* ── Specs grid (enhanced with new fields) ── */}
          <div className="bg-white sm:rounded-2xl sm:border border-slate-200 p-5 sm:p-7 shadow-sm">
             <h2 className="text-xl font-bold text-slate-900 mb-5">Đặc điểm bất động sản</h2>
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-6 gap-x-4">
                {listing.area > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500"><Maximize size={20} /></div>
                    <div>
                      <div className="text-xs text-slate-400 font-medium">Diện tích</div>
                      <div className="font-bold text-slate-800">{formatArea(listing.area)}</div>
                    </div>
                  </div>
                )}
                {bedrooms > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500"><DoorOpen size={20} /></div>
                    <div>
                      <div className="text-xs text-slate-400 font-medium">Phòng ngủ</div>
                      <div className="font-bold text-slate-800">{bedrooms} phòng</div>
                    </div>
                  </div>
                )}
                {bathrooms > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500"><Bath size={20} /></div>
                    <div>
                      <div className="text-xs text-slate-400 font-medium">Phòng tắm</div>
                      <div className="font-bold text-slate-800">{bathrooms} phòng</div>
                    </div>
                  </div>
                )}
                {floors > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500"><Layers size={20} /></div>
                    <div>
                      <div className="text-xs text-slate-400 font-medium">Số tầng</div>
                      <div className="font-bold text-slate-800">{floors} tầng</div>
                    </div>
                  </div>
                )}
                {facade > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500"><Ruler size={20} /></div>
                    <div>
                      <div className="text-xs text-slate-400 font-medium">Mặt tiền</div>
                      <div className="font-bold text-slate-800">{facade}m</div>
                    </div>
                  </div>
                )}
                {depth > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500"><ArrowUpRight size={20} /></div>
                    <div>
                      <div className="text-xs text-slate-400 font-medium">Chiều sâu</div>
                      <div className="font-bold text-slate-800">{depth}m</div>
                    </div>
                  </div>
                )}
                {direction && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500"><Compass size={20} /></div>
                    <div>
                      <div className="text-xs text-slate-400 font-medium">Hướng nhà</div>
                      <div className="font-bold text-slate-800">{DIRECTION_LABEL[direction] || direction}</div>
                    </div>
                  </div>
                )}
                {wideRoad && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500"><MoveHorizontal size={20} /></div>
                    <div>
                      <div className="text-xs text-slate-400 font-medium">Đường trước nhà</div>
                      <div className="font-bold text-slate-800">{wideRoad}</div>
                    </div>
                  </div>
                )}
                {furniture && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500"><Sofa size={20} /></div>
                    <div>
                      <div className="text-xs text-slate-400 font-medium">Nội thất</div>
                      <div className="font-bold text-slate-800">{typeof furniture === 'string' ? furniture : 'Đầy đủ'}</div>
                    </div>
                  </div>
                )}
             </div>
          </div>

          {/* ── Advantages tags (NEW) ── */}
          {advantages.length > 0 && (
            <div className="bg-white sm:rounded-2xl sm:border border-slate-200 p-5 sm:p-7 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Ưu điểm nổi bật</h2>
              <div className="flex flex-wrap gap-2">
                {advantages.map((adv: string, i: number) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 text-sm font-semibold rounded-xl border border-emerald-200/60">
                    <Zap size={14} className="text-emerald-500" />
                    {adv}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Area Price Analysis (NEW — unique value) ── */}
          <AreaPriceAnalysis listing={listing} />

          {/* ── Mortgage Calculator (NEW — unique value) ── */}
          {(listing.totalPrice || listing.price) > 0 && (
            <MortgageCalculator totalPrice={listing.totalPrice || listing.price} />
          )}

          {/* ── Nearby Places (NEW — unique value) ── */}
          <NearbyPlaces coordinates={listing.coordinates} />

          {/* ── Description ── */}
          {desc && (
            <div className="bg-white sm:rounded-2xl sm:border border-slate-200 p-5 sm:p-7 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-5">Thông tin chi tiết</h2>
              <div className="relative">
                <div
                  className={`text-[0.95rem] text-slate-700 leading-[1.8] ${!showFullDesc && desc.length > 600 ? 'line-clamp-[8] pb-10' : ''}`}
                  dangerouslySetInnerHTML={{ __html: desc.replace(/\n/g, '<br/>') }}
                />
                {!showFullDesc && desc.length > 600 && (
                  <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                )}
              </div>
              
              {desc.length > 600 && (
                <button 
                  className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-slate-50 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition-colors border border-slate-200"
                  onClick={() => setShowFullDesc(v => !v)}
                >
                  {showFullDesc ? 'Thu gọn nội dung' : 'Xem thêm nội dung'}
                </button>
              )}
            </div>
          )}

          {/* ── Legal Guide (NEW — unique value) ── */}
          <LegalGuide listing={listing} />

          {/* ── Auto FAQ (NEW — unique value for SEO) ── */}
          <AutoFAQ listing={listing} areaName={listing.address || ''} />

          {/* ── Radar Chart ── */}
          <div className="bg-white sm:rounded-2xl sm:border border-slate-200 p-5 sm:p-7 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-5">Đánh giá tiềm năng</h2>
            <PropertyRadarChart listing={listing} />
          </div>

          {/* Contact card moved higher */}

          {/* ── Similar Listings (SSR-enabled for SEO link equity) ── */}
          <SimilarListings listingId={id} initialItems={similarListings} />

          {/* ── AI Similar Listings (NEW) ── */}
          <SimilarPropertiesAI 
            propertyData={{
              property_type_name: PROPERTY_TYPE_LABEL[listing.propertyType] || 'Nhà',
              province_name: listing.adminunit?.provinceName || 'Hà Nội',
              district_name: listing.adminunit?.districtName || '',
              ward_name: listing.adminunit?.wardName || '',
              area: listing.area || 0,
              price: listing.totalPrice || listing.price || 0
            }} 
          />

          {/* ── Comments ── */}
          <CommentSection listingId={id} />

        </div>
        
        {/* Right Column removed for 1-column layout */}
        
      </div>
    </div>
  );
}
