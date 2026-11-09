import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { MapProvider } from '@/components/Map/MapContext';
import InteractiveMapLayout from '@/components/Map/InteractiveMapLayout';
import { PROVINCES } from '@/lib/utils/province';
import { getRealEstatesInPolygon } from '@/lib/db/realEstate';
import { makeUrlSlug, getImageUrl, getRealEstateUrl } from '@/lib/utils/utils';
import ProvinceLinks from '@/components/SEO/ProvinceLinks';
import { Home, Key, Map, Building2, ImageIcon, BadgePercent, Bed, MapPin } from 'lucide-react';

export const revalidate = 120; // Revalidate every 2 minutes

export const metadata: Metadata = {
  title: 'Bản đồ quy hoạch & mua bán nhà đất toàn quốc | NhaDat.City',
  description: 'Tra cứu bản đồ quy hoạch đô thị, tìm mua bán nhà đất chính chủ toàn 63 tỉnh thành. Hơn 1 triệu tin đăng cập nhật 24/7, không qua môi giới, pháp lý rõ ràng.',
  alternates: {
    canonical: 'https://nhadat.city',
  },
  openGraph: {
    title: 'Bản đồ quy hoạch & mua bán nhà đất toàn quốc | NhaDat.City',
    description: 'Tra cứu quy hoạch, giá nhà, hơn 1 triệu tin đăng chính chủ toàn quốc. Không qua môi giới.',
    url: 'https://nhadat.city',
    type: 'website',
    siteName: 'NhaDat.City',
    locale: 'vi_VN',
    images: [
      {
        url: 'https://nhadat.city/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Bản đồ quy hoạch & mua bán nhà đất toàn quốc | NhaDat.City',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bản đồ quy hoạch & mua bán nhà đất toàn quốc | NhaDat.City',
    description: 'Tra cứu quy hoạch, giá nhà, hơn 1 triệu tin đăng chính chủ toàn quốc.',
    images: ['https://nhadat.city/og-image.jpg'],
  },
};

const localBusinessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'RealEstateAgent',
  name: 'NhaDat.City',
  url: 'https://nhadat.city',
  description: 'Nền tảng bất động sản thông minh: tra cứu bản đồ quy hoạch, tìm nhà đất chính chủ toàn quốc.',
  logo: 'https://nhadat.city/logo.png',
  image: 'https://nhadat.city/og-image.jpg',
  email: 'support@nhadat.city',
  areaServed: {
    '@type': 'Country',
    name: 'Việt Nam',
  },
  knowsAbout: ['bất động sản', 'nhà đất', 'quy hoạch đô thị', 'mua bán nhà', 'cho thuê nhà'],
  sameAs: ['https://nhadat.city'],
};

export default async function HomePage() {
  const initialItems = await getRealEstatesInPolygon(null, { dateRange: 60 }, 24).catch(() => []);
  const month = new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  return (
    <main className="min-h-screen w-full bg-slate-950 text-white flex flex-col relative overflow-x-hidden">
      <JsonLd data={localBusinessJsonLd} />

      <MapProvider initialListings={JSON.parse(JSON.stringify(initialItems))}>
        <InteractiveMapLayout listingCount={initialItems.length} locationName="Toàn Quốc">
          {/* ── Homepage Full Web Document Section Below Map ── */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 w-full">
            {/* Page Header */}
            <header className="border-b border-slate-800 pb-6 text-center sm:text-left">
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                Bản đồ mua bán nhà đất & tra cứu quy hoạch đô thị toàn quốc
              </h1>
              <p className="mt-3 text-sm sm:text-base text-slate-300 max-w-3xl">
                Nền tảng công nghệ bất động sản số 1 Việt Nam. Tra cứu trực quan bản đồ quy hoạch 63 tỉnh thành, tìm kiếm hơn 1 triệu tin đăng mua bán nhà đất chính chủ mới nhất {month}.
              </p>
            </header>

            {/* Quick Feature Navigation Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Link href="/mua-ban" className="p-4 bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-xl flex flex-col items-center text-center transition-all no-underline group">
                <Home className="w-6 h-6 mb-2 text-indigo-400 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                <strong className="text-white text-sm group-hover:text-indigo-400">Mua bán nhà đất</strong>
                <span className="text-xs text-slate-400 mt-1">Hơn 1 triệu tin chính chủ</span>
              </Link>
              <Link href="/cho-thue" className="p-4 bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-xl flex flex-col items-center text-center transition-all no-underline group">
                <Key className="w-6 h-6 mb-2 text-indigo-400 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                <strong className="text-white text-sm group-hover:text-indigo-400">Cho thuê nhà đất</strong>
                <span className="text-xs text-slate-400 mt-1">Căn hộ, phòng trọ, mặt bằng</span>
              </Link>
              <Link href="/quy-hoach" className="p-4 bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-xl flex flex-col items-center text-center transition-all no-underline group">
                <Map className="w-6 h-6 mb-2 text-indigo-400 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                <strong className="text-white text-sm group-hover:text-indigo-400">Tra cứu quy hoạch</strong>
                <span className="text-xs text-slate-400 mt-1">Bản đồ quy hoạch 63 tỉnh</span>
              </Link>
              <Link href="/du-an" className="p-4 bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-xl flex flex-col items-center text-center transition-all no-underline group">
                <Building2 className="w-6 h-6 mb-2 text-indigo-400 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                <strong className="text-white text-sm group-hover:text-indigo-400">Dự án bất động sản</strong>
                <span className="text-xs text-slate-400 mt-1">Khu đô thị, chung cư cao cấp</span>
              </Link>
            </div>

            {/* Top Provinces Matrix */}
            <div>
              <h2 className="text-xl font-bold text-white mb-4">
                Khám phá bất động sản & quy hoạch các tỉnh thành trọng điểm
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {Object.entries(PROVINCES).slice(0, 12).map(([slug, name]) => (
                  <Link
                    key={slug}
                    href={`/${slug}`}
                    className="p-3 bg-slate-900/80 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-500/50 rounded-xl flex flex-col transition-all no-underline"
                  >
                    <span className="text-white text-xs font-bold">{name}</span>
                    <span className="text-[11px] text-emerald-400 mt-0.5">Xem bản đồ & tin →</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent Listings Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">
                  Tin đăng bất động sản mới nhất toàn quốc
                </h2>
                <Link href="/mua-ban" className="text-xs text-emerald-400 hover:underline">
                  Xem tất cả tin đăng →
                </Link>
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
                              {item.description || 'Thông tin bất động sản chính chủ, pháp lý minh bạch.'}
                            </p>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                            <span className="truncate max-w-[180px] inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={1.5} />
                              {item.adminunit?.ward || item.adminunit?.province || 'Toàn quốc'}
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
              ) : null}
            </div>

            {/* 63 Provinces Matrix Footer */}
            <ProvinceLinks currentProvince="ha-noi" className="rounded-2xl border border-slate-800 bg-slate-900 text-slate-300 shadow-xl" />
          </section>
        </InteractiveMapLayout>
      </MapProvider>
    </main>
  );
}
