'use client';

import dynamic from 'next/dynamic';
import { formatMoney, formatArea, formatDate } from '@/lib/utils/utils';
import { Phone, MapPin, Share2, Copy, ExternalLink, Calendar, Eye, ShieldCheck, Map, Building2, Trees, Ruler, Home, Landmark, Shield, Hammer, CreditCard, Navigation, Users, CheckCircle, Clock, Layers, Check } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

import ImageGallery from '../ListingDetail/ImageGallery';

const PropertyRadarChart = dynamic(() => import('../ListingDetail/PropertyRadarChart'), { ssr: false, loading: () => <div className="h-64 bg-slate-50 animate-pulse rounded-sm mt-4"></div> });
const ProjectLocationMap = dynamic(() => import('./ProjectLocationMap'), {
  ssr: false,
  loading: () => <div className="w-full h-[400px] bg-slate-100 animate-pulse rounded-2xl border border-slate-200 mt-4 flex items-center justify-center text-sm font-semibold text-slate-400">Đang tải bản đồ...</div>
});

function copyText(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

function renderHtml(htmlStr: string | undefined | null) {
  if (!htmlStr) return { __html: 'Thông tin đang được cập nhật.' };
  // If it doesn't contain HTML tags, replace newlines with <br/>
  if (!/<[a-z][\s\S]*>/i.test(htmlStr)) {
    return { __html: htmlStr.replace(/\n/g, '<br/>') };
  }
  return { __html: htmlStr };
}

interface Props {
  project: any;
  currentUrl?: string;
  isInModal?: boolean;
}

const TABS = [
  { id: 'overview', label: 'Tổng Quan', icon: Home },
  { id: 'investor', label: 'Chủ Đầu Tư', icon: Landmark },
  { id: 'utilities', label: 'Tiện Ích', icon: Trees },
  { id: 'legal', label: 'Pháp Lý', icon: Shield },
  { id: 'progress', label: 'Tiến Độ', icon: Hammer },
  { id: 'policy', label: 'Chính Sách', icon: CreditCard },
  { id: 'location', label: 'Vị Trí', icon: Navigation },
];

export default function ProjectDetailContent({ project, currentUrl, isInModal = false }: Props) {
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  if (!project) return null;

  const id = String(project._id);
  const desc = project.description || '';
  const phone = project.contact?.phones?.[0] || project.contact?.phone || null;

  const handleCopy = () => {
    copyText(currentUrl || window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const url = currentUrl || window.location.href;
    if (navigator.share) {
      navigator.share({ title: project.title, url }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  // Determine available tabs based on data
  const availableTabs = TABS.filter(tab => {
    if (tab.id === 'overview') return true;
    if (tab.id === 'investor') return project.investorName;
    if (tab.id === 'utilities') return project.utilitiesDescription;
    if (tab.id === 'legal') return project.juridical?.description || project.juridical?.hasBusinessLicense;
    if (tab.id === 'progress') return project.constructionProgress?.description || project.constructionProgress?.images?.length;
    if (tab.id === 'policy') return project.salePolicy?.description;
    if (tab.id === 'location') return project.locationDescription || project.coordinates;
    return true;
  });

  // ── Stat cards data ──
  const statsCards = [
    { label: 'Quy mô', value: project.totalArea || (project.area > 0 ? formatArea(project.area) : null), icon: Ruler },
    { label: 'Số tòa', value: project.totalBuilding || null, icon: Building2 },
    { label: 'Số căn hộ', value: project.totalApartment || null, icon: Home },
    { label: 'Số tầng', value: project.totalFloor || null, icon: Layers },
    { label: 'Mật độ XD', value: project.buildingDensity || null, icon: Map },
    { label: 'Sở hữu', value: project.ownership || null, icon: ShieldCheck },
    { label: 'Loại hình', value: project.projectTypes?.join(', ') || null, icon: Trees },
    { label: 'Trạng thái', value: project.status === 'handedOver' ? 'Đã bàn giao' : project.status === 'onSale' ? 'Đang mở bán' : project.status || null, icon: CheckCircle },
  ].filter(s => s.value);

  const ContactCard = ({ isSticky = false }) => (
    <div className={`${isSticky ? 'sticky top-24' : `mt-6 ${!isInModal ? 'lg:hidden' : ''}`} bg-white sm:rounded-2xl sm:border border-slate-200 p-6 shadow-sm flex flex-col gap-5`}>
      {/* Investor logo & name */}
      {project.investorName && (
        <div className="flex items-center gap-4">
          {project.investorLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.investorLogo} alt={project.investorName} className="w-14 h-14 rounded-full object-contain bg-slate-50 border border-slate-100 p-1" />
          ) : (
            <div className="w-14 h-14 bg-gradient-to-br from-amber-600 to-orange-500 text-white flex items-center justify-center font-extrabold text-2xl rounded-full shadow-inner">
              {project.investorName.charAt(0)}
            </div>
          )}
          <div>
            <div className="text-lg font-bold text-slate-900 line-clamp-1">{project.investorName}</div>
            <div className="text-sm text-slate-500 mt-1 flex items-center gap-1"><ShieldCheck size={14} className="text-emerald-500" /> Chủ đầu tư</div>
          </div>
        </div>
      )}
      {!project.investorName && (
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-amber-600 to-orange-500 text-white flex items-center justify-center font-extrabold text-2xl rounded-full shadow-inner">D</div>
          <div>
            <div className="text-lg font-bold text-slate-900">Ban Quản Lý Dự Án</div>
            <div className="text-sm text-slate-500 mt-1 flex items-center gap-1"><ShieldCheck size={14} className="text-emerald-500" /> Thông tin chính thức</div>
          </div>
        </div>
      )}
      
      <div className="flex flex-col gap-3">
        <button className="w-full flex items-center justify-center gap-2 py-3 px-4 text-[0.95rem] font-bold transition-all duration-200 bg-amber-500 text-white hover:bg-amber-600 rounded-xl shadow-[0_4px_14px_0_rgba(245,158,11,0.39)] hover:-translate-y-[1px]">
          Nhận báo giá & CSBH
        </button>
        {phone && phone !== '19001881' && (
          <a href={`tel:${phone}`} className="w-full flex items-center justify-center gap-2 py-3 px-4 text-[0.95rem] font-bold no-underline transition-all duration-200 bg-slate-900 text-white hover:bg-slate-800 rounded-xl shadow-sm">
            <Phone size={18} /> Hotline: {phone}
          </a>
        )}
      </div>

      {/* Quick stats in sidebar */}
      {statsCards.length > 0 && (
        <div className="border-t border-slate-100 pt-4 mt-1">
          <div className="text-sm font-semibold text-slate-500 mb-3">Thông số dự án</div>
          <div className="grid grid-cols-2 gap-3">
            {statsCards.slice(0, 6).map((stat, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <stat.icon size={14} className="text-slate-400 shrink-0" />
                <div>
                  <div className="text-[11px] text-slate-400">{stat.label}</div>
                  <div className="font-semibold text-slate-700 text-[13px] line-clamp-1">{stat.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-[1280px] mx-auto px-0 sm:px-4 lg:px-8 py-0 lg:py-6 bg-white sm:bg-slate-50 min-h-screen">
      
      {/* ── Gallery ── */}
      <ImageGallery images={project.images || []} listingId={id} title={project.title} />

      <div className={isInModal ? "flex flex-col gap-6 mt-6" : "flex flex-col lg:grid lg:grid-cols-[1fr_380px] gap-8 mt-0 lg:mt-8"}>
        
        {/* Left Column (Main Content) */}
        <div className="flex flex-col gap-6">
          
          <div className="bg-white sm:rounded-2xl sm:border border-slate-200 p-5 sm:p-7 shadow-sm">
            {/* ── Title block ── */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <span className="text-[12px] font-bold py-1 px-3 rounded-md bg-amber-50 text-amber-700 tracking-wide">Dự án BĐS</span>
              {project.projectTypes?.map((pt: string, i: number) => (
                <span key={i} className="text-[12px] font-bold py-1 px-3 rounded-md bg-indigo-50 text-indigo-700 tracking-wide">{pt}</span>
              ))}
              {project.status && (
                <span className={`text-[12px] font-bold py-1 px-3 rounded-md flex items-center gap-1.5 tracking-wide ${
                  project.status === 'handedOver' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                }`}>
                  {project.status === 'handedOver' ? (
                    <>
                      <Check size={13} strokeWidth={2} /> Đã bàn giao
                    </>
                  ) : project.status === 'onSale' ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" /> Đang mở bán
                    </>
                  ) : (
                    project.status
                  )}
                </span>
              )}
            </div>
            
            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 leading-snug mb-1 tracking-tight">
              {project.tradeName || project.title}
            </h1>
            {project.tradeName && project.title !== project.tradeName && (
              <div className="text-base text-slate-500 mb-4">{project.title}</div>
            )}
            
            <div className="flex items-start justify-between gap-4 flex-wrap pb-6 border-b border-slate-100">
              {(project.address || project.streetName) && (
                <div className="flex flex-col gap-2 flex-1">
                  <span className="flex items-start gap-1.5 text-[0.95rem] text-slate-600 font-medium">
                    <MapPin size={18} className="text-red-500 shrink-0 mt-[2px]" />
                    {project.address || project.streetName}
                  </span>
                </div>
              )}
              <div className="flex gap-4 items-center shrink-0">
                <div className="flex gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                  <button className="w-9 h-9 rounded-md bg-white text-slate-700 hover:text-amber-600 shadow-sm flex items-center justify-center transition-all hover:shadow" onClick={handleShare} title="Chia sẻ"><Share2 size={16} /></button>
                  <button className="relative w-9 h-9 rounded-md bg-white text-slate-700 hover:text-amber-600 shadow-sm flex items-center justify-center transition-all hover:shadow" onClick={handleCopy} title={copied ? 'Đã copy!' : 'Copy link'}>
                    <Copy size={16} />
                    {copied && <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[11px] py-1 px-2 rounded whitespace-nowrap">Đã copy!</span>}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Price & Area banner ── */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-6">
              <div>
                <div className="text-sm text-slate-500 font-semibold mb-1">Mức giá</div>
                <div className="text-3xl font-black text-amber-600 tracking-tight">{project.price > 0 ? formatMoney(project.price) : 'Đang cập nhật'}</div>
              </div>
              <div className="border-l-2 border-slate-100 pl-6 flex-1 hidden sm:block">
                <div className="text-sm text-slate-500 font-semibold mb-1">Quy mô diện tích</div>
                <div className="text-xl font-bold text-slate-700">{project.totalArea || (project.area > 0 ? formatArea(project.area) : 'Đang cập nhật')}</div>
              </div>
              {project.investorName && (
                <div className="border-l-2 border-slate-100 pl-6 hidden md:block">
                  <div className="text-sm text-slate-500 font-semibold mb-1">Chủ đầu tư</div>
                  <div className="text-base font-bold text-slate-700 line-clamp-1">{project.investorName}</div>
                </div>
              )}
            </div>
          </div>

          {/* ── Tabbed Navigation ── */}
          {availableTabs.length > 1 && (
            <div className="bg-white sm:rounded-2xl sm:border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex overflow-x-auto border-b border-slate-200 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
                {availableTabs.map(tab => (
                  <button
                    key={tab.id}
                    className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-all border-b-2 ${
                      activeTab === tab.id
                        ? 'text-amber-600 border-amber-500 bg-amber-50/50'
                        : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <tab.icon size={16} />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-5 sm:p-7">
                {/* ── Overview Tab ── */}
                {activeTab === 'overview' && (
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-5">Tổng quan dự án</h2>
                    {statsCards.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                        {statsCards.map((stat, i) => (
                          <div key={i} className="flex items-center gap-3 p-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-100">
                            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                              <stat.icon size={20} />
                            </div>
                            <div>
                              <div className="text-xs text-slate-400 font-medium">{stat.label}</div>
                              <div className="font-bold text-slate-800 text-sm">{stat.value}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Description */}
                    {desc && (
                      <div className="relative">
                        <div
                          className={`text-[0.95rem] text-slate-700 leading-[1.8] ${!showFullDesc && desc.length > 800 ? 'line-clamp-[12] pb-10' : ''}`}
                          dangerouslySetInnerHTML={{ __html: desc.replace(/\n/g, '<br/>') }}
                        />
                        {!showFullDesc && desc.length > 800 && (
                          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                        )}
                        {desc.length > 800 && (
                          <button 
                            className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-slate-50 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition-colors border border-slate-200"
                            onClick={() => setShowFullDesc(v => !v)}
                          >
                            {showFullDesc ? 'Thu gọn nội dung' : 'Xem thêm nội dung'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Investor Tab ── */}
                {activeTab === 'investor' && project.investorName && (
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-5">Thông tin Chủ đầu tư</h2>
                    <div className="flex items-start gap-5 p-5 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-100 mb-6">
                      {project.investorLogo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={project.investorLogo} alt={project.investorName} className="w-20 h-20 rounded-xl object-contain bg-white border border-slate-200 p-2 shrink-0" />
                      )}
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{project.investorName}</h3>
                        <div className="flex items-center gap-2 mt-1 text-sm text-emerald-600">
                          <ShieldCheck size={14} /> Chủ đầu tư uy tín
                        </div>
                      </div>
                    </div>
                    {project.investorDescription && (
                      <div className="text-[0.95rem] text-slate-700 leading-[1.8] whitespace-pre-line">
                        {project.investorDescription.substring(0, 2000)}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Utilities Tab ── */}
                {activeTab === 'utilities' && (
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-5">Tiện ích dự án</h2>
                    <div className="text-[0.95rem] text-slate-700 leading-[1.8] whitespace-pre-line">
                      {project.utilitiesDescription || 'Thông tin đang được cập nhật.'}
                    </div>
                  </div>
                )}

                {/* ── Legal Tab ── */}
                {activeTab === 'legal' && (
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-5">Thông tin Pháp lý</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                      {[
                        { label: 'Giấy phép KD', ok: project.juridical?.hasBusinessLicense },
                        { label: 'Giấy phép XD', ok: project.juridical?.hasConstructionPermit },
                        { label: 'Bảo lãnh NH', ok: project.juridical?.hasBankGuarantee },
                      ].map((item, i) => (
                        <div key={i} className={`p-4 rounded-xl border ${item.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'} flex items-center gap-3`}>
                          <CheckCircle size={20} className={item.ok ? 'text-emerald-500' : 'text-slate-300'} />
                          <span className={`font-semibold text-sm ${item.ok ? 'text-emerald-700' : 'text-slate-400'}`}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                    <div 
                      className="text-[0.95rem] text-slate-700 leading-[1.8] rich-text-content"
                      dangerouslySetInnerHTML={renderHtml(project.juridical?.description)}
                    />
                  </div>
                )}

                {/* ── Progress Tab ── */}
                {activeTab === 'progress' && (
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-5">Tiến độ xây dựng</h2>
                    <div 
                      className="text-[0.95rem] text-slate-700 leading-[1.8] mb-6 rich-text-content"
                      dangerouslySetInnerHTML={renderHtml(project.constructionProgress?.description)}
                    />
                    {project.constructionProgress?.images?.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {project.constructionProgress.images.map((img: string, i: number) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={img} alt={`Tiến độ ${i + 1}`} className="rounded-xl w-full aspect-video object-cover border border-slate-200" />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Sale Policy Tab ── */}
                {activeTab === 'policy' && (
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-5">Chính sách bán hàng</h2>
                    <div 
                      className="text-[0.95rem] text-slate-700 leading-[1.8] rich-text-content"
                      dangerouslySetInnerHTML={renderHtml(project.salePolicy?.description)}
                    />
                  </div>
                )}

                {/* ── Location Tab ── */}
                {activeTab === 'location' && (
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-5">Vị trí & Giao thông</h2>
                    <div 
                      className="text-[0.95rem] text-slate-700 leading-[1.8] mb-6 rich-text-content"
                      dangerouslySetInnerHTML={renderHtml(project.locationDescription)}
                    />
                    {project.coordinates && (
                      <ProjectLocationMap 
                        coordinates={project.coordinates} 
                        title={project.tradeName || project.title} 
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mobile contact */}
          <ContactCard isSticky={false} />
        </div>
        
        {/* Right Column (Sticky Sidebar) */}
        {!isInModal && (
          <div className="hidden lg:block relative">
            <ContactCard isSticky={true} />
          </div>
        )}
        
      </div>
    </div>
  );
}
