import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getRealEstatesInPolygon, countRealEstates, getRealEstateById } from '@/lib/db/realEstate';
import { getAdminUnit, getBreadcrumbs, fetchGeoFeatures, extractGeoCenter } from '@/lib/geo/geoService';
import { JsonLd } from '@/components/JsonLd';
import { makeUrlSlug, getImageUrl, getRealEstateUrl } from '@/lib/utils/utils';
import { PROVINCES } from '@/lib/utils/province';
import { MapProvider } from '@/components/Map/MapContext';
import InteractiveMapLayout from '@/components/Map/InteractiveMapLayout';
import ProvinceLinks from '@/components/SEO/ProvinceLinks';
import { Phone, MessageCircle, Home, Building, Trees, ImageIcon, BadgePercent, Bed, MapPin, ChevronDown } from 'lucide-react';

interface Props {
  params: Promise<{ province: string; ward: string }>;
  searchParams: Promise<Record<string, string>>;
}

// ISR: revalidate every 60 seconds
export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { province, ward } = await params;
  const [adminUnit, listingCount] = await Promise.all([
    getAdminUnit(province, ward),
    countRealEstates({ province, ward }, null).catch(() => 0),
  ]);


  if (!adminUnit?.province || !adminUnit?.ward) {
    notFound();
  }

  const provinceName = adminUnit.province.Name;
  const wardName = adminUnit.ward.Name;
  const month = new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  // High-CTR title format: exact search query + call to action + listing count
  const countStr = listingCount > 0 ? `${listingCount.toLocaleString('vi-VN')} tin` : null;
  const title = countStr
    ? `Bán nhà đất ${wardName} ${provinceName} chính chủ (${countStr}) – Giá tốt ${month} | NhaDat.City`
    : `Mua bán nhà đất ${wardName} ${provinceName} chính chủ – Cập nhật ${month} | NhaDat.City`;

  // High-CTR description: price range, legal status, direct contact info, map preview
  const description = countStr
    ? `Danh sách ${countStr} mua bán nhà đất ${wardName}, ${provinceName} mới nhất ${month}. Thông tin chính chủ, sổ đỏ riêng, hỗ trợ vay ngân hàng, xem vị trí bản đồ quy hoạch trực tiếp.`
    : `Tổng hợp tin đăng mua bán nhà đất tại ${wardName}, ${provinceName} chính chủ giá tốt. Thông tin minh bạch, vị trí đẹp, xem bản đồ quy hoạch chi tiết ${month}.`;

  return {
    title,
    description,
    keywords: `mua bán nhà đất ${wardName}, nhà đất chính chủ ${wardName} ${provinceName}, bất động sản ${wardName}, quy hoạch ${wardName}, giá nhà đất ${wardName} ${provinceName}`,
    alternates: {
      canonical: `https://nhadat.city/${province}/${ward}`,
      languages: { 'vi-VN': `https://nhadat.city/${province}/${ward}` },
    },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
    openGraph: {
      title,
      description,
      url: `https://nhadat.city/${province}/${ward}`,
      siteName: 'NhaDat.City',
      locale: 'vi_VN',
      type: 'website',
      images: [{ url: 'https://nhadat.city/og-image.jpg', width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image' as const, title, description },
  };
}

export default async function ListPage({ params, searchParams }: Props) {
  const { province, ward } = await params;
  const sp = await searchParams;

  // Build filters from searchParams
  const filters: any = { 
    province, 
    ward,
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
    const pt = sp.propertyType.trim();
    if (!pt.includes(',')) {
      const matchedListing = await getRealEstateById(pt);
      if (matchedListing) {
        permanentRedirect(getRealEstateUrl(matchedListing));
      }
    }
    filters.propertyType = pt.split(',');
  }

  // Fetch initial data SERVER-SIDE — this is what gives us fast FCP/LCP
  const [fetchedItems, adminUnit, breadcrumbs, geoFeatures] = await Promise.all([
    getRealEstatesInPolygon(null, filters, 30),
    getAdminUnit(province, ward),
    getBreadcrumbs(province, ward),
    fetchGeoFeatures(province, ward)
  ]);

  let initialItems = fetchedItems;
  // Fallback: if we have fewer than 30 recent items, query older active items to avoid empty lists/thin content for search bots
  if (initialItems.length < 30 && filters.dateRange !== undefined) {
    const fallbackFilters = { ...filters, dateRange: undefined };
    initialItems = await getRealEstatesInPolygon(null, fallbackFilters, 30);
  }

  if (!adminUnit?.province || !adminUnit?.ward) {
    notFound();
  }

  // Canonical 301 redirect if URL slug had a prefix like xa-quang-lap -> quang-lap
  if (adminUnit.ward.CodeName && ward !== adminUnit.ward.CodeName) {
    permanentRedirect(`/${province}/${adminUnit.ward.CodeName}`);
  }

  const provinceName = adminUnit.province.Name;
  const wardName = adminUnit.ward.Name;
  const locationName = `${wardName}, ${provinceName}`;
  const geoCenter = geoFeatures ? extractGeoCenter(geoFeatures) : undefined;
  let initialCenter: [number, number] | undefined = geoCenter ? [geoCenter.longitude, geoCenter.latitude] : undefined;

  if (!initialCenter && adminUnit.ward.lon && adminUnit.ward.lat) {
    initialCenter = [adminUnit.ward.lon, adminUnit.ward.lat];
  } else if (!initialCenter && adminUnit.province.lon && adminUnit.province.lat) {
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
      { '@type': 'ListItem', position: 2, name: provinceName, item: `${baseUrl}/${province}` },
      { '@type': 'ListItem', position: 3, name: wardName, item: `${baseUrl}/${province}/${ward}` },
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
          text: `NhaDat.City cung cấp ${initialItems.length > 0 ? initialItems.length + '+' : 'nhiều'} tin đăng mua bán nhà đất chính chủ tại ${locationName}, cập nhật ${month}. Tất cả tin đăng đều có địa chỉ rõ ràng, hình ảnh thực tế và thông tin liên hệ trực tiếp với chủ nhà.`,
        },
      },
      {
        '@type': 'Question',
        name: `Giá nhà đất tại ${wardName} hiện nay bao nhiêu?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Giá bất động sản tại ${locationName} dao động tùy vị trí, loại hình và diện tích. Xem ${initialItems.length > 0 ? initialItems.length + ' tin đăng' : 'danh sách tin đăng'} thực tế trên NhaDat.City để có giá nhà đất ${wardName} mới nhất từ chính chủ.`,
        },
      },
      {
        '@type': 'Question',
        name: `Bản đồ quy hoạch ${wardName}, ${provinceName} xem ở đâu?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `NhaDat.City tích hợp bản đồ quy hoạch đô thị ${wardName}, ${provinceName} trực tuyến. Bạn có thể tra cứu quy hoạch theo lô đất, kiểm tra mục đích sử dụng đất và các hạn chế xây dựng tại khu vực này.`,
        },
      },
    ],
  };

  // AdministrativeArea / Place JSON-LD
  const placeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AdministrativeArea',
    name: locationName,
    url: `${baseUrl}/${province}/${ward}`,
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
        initialWard={ward}
        initialLocationName={locationName}
        initialBreadcrumbs={breadcrumbs}
        initialCenter={initialCenter}
        initialZoom={13}
        initialParcelId={sp.parcelId}
      >
        <InteractiveMapLayout listingCount={initialItems.length} locationName={locationName}>
          {/* Visible Full-Featured SSR SEO Content & Lead Generation Section */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 w-full">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="text-xs text-slate-400">
          <ol className="flex items-center space-x-2 flex-wrap">
            <li><a href="/" className="hover:text-emerald-400">NhaDat.City</a></li>
            <li><span>/</span></li>
            <li><a href={`/${province}`} className="hover:text-emerald-400">Nhà đất {provinceName}</a></li>
            <li><span>/</span></li>
            <li className="text-emerald-400 font-semibold">Nhà đất {wardName}</li>
          </ol>
        </nav>

        {/* Page Header */}
        <header className="border-b border-slate-800 pb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Mua bán nhà đất {wardName}, {provinceName} {initialItems.length > 0 ? `(${initialItems.length} tin đăng)` : ''}
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Tổng hợp tin đăng mua bán nhà đất chính chủ tại {locationName} mới nhất {month}. Thông tin vị trí đẹp, pháp lý sổ đỏ rõ ràng, xem trực tiếp bản đồ quy hoạch đô thị trực tuyến.
          </p>
        </header>

        {/* Sticky Lead Generation CTA Bar */}
        <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-900/80 border border-emerald-500/30 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div>
            <h3 className="text-base font-bold text-white">Cần tìm mua hoặc gửi bán nhà đất tại {wardName}?</h3>
            <p className="text-xs text-slate-300">Kết nối trực tiếp chủ nhà, không qua trung gian, tư vấn quy hoạch và sổ đỏ miễn phí.</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <a
              href="tel:+84000000000"
              className="flex-1 sm:flex-none text-center px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md inline-flex items-center justify-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
              <span>Gọi chính chủ ngay</span>
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
          <a href={`/${province}/${ward}`} className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold shrink-0 no-underline">Tất cả</a>
          <a href={`/${province}/${ward}?propertyType=NhaRieng`} className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs shrink-0 no-underline inline-flex items-center gap-1">
            <Home className="w-3.5 h-3.5" strokeWidth={1.5} /> Nhà riêng
          </a>
          <a href={`/${province}/${ward}?propertyType=ChungCu`} className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs shrink-0 no-underline inline-flex items-center gap-1">
            <Building className="w-3.5 h-3.5" strokeWidth={1.5} /> Chung cư
          </a>
          <a href={`/${province}/${ward}?propertyType=DatNen`} className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs shrink-0 no-underline inline-flex items-center gap-1">
            <Trees className="w-3.5 h-3.5" strokeWidth={1.5} /> Đất nền
          </a>
          <a href={`/${province}/${ward}?maxPrice=2000000000`} className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs shrink-0 no-underline">Dưới 2 tỷ</a>
          <a href={`/${province}/${ward}?minPrice=2000000000&maxPrice=5000000000`} className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs shrink-0 no-underline">2 - 5 tỷ</a>
          <a href={`/${province}/${ward}?minPrice=5000000000`} className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs shrink-0 no-underline">Trên 5 tỷ</a>
        </div>

        {/* Listing Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">
              Danh sách bất động sản nổi bật tại {locationName}
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
                          {wardName}
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
              Hiện chưa có tin đăng tại {wardName}. Bạn có thể tra cứu bản đồ quy hoạch hoặc đăng tin bán nhà đất tại khu vực này hoàn toàn miễn phí.
            </p>
          )}
        </div>

        {/* FAQ Section */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-white">
            Câu hỏi thường gặp về nhà đất {wardName}, {provinceName}
          </h2>
          <div className="space-y-3">
            <details className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 group" open>
              <summary className="text-xs sm:text-sm font-semibold text-slate-200 cursor-pointer list-none flex justify-between items-center">
                <span>Mua bán nhà đất tại {wardName} ở đâu uy tín?</span>
                <ChevronDown className="w-4 h-4 text-emerald-400 group-open:rotate-180 transition-transform" strokeWidth={1.5} />
              </summary>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                NhaDat.City cung cấp {initialItems.length > 0 ? initialItems.length + '+' : 'nhiều'} tin đăng mua bán nhà đất chính chủ tại {locationName}, cập nhật mới nhất {month}. Tất cả tin đăng đều có địa chỉ rõ ràng, hình ảnh thực tế và thông tin liên hệ trực tiếp với chủ nhà.
              </p>
            </details>
            <details className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 group">
              <summary className="text-xs sm:text-sm font-semibold text-slate-200 cursor-pointer list-none flex justify-between items-center">
                <span>Bản đồ quy hoạch {wardName}, {provinceName} xem ở đâu?</span>
                <ChevronDown className="w-4 h-4 text-emerald-400 group-open:rotate-180 transition-transform" strokeWidth={1.5} />
              </summary>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                NhaDat.City tích hợp bản đồ quy hoạch đô thị {wardName}, {provinceName} trực tuyến. Bạn có thể tra cứu quy hoạch theo lô đất, kiểm tra mục đích sử dụng đất và các hạn chế xây dựng tại khu vực này.
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
