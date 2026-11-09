import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getRealEstatesInPolygon, countRealEstates } from '@/lib/db/realEstate';
import { getAdminUnit, getBreadcrumbs, fetchGeoFeatures, extractGeoCenter, getWardsByProvince } from '@/lib/geo/geoService';
import { JsonLd } from '@/components/JsonLd';
import { makeUrlSlug, getImageUrl, getRealEstateUrl } from '@/lib/utils/utils';
import { PROVINCES, slugToProvince } from '@/lib/utils/province';
import { MapProvider } from '@/components/Map/MapContext';
import InteractiveMapLayout from '@/components/Map/InteractiveMapLayout';
import ProvinceLinks from '@/components/SEO/ProvinceLinks';
import { Phone, MessageCircle, Home, Building, Trees, ImageIcon, BadgePercent, Bed, MapPin, ChevronDown } from 'lucide-react';

interface Props {
  params: Promise<{ province: string }>;
  searchParams: Promise<Record<string, string>>;
}

// ISR: revalidate every 60 seconds
export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { province } = await params;

  // Use PROVINCES constant for display name — works for both current and legacy (merged) slugs
  const locationName = PROVINCES[province] ? slugToProvince(province) : null;
  if (!locationName) {
    notFound();
  }

  const [listingCount] = await Promise.all([
    countRealEstates({ province }, null).catch(() => 0),
  ]);

  const month = new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  // Province-specific keyword boosters – targets high-impression queries from GSC
  const provinceBoost: Record<string, { extra: string; descSuffix: string }> = {
    'lam-dong': {
      extra: 'bds ven đà lạt, bất động sản vùng ven đà lạt, nhà đất đà lạt bảo lộc, đất nền lâm đồng',
      descSuffix: ' Chuyên bất động sản Đà Lạt, Bảo Lộc và vùng ven Lâm Đồng. Xem đất nền, nhà vườn, biệt thự nghỉ dưỡng.',
    },
    'ha-noi': {
      extra: 'mua bán nhà hà nội, nhà đất hà nội chính chủ, chung cư hà nội, đất nền hà nội',
      descSuffix: ' Tin đăng nhà đất chính chủ tại Hà Nội, chung cư, nhà phố, đất nền các quận huyện.',
    },
    'ho-chi-minh': {
      extra: 'mua bán nhà tphcm, nhà đất hcm chính chủ, chung cư tphcm, đất nền bình dương',
      descSuffix: ' Hàng nghìn tin nhà đất TPHCM: chung cư, nhà phố, đất nền quận 1-12 và vùng ven.',
    },
    'binh-duong': {
      extra: 'nhà đất bình dương, đất nền bình dương, khu công nghiệp bình dương',
      descSuffix: ' Chuyên nhà đất Bình Dương: đất nền, chung cư, nhà phố các khu công nghiệp.',
    },
    'da-nang': {
      extra: 'mua bán nhà đà nẵng, nhà đất đà nẵng biển, bán nhà lê thị hồng gấm đà nẵng, nhà phố hải châu, bất động sản đà nẵng',
      descSuffix: ' Nhà đất Đà Nẵng ven biển, trung tâm Hải Châu, Thanh Khê và các quận mới phát triển.',
    },
    'khanh-hoa': {
      extra: 'nhà đất nha trang, bất động sản cam ranh, đất nền khánh hòa ven biển, kn paradise cam ranh, sealink mũi né',
      descSuffix: ' Nhà đất Nha Trang, Cam Ranh, Diên Khánh – bất động sản ven biển Khánh Hòa.',
    },
    'binh-thuan': {
      extra: 'nhà đất phan thiết, bất động sản mũi né, đất nền bình thuận, arita home mũi né',
      descSuffix: ' Nhà đất Phan Thiết, Mũi Né và các khu du lịch Bình Thuận.',
    },
    'quang-ninh': {
      extra: 'bán chung cư hạ long, bất động sản hạ long, newlife bãi cháy, căn hộ hạ long',
      descSuffix: ' Chuyên nhà đất Hạ Long, Quảng Ninh: chung cư ven vịnh, biệt thự nghỉ dưỡng, đất nền.',
    },
    'bac-ninh': {
      extra: 'mua bán nhà bắc ninh, chung cư bắc ninh, đất nền bắc ninh, thanh bình bắc ninh',
      descSuffix: ' Nhà đất Bắc Ninh: đất nền khu công nghiệp, chung cư và nhà phố các huyện.',
    },
    'nghe-an': {
      extra: 'nhà đất nghệ an, mua bán nhà diễn châu vinh, đất nền nghệ an',
      descSuffix: ' Nhà đất Nghệ An: TP Vinh, Diễn Châu, Cửa Lò và các huyện lân cận.',
    },
  };

  const boost = provinceBoost[province];
  const countStr = listingCount > 0 ? `${listingCount.toLocaleString('vi-VN')} tin đăng` : null;
  const title = countStr
    ? `${countStr} nhà đất ${locationName} chính chủ – ${month} | NhaDat.City`
    : `Mua bán nhà đất ${locationName} chính chủ – Cập nhật ${month} | NhaDat.City`;
  const description = countStr
    ? `${countStr} nhà đất chính chủ tại ${locationName}. Cập nhật ${month}, pháp lý rõ ràng, không qua môi giới.${boost?.descSuffix ?? ''}`
    : `Tìm kiếm nhà đất chính chủ tại ${locationName}. Hàng nghìn tin đăng bất động sản giá tốt, pháp lý rõ ràng, không qua môi giới. Xem bản đồ quy hoạch ${locationName} trực tuyến.${boost?.descSuffix ?? ''}`;
  const extraKeywords = boost?.extra ? `, ${boost.extra}` : '';

  return {
    title,
    description,
    keywords: `mua bán nhà đất ${locationName}, nhà đất chính chủ ${locationName}, bất động sản ${locationName}, quy hoạch ${locationName}, giá nhà đất ${locationName}, ${province} nhadat.city${extraKeywords}`,
    alternates: {
      canonical: `https://nhadat.city/${province}`,
      languages: {
        'vi-VN': `https://nhadat.city/${province}`,
      },
    },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
    openGraph: {
      title,
      description,
      url: `https://nhadat.city/${province}`,
      siteName: 'NhaDat.City',
      locale: 'vi_VN',
      type: 'website',
      images: [{ url: 'https://nhadat.city/og-image.jpg', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
    },
  };
}

export default async function ListPage({ params, searchParams }: Props) {
  const { province } = await params;
  const sp = await searchParams;

  // Build filters from searchParams
  const filters: any = { 
    province, 
  };

  // Default to 60 days unless explicitly 'all' or another value
  if (sp.dateRange === 'all') {
    filters.dateRange = undefined;
  } else {
    filters.dateRange = Number(sp.dateRange) || 60;
  }
  
  if (sp.minPrice || sp.maxPrice) {
    filters.totalPriceRange = [
      sp.minPrice ? Number(sp.minPrice) : null,
      sp.maxPrice ? Number(sp.maxPrice) : null,
    ];
  }
  if (sp.minArea || sp.maxArea) {
    filters.areaRange = [
      sp.minArea ? Number(sp.minArea) : null,
      sp.maxArea ? Number(sp.maxArea) : null,
    ];
  }
  if (sp.propertyType) {
    filters.propertyType = sp.propertyType.split(',');
  }

  // Fetch initial data SERVER-SIDE — this is what gives us fast FCP/LCP
  const [fetchedItems, adminUnitResult, breadcrumbs, geoFeatures, localWards] = await Promise.all([
    getRealEstatesInPolygon(null, filters, 30),
    getAdminUnit(province, null),
    getBreadcrumbs(province),
    fetchGeoFeatures(province),
    getWardsByProvince(province, 60)
  ]);

  let initialItems = fetchedItems;
  // Fallback: if we have fewer than 30 recent items, query older active items to avoid empty lists/thin content for search bots
  if (initialItems.length < 30 && filters.dateRange !== undefined) {
    const fallbackFilters = { ...filters, dateRange: undefined };
    initialItems = await getRealEstatesInPolygon(null, fallbackFilters, 30);
  }

  // Use PROVINCES constant for display — handles legacy (merged) provinces correctly
  const locationName = slugToProvince(province);

  // Validate: must be a known province slug (current or legacy)
  if (!PROVINCES[province]) {
    notFound();
  }

  // adminUnit may be null for legacy slugs — that's OK, we still show listings
  const adminUnit = adminUnitResult;
  const geoCenter = geoFeatures ? extractGeoCenter(geoFeatures) : undefined;
  let initialCenter: [number, number] | undefined = geoCenter ? [geoCenter.longitude, geoCenter.latitude] : undefined;

  if (!initialCenter && adminUnit?.province?.lon && adminUnit?.province?.lat) {
    initialCenter = [adminUnit.province.lon, adminUnit.province.lat];
  }

  if (!initialCenter && initialItems.length > 0) {
    const lngs = initialItems.map(i => i.longitude).filter(Boolean);
    const lats = initialItems.map(i => i.latitude).filter(Boolean);
    if (lngs.length > 0 && lats.length > 0) {
      initialCenter = [
        lngs.reduce((a, b) => a + b, 0) / lngs.length,
        lats.reduce((a, b) => a + b, 0) / lats.length
      ];
    }
  }

  // Build JSON-LD for SEO
  const baseUrl = 'https://nhadat.city';
  const month = new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Mua bán nhà đất ${locationName}`,
    description: `Danh sách bất động sản tại ${locationName}`,
    numberOfItems: initialItems.length,
    itemListElement: initialItems.slice(0, 20).map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${baseUrl}${getRealEstateUrl(item)}`,
    })),
  };

  // BreadcrumbList JSON-LD
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'NhaDat.City', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: locationName, item: `${baseUrl}/${province}` },
    ],
  };

  // FAQPage JSON-LD – rich snippets for category pages
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Mua bán nhà đất tại ${locationName} ở đâu uy tín?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `NhaDat.City cung cấp ${initialItems.length > 0 ? initialItems.length + '+' : 'hàng nghìn'} tin đăng mua bán nhà đất chính chủ tại ${locationName}, cập nhật ${month}. Tất cả tin đăng đều có địa chỉ rõ ràng, hình ảnh thực tế và thông tin liên hệ trực tiếp với chủ nhà.`,
        },
      },
      {
        '@type': 'Question',
        name: `Bản đồ quy hoạch ${locationName} xem ở đâu?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `NhaDat.City tích hợp bản đồ quy hoạch đô thị ${locationName} trực tuyến, cập nhật theo dữ liệu chính thức. Bạn có thể tra cứu quy hoạch theo lô đất, phân khu chức năng tại trang bản đồ quy hoạch ${locationName}.`,
        },
      },
      {
        '@type': 'Question',
        name: `Giá nhà đất tại ${locationName} hiện nay bao nhiêu?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Giá bất động sản tại ${locationName} dao động tùy vị trí, loại hình và diện tích. Xem danh sách tin đăng thực tế trên NhaDat.City để có thông tin giá nhà đất ${locationName} mới nhất từ chính chủ.`,
        },
      },
    ],
  };

  // AdministrativeArea / Place JSON-LD
  const placeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AdministrativeArea',
    name: locationName,
    url: `${baseUrl}/${province}`,
    description: `Thông tin bản đồ quy hoạch và mua bán nhà đất tại ${locationName}`,
    ...(geoCenter ? {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: geoCenter.latitude,
        longitude: geoCenter.longitude,
      },
    } : {}),
  };

  return (
    <main className="min-h-screen w-full bg-slate-950 text-white flex flex-col relative overflow-x-hidden">
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={placeJsonLd} />
      <JsonLd data={faqJsonLd} />

      <MapProvider 
        initialListings={JSON.parse(JSON.stringify(initialItems))}
        initialProvince={province}
        initialLocationName={locationName}
        initialBreadcrumbs={breadcrumbs}
        initialCenter={initialCenter}
        initialZoom={10}
      >
        <InteractiveMapLayout listingCount={initialItems.length} locationName={locationName}>
          {/* Visible Full-Featured SSR SEO Content & Lead Generation Section */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 w-full">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="text-xs text-slate-400">
          <ol className="flex items-center space-x-2 flex-wrap">
            <li><a href="/" className="hover:text-emerald-400">NhaDat.City</a></li>
            <li><span>/</span></li>
            <li className="text-emerald-400 font-semibold">Nhà đất {locationName}</li>
          </ol>
        </nav>

        {/* Page Header */}
        <header className="border-b border-slate-800 pb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Bất động sản {locationName} {initialItems.length > 0 ? `(${initialItems.length} tin đăng)` : ''}
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Tổng hợp danh sách mua bán nhà đất, biệt thự, căn hộ chung cư chính chủ tại {locationName} mới nhất {month}. Xem bản đồ quy hoạch chi tiết và so sánh giá khu vực trực tuyến.
          </p>
        </header>

        {/* Sticky Lead Generation CTA Bar */}
        <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-900/80 border border-emerald-500/30 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div>
            <h3 className="text-base font-bold text-white">Cần tư vấn đất nền / nhà phố tại {locationName}?</h3>
            <p className="text-xs text-slate-300">Kết nối trực tiếp chủ nhà, kiểm tra pháp lý sổ đỏ và vị trí quy hoạch chính xác 100%.</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <a
              href="tel:+84000000000"
              className="flex-1 sm:flex-none text-center px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md no-underline inline-flex items-center justify-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
              <span>Gọi tư vấn ngay</span>
            </a>
            <a
              href="https://zalo.me"
              target="_blank"
              rel="noreferrer"
              className="flex-1 sm:flex-none text-center px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all shadow-md no-underline inline-flex items-center justify-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
              <span>Chat Zalo trực tiếp</span>
            </a>
          </div>
        </div>

        {/* Quick Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
          <span className="text-xs text-slate-400 shrink-0">Lọc nhanh:</span>
          <a href={`/${province}`} className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold shrink-0 no-underline">Tất cả</a>
          <a href={`/${province}?propertyType=NhaRieng`} className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs shrink-0 no-underline inline-flex items-center gap-1">
            <Home className="w-3.5 h-3.5" strokeWidth={1.5} /> Nhà riêng
          </a>
          <a href={`/${province}?propertyType=ChungCu`} className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs shrink-0 no-underline inline-flex items-center gap-1">
            <Building className="w-3.5 h-3.5" strokeWidth={1.5} /> Chung cư
          </a>
          <a href={`/${province}?propertyType=DatNen`} className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs shrink-0 no-underline inline-flex items-center gap-1">
            <Trees className="w-3.5 h-3.5" strokeWidth={1.5} /> Đất nền
          </a>
          <a href={`/${province}?maxPrice=2000000000`} className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs shrink-0 no-underline">Dưới 2 tỷ</a>
          <a href={`/${province}?minPrice=2000000000&maxPrice=5000000000`} className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs shrink-0 no-underline">2 - 5 tỷ</a>
          <a href={`/${province}?minPrice=5000000000`} className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs shrink-0 no-underline">Trên 5 tỷ</a>
        </div>

        {/* Listing Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">
              Tin đăng mua bán nhà đất mới nhất tại {locationName}
            </h2>
            <span className="text-xs text-slate-400">Hiển thị {initialItems.length} bất động sản</span>
          </div>

          {initialItems.length > 0 ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 list-none p-0 margin-0">
              {initialItems.map((item) => {
                const itemUrl = getRealEstateUrl(item);
                const thumb = item.images?.[0] ? getImageUrl(item.images[0], String(item._id), 400, 260) : null;
                const priceFormatted = item.price ? `${(item.price / 1000000000).toFixed(2)} Tỷ` : (item.totalPrice ? `${(item.totalPrice / 1000000000).toFixed(2)} Tỷ` : 'Thỏa thuận');
                const pricePerM2 = (item.price && item.area && item.area > 0) ? `${(item.price / item.area / 1000000).toFixed(1)} tr/m²` : null;

                return (
                  <li key={item._id.toString()} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-emerald-500/50 hover:shadow-2xl transition-all group">
                    <a href={itemUrl} className="block relative w-full h-48 bg-slate-950 overflow-hidden no-underline">
                      {thumb ? (
                        <img 
                          src={thumb} 
                          alt={item.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500 text-xs gap-1.5">
                          <ImageIcon className="w-4 h-4 text-slate-500" strokeWidth={1.5} />
                          <span>Hình ảnh đang cập nhật</span>
                        </div>
                      )}
                      <div className="absolute top-3 left-3 flex gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-white bg-emerald-600/90 backdrop-blur-md px-2.5 py-1 rounded-lg shadow-md">
                          {priceFormatted}
                        </span>
                        {item.area ? (
                          <span className="text-[11px] font-semibold text-slate-200 bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded-lg">
                            {item.area} m²
                          </span>
                        ) : null}
                      </div>
                    </a>

                    <div className="p-4 flex flex-col flex-1 justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-white line-clamp-2 group-hover:text-emerald-400 transition-colors">
                          <a href={itemUrl} className="text-white hover:text-emerald-400 no-underline">{item.title}</a>
                        </h3>
                        <div className="flex items-center gap-3 mt-2 text-xs text-emerald-400 font-medium">
                          {pricePerM2 ? <span className="inline-flex items-center gap-1"><BadgePercent className="w-3.5 h-3.5" strokeWidth={1.5} /> {pricePerM2}</span> : null}
                          {item.bedrooms ? <span className="inline-flex items-center gap-1 text-slate-300"><Bed className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.5} /> {item.bedrooms} PN</span> : null}
                        </div>
                        <p className="mt-2 text-xs text-slate-400 line-clamp-2">
                          {item.description || `Nhà đất chính chủ tại ${locationName}, pháp lý đầy đủ, sổ đỏ riêng.`}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                        <span className="truncate max-w-[180px] inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={1.5} />
                          {item.adminunit?.ward || locationName}
                        </span>
                        <a href={itemUrl} className="text-emerald-400 font-semibold hover:underline shrink-0 no-underline">
                          Xem chi tiết →
                        </a>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 bg-slate-900 p-4 rounded-lg border border-slate-800">
              Hiện chưa có tin đăng tại {locationName}. Tra cứu bản đồ quy hoạch hoặc liên hệ với chúng tôi để cập nhật thông tin nhà đất mới nhất.
            </p>
          )}
        </div>

        {/* Wards Navigation Matrix */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-base font-bold text-white mb-3">
            Tra cứu nhà đất theo xã / phường tại {locationName}
          </h2>
          <p className="text-xs text-slate-400 mb-4">Chọn xã, phường hoặc thị trấn để xem bản đồ quy hoạch và danh sách bất động sản chính chủ chi tiết:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {localWards && localWards.length > 0 ? (
              localWards.map((w: any) => (
                <a
                  key={w.CodeName}
                  href={`/${province}/${w.CodeName}`}
                  className="p-2.5 bg-slate-950/70 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/40 rounded-xl text-xs text-slate-300 hover:text-emerald-400 transition-all no-underline text-center truncate"
                >
                  Nhà đất {w.Name || w.tenXa}
                </a>
              ))
            ) : (adminUnit as any)?.wards && (adminUnit as any).wards.length > 0 ? (
              (adminUnit as any).wards.map((w: any) => (
                <a
                  key={w.CodeName || w.codeName || w.code}
                  href={`/${province}/${w.CodeName || w.codeName || w.code}`}
                  className="p-2.5 bg-slate-950/70 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/40 rounded-xl text-xs text-slate-300 hover:text-emerald-400 transition-all no-underline text-center truncate"
                >
                  Nhà đất {w.Name || w.name || w.tenXa}
                </a>
              ))
            ) : (
              <p className="text-xs text-slate-400 col-span-full py-4 text-center">
                Đang cập nhật danh sách xã, phường tại {locationName}...
              </p>
            )}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-white">
            Câu hỏi thường gặp về bất động sản {locationName}
          </h2>
          <div className="space-y-3">
            <details className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 group" open>
              <summary className="text-xs sm:text-sm font-semibold text-slate-200 cursor-pointer list-none flex justify-between items-center">
                <span>Mua bán nhà đất tại {locationName} ở đâu uy tín?</span>
                <ChevronDown className="w-4 h-4 text-emerald-400 group-open:rotate-180 transition-transform" strokeWidth={1.5} />
              </summary>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                NhaDat.City cung cấp hàng nghìn tin đăng mua bán nhà đất chính chủ tại {locationName}, cập nhật mới nhất {month}. Tất cả tin đăng đều có địa chỉ rõ ràng, hình ảnh thực tế và thông tin liên hệ trực tiếp với chủ nhà.
              </p>
            </details>
            <details className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 group">
              <summary className="text-xs sm:text-sm font-semibold text-slate-200 cursor-pointer list-none flex justify-between items-center">
                <span>Bản đồ quy hoạch {locationName} xem ở đâu?</span>
                <ChevronDown className="w-4 h-4 text-emerald-400 group-open:rotate-180 transition-transform" strokeWidth={1.5} />
              </summary>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                NhaDat.City tích hợp bản đồ quy hoạch đô thị {locationName} trực tuyến, cập nhật theo dữ liệu chính thức. Bạn có thể tra cứu quy hoạch theo từng thửa đất và phân khu chức năng.
              </p>
            </details>
          </div>
        </div>

        {/* Visible Internal Links Matrix Footer */}
        <ProvinceLinks currentProvince={province} className="rounded-xl border border-slate-800 bg-slate-900 text-slate-300" />
          </section>
        </InteractiveMapLayout>
      </MapProvider>
    </main>
  );
}
