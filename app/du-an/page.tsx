import type { Metadata } from 'next';
import Link from 'next/link';
import { MapProvider } from '@/components/Map/MapContext';
import ProjectMapClientDynamic from '@/components/ProjectMap/ProjectMapClientDynamic';
import ProjectMapOverlayUI from '@/components/ProjectMap/ProjectMapOverlayUI';
import InteractiveMapLayout from '@/components/Map/InteractiveMapLayout';
import { getProjects } from '@/lib/db/realEstate';
import { getImageUrl, formatMoney, makeUrlSlug } from '@/lib/utils/utils';
import { PROVINCES } from '@/lib/utils/province';
import ProvinceLinks from '@/components/SEO/ProvinceLinks';
import { JsonLd } from '@/components/JsonLd';
import { Building2, Building, MapPin, ImageIcon } from 'lucide-react';

export const revalidate = 120; // 2 minutes

export const metadata: Metadata = {
  title: 'Bản đồ & danh mục dự án bất động sản toàn quốc | NhaDat.City',
  description: 'Tra cứu thông tin, tiến độ, bảng giá và bản đồ quy hoạch các dự án khu đô thị, căn hộ chung cư, biệt thự nghỉ dưỡng trên toàn quốc mới nhất 2026.',
  alternates: {
    canonical: 'https://nhadat.city/du-an',
  },
  openGraph: {
    title: 'Bản đồ & danh mục dự án bất động sản toàn quốc | NhaDat.City',
    description: 'Tra cứu thông tin, tiến độ, bảng giá và bản đồ quy hoạch các dự án khu đô thị, căn hộ chung cư trên toàn quốc.',
    url: 'https://nhadat.city/du-an',
    type: 'website',
  },
};

export default async function ProjectPage() {
  let projects: any[] = [];
  let total = 0;
  try {
    const res = await getProjects({}, 1, 24);
    projects = res.items || [];
    total = res.total || 0;
  } catch (err: any) {
    console.error('[ProjectPage] Error retrieving projects from DB:', err?.message || err);
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: 'https://nhadat.city' },
      { '@type': 'ListItem', position: 2, name: 'Dự án Bất động sản', item: 'https://nhadat.city/du-an' },
    ],
  };

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Danh mục dự án bất động sản',
    numberOfItems: projects.length,
    itemListElement: projects.map((p, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: p.title,
      url: `https://nhadat.city/du-an/${p.shortId || p._id}/${makeUrlSlug(p.title)}`,
    })),
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={itemListJsonLd} />

      <MapProvider>
        <InteractiveMapLayout
          mapElement={
            <div className="w-full h-full relative flex flex-col">
              <div className="absolute inset-0 z-0 bg-slate-50">
                <ProjectMapClientDynamic />
              </div>
              <ProjectMapOverlayUI />
            </div>
          }
        >
          <section id="seo-content-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* ── Breadcrumb Navigation ── */}
            <nav aria-label="Breadcrumb" className="text-xs text-slate-400">
              <ol className="flex items-center space-x-2">
                <li><Link href="/" className="hover:text-emerald-400">NhaDat.City</Link></li>
                <li><span>/</span></li>
                <li className="text-emerald-400 font-semibold">Dự án bất động sản</li>
              </ol>
            </nav>

            {/* ── Page Header ── */}
            <header className="border-b border-slate-800 pb-6">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Dự án bất động sản toàn quốc ({total} dự án)
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Tổng hợp bảng giá, quy mô, chủ đầu tư, pháp lý và tiến độ xây dựng các khu đô thị, tổ hợp chung cư cao cấp và dự án nghỉ dưỡng mới nhất 2026.
              </p>
            </header>

            {/* ── Quick Province Filter Pills ── */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
              <span className="text-xs text-slate-400 shrink-0 font-medium">Lọc theo tỉnh thành:</span>
              <Link href="/du-an" className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold shrink-0 no-underline shadow-sm">
                Tất cả
              </Link>
              {Object.entries(PROVINCES).slice(0, 14).map(([slug, name]) => (
                <Link
                  key={slug}
                  href={`/du-an?province=${slug}`}
                  className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500 text-slate-300 hover:text-white text-xs shrink-0 no-underline transition-all"
                >
                  {name}
                </Link>
              ))}
            </div>

            {/* ── Projects Grid ── */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">
                  Danh sách dự án nổi bật
                </h2>
                <span className="text-xs text-slate-400">Hiển thị {projects.length} dự án</span>
              </div>

              {projects.length > 0 ? (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 list-none p-0 margin-0">
                  {projects.map((p) => {
                    const projectUrl = `https://nhadat.city/du-an/${p.shortId || p._id}/${makeUrlSlug(p.title)}`;
                    const thumb = p.images?.[0] ? getImageUrl(p.images[0], String(p._id), 400, 260) : null;
                    const priceFormatted = p.minPrice ? `Từ ${formatMoney(p.minPrice)}` : (p.maxPrice ? `Đến ${formatMoney(p.maxPrice)}` : 'Đang cập nhật');

                    return (
                      <li key={p._id.toString()} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-emerald-500/50 hover:shadow-2xl transition-all group">
                        <a href={projectUrl} className="block relative w-full h-48 bg-slate-950 overflow-hidden no-underline">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={p.title}
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
                            <span className="text-[11px] font-bold uppercase tracking-wider text-white bg-indigo-600/90 backdrop-blur-md px-2.5 py-1 rounded-lg shadow-md">
                              {priceFormatted}
                            </span>
                            {p.totalApartment ? (
                              <span className="text-[11px] font-semibold text-slate-200 bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded-lg">
                                {p.totalApartment} căn
                              </span>
                            ) : null}
                          </div>
                        </a>

                        <div className="p-4 flex flex-col flex-1 justify-between">
                          <div>
                            <h3 className="text-sm font-bold text-white line-clamp-2 group-hover:text-emerald-400 transition-colors">
                              <a href={projectUrl} className="text-white hover:text-emerald-400 no-underline">{p.title}</a>
                            </h3>
                            {p.investorName ? (
                              <p className="mt-1.5 text-xs text-indigo-400 font-medium truncate inline-flex items-center gap-1">
                                <Building className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                                <span>CĐT: {p.investorName}</span>
                              </p>
                            ) : null}
                            <p className="mt-2 text-xs text-slate-400 line-clamp-2">
                              {p.address || p.description?.replace(/<[^>]*>/g, '') || 'Thông tin chi tiết quy hoạch và chính sách bán hàng dự án.'}
                            </p>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                            <span className="truncate max-w-[180px] inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={1.5} />
                              {p.adminunit?.district || p.adminunit?.province || 'Toàn quốc'}
                            </span>
                            <a href={projectUrl} className="text-emerald-400 font-semibold hover:underline shrink-0 no-underline">
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
                  Hiện đang cập nhật danh mục dự án. Bạn có thể tra cứu bản đồ quy hoạch trực tiếp trên bản đồ.
                </p>
              )}
            </div>

            {/* ── Visible 63 Provinces Matrix Footer ── */}
            <ProvinceLinks currentProvince="ha-noi" className="rounded-2xl border border-slate-800 bg-slate-900 text-slate-300 shadow-xl" />
          </section>
        </InteractiveMapLayout>
      </MapProvider>
    </main>
  );
}
