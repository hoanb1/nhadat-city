import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listDistrictsByProvince, countListingsByProvince } from '@/lib/db/repo/publicGeo';
import { PROVINCES, slugToProvince, PROVINCE_MERGED_INTO } from '@/lib/utils/province';
import { JsonLd } from '@/components/JsonLd';
import MapOverlayUI from '@/components/Map/MapOverlayUI';
import { MapProvider } from '@/components/Map/MapContext';
import MainMapClientDynamic from '@/components/Map/MainMapClientDynamic';
import Link from 'next/link';
import { Info, Map, Ruler } from 'lucide-react';

interface Props {
  params: Promise<{ province: string }>;
}

export const revalidate = 86400; // Revalidate once per day

/**
 * Get districts for a province from the districts collection.
 * Handles both current and legacy (merged) province slugs.
 */
async function getDistrictsForProvince(provinceSlug: string) {
  return listDistrictsByProvince(provinceSlug);
}

/**
 * Count real estate listings for a province.
 */
async function getListingCount(provinceSlug: string): Promise<number> {
  return countListingsByProvince(provinceSlug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { province } = await params;

  if (!PROVINCES[province]) {
    notFound();
  }

  const locationName = slugToProvince(province);
  const year = new Date().getFullYear();

  const title = `Bản đồ quy hoạch ${locationName} ${year} – Tra cứu trực tuyến miễn phí | NhaDat.City`;
  const description = `Xem bản đồ quy hoạch ${locationName} ${year} trực tuyến. Tra cứu quy hoạch sử dụng đất, giao thông, phân khu chức năng. Kiểm tra thửa đất có nằm trong quy hoạch không. Cập nhật mới nhất.`;

  return {
    title,
    description,
    keywords: `bản đồ quy hoạch ${locationName}, quy hoạch ${locationName} ${year}, tra cứu quy hoạch ${locationName}, quy hoạch sử dụng đất ${locationName}, xem quy hoạch online ${locationName}`,
    alternates: {
      canonical: `https://nhadat.city/quy-hoach/${province}`,
    },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
    openGraph: {
      title,
      description,
      url: `https://nhadat.city/quy-hoach/${province}`,
      siteName: 'NhaDat.City',
      locale: 'vi_VN',
      type: 'website',
      images: [{ url: 'https://nhadat.city/og-image.jpg', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function QuyHoachProvincePage({ params }: Props) {
  const { province } = await params;

  if (!PROVINCES[province]) {
    notFound();
  }

  const locationName = slugToProvince(province);
  const year = new Date().getFullYear();
  const mergedInto = PROVINCE_MERGED_INTO[province];

  const [districts, listingCount] = await Promise.all([
    getDistrictsForProvince(province),
    getListingCount(province),
  ]);

  // BreadcrumbList JSON-LD
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: 'https://nhadat.city' },
      { '@type': 'ListItem', position: 2, name: 'Quy hoạch', item: 'https://nhadat.city/quy-hoach' },
      { '@type': 'ListItem', position: 3, name: locationName, item: `https://nhadat.city/quy-hoach/${province}` },
    ],
  };

  // FAQPage JSON-LD
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Bản đồ quy hoạch ${locationName} xem ở đâu?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Bạn có thể tra cứu bản đồ quy hoạch ${locationName} trực tuyến miễn phí trên NhaDat.City. Bản đồ hiển thị quy hoạch sử dụng đất, quy hoạch giao thông, ranh thửa đất chi tiết.`,
        },
      },
      {
        '@type': 'Question',
        name: `Quy hoạch ${locationName} gồm những nội dung gì?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Bản đồ quy hoạch ${locationName} thể hiện: quy hoạch sử dụng đất (đất ở, đất nông nghiệp, đất công cộng...), quy hoạch giao thông (mở đường, mở rộng hẻm), quy hoạch phân khu chức năng và các dự án phát triển đô thị.`,
        },
      },
      {
        '@type': 'Question',
        name: `Làm sao kiểm tra thửa đất có dính quy hoạch tại ${locationName}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Truy cập trang quy hoạch ${locationName} trên NhaDat.City, mở bản đồ tương tác, định vị đến thửa đất cần kiểm tra. Lớp quy hoạch sẽ hiển thị màu sắc tương ứng với mục đích sử dụng đất được quy hoạch.`,
        },
      },
    ],
  };

  // HowTo JSON-LD (rich snippet)
  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `Cách tra cứu bản đồ quy hoạch ${locationName}`,
    description: `Hướng dẫn tra cứu bản đồ quy hoạch ${locationName} trực tuyến trên NhaDat.City`,
    step: [
      {
        '@type': 'HowToStep',
        name: 'Mở bản đồ',
        text: `Truy cập trang quy hoạch ${locationName} trên NhaDat.City và nhấn Mở bản đồ tương tác`,
        url: `https://nhadat.city/quy-hoach/${province}`,
      },
      {
        '@type': 'HowToStep',
        name: 'Tìm vị trí đất',
        text: 'Tìm kiếm địa chỉ hoặc dùng GPS để định vị thửa đất cần kiểm tra',
      },
      {
        '@type': 'HowToStep',
        name: 'Xem thông tin quy hoạch',
        text: 'Bật lớp quy hoạch và click vào thửa đất để xem mục đích sử dụng, lộ giới, hạn chế xây dựng',
      },
    ],
  };

  return (
    <main className="min-h-screen bg-white">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={faqJsonLd} />
      <JsonLd data={howToJsonLd} />

      <article className="max-w-5xl mx-auto px-4 py-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500">
          <ol className="flex gap-2">
            <li><Link href="/" className="hover:text-blue-600">Trang chủ</Link> ›</li>
            <li><Link href="/quy-hoach" className="hover:text-blue-600">Quy hoạch</Link> ›</li>
            <li className="text-gray-800 font-medium">{locationName}</li>
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Bản đồ quy hoạch {locationName} {year}
        </h1>

        {mergedInto && (
          <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded mb-4 flex items-center gap-1.5">
            <Info className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            <span>
              Khu vực {locationName} nay thuộc {slugToProvince(mergedInto)} theo quy hoạch hành chính 2025.
              <Link href={`/quy-hoach/${mergedInto}`} className="underline ml-1">
                Xem quy hoạch {slugToProvince(mergedInto)}
              </Link>
            </span>
          </p>
        )}

        <p className="text-lg text-gray-700 mb-6 leading-relaxed">
          Tra cứu <strong>bản đồ quy hoạch {locationName}</strong> năm {year} trực tuyến miễn phí.
          Xem quy hoạch sử dụng đất, quy hoạch giao thông, phân khu chức năng và ranh giới thửa đất.
          {listingCount > 0 && (
            <> Hiện có <strong>{listingCount.toLocaleString('vi-VN')} tin đăng bất động sản</strong> tại khu vực {locationName}.</>
          )}
        </p>

        {/* CTA to interactive map */}
        <div className="flex flex-wrap gap-3 mb-8">
          <Link
            href={`/${province}`}
            className="px-5 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <Map className="w-4 h-4" strokeWidth={1.5} />
            <span>Mở bản đồ tương tác {locationName}</span>
          </Link>
          <Link
            href={`/parcel-boundary/${province}`}
            className="px-5 py-3 bg-white border-2 border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors inline-flex items-center gap-2"
          >
            <Ruler className="w-4 h-4" strokeWidth={1.5} />
            <span>Tra cứu ranh thửa đất</span>
          </Link>
        </div>

        {/* Districts listing — internal links for crawlability */}
        {districts.length > 0 && (
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Quy hoạch theo quận/huyện tại {locationName}
            </h2>
            <p className="text-gray-600 mb-4">
              {locationName} có {districts.length} quận/huyện/thị xã. Chọn quận/huyện bên dưới để xem quy hoạch chi tiết:
            </p>
            <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {districts.map((d: any) => (
                <li key={d.CodeName}>
                  <Link
                    href={`/quy-hoach/${province}/${d.CodeName}`}
                    className="block p-3 border rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm"
                  >
                    <span className="font-medium text-gray-800">{d.Name}</span>
                    <span className="block text-xs text-gray-500 mt-0.5">{d.Type}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* SEO content section */}
        <section className="mb-8 prose prose-blue max-w-none">
          <h2>Hướng dẫn xem bản đồ quy hoạch {locationName}</h2>
          <ol>
            <li><strong>Mở bản đồ tương tác</strong> — Nhấn nút &ldquo;Mở bản đồ tương tác&rdquo; phía trên để xem bản đồ {locationName} trên NhaDat.City.</li>
            <li><strong>Bật lớp quy hoạch</strong> — Trong menu bản đồ, chọn lớp &ldquo;Quy hoạch sử dụng đất&rdquo; hoặc &ldquo;Quy hoạch phân khu&rdquo; để hiển thị dữ liệu quy hoạch.</li>
            <li><strong>Tìm vị trí</strong> — Dùng công cụ tìm kiếm hoặc kéo/zoom bản đồ đến vị trí cần tra cứu.</li>
            <li><strong>Xem thông tin thửa đất</strong> — Nhấn vào bất kỳ thửa đất nào để xem mục đích sử dụng đất, diện tích, số tờ/số thửa.</li>
          </ol>

          <h2>Các loại quy hoạch tại {locationName}</h2>
          <ul>
            <li><strong>Quy hoạch sử dụng đất</strong> — Phân loại mục đích sử dụng: đất ở, đất nông nghiệp, đất thương mại dịch vụ, đất giao thông.</li>
            <li><strong>Quy hoạch giao thông</strong> — Các tuyến đường mở rộng, đường mới, nút giao thông, metro (nếu có).</li>
            <li><strong>Quy hoạch phân khu</strong> — Chia khu vực thành các phân khu chức năng: dân cư, công nghiệp, du lịch, hành chính.</li>
            <li><strong>Ranh thửa đất</strong> — Ranh giới chính xác của từng thửa đất theo bản đồ địa chính.</li>
          </ul>
        </section>

        {/* Cross-link to other provinces */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Quy hoạch các tỉnh/thành khác</h2>
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-1 text-sm">
            {Object.entries(PROVINCES)
              .filter(([slug]) => slug !== province && !PROVINCE_MERGED_INTO[slug])
              .slice(0, 34)
              .map(([slug, name]) => (
                <li key={slug}>
                  <Link href={`/quy-hoach/${slug}`} className="text-blue-600 hover:underline">
                    Quy hoạch {name}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      </article>

      {/* Embedded interactive map preview */}
      <section className="h-[60vh] relative border-t">
        <MapProvider
          initialProvince={province}
          initialLocationName={locationName}
          initialZoom={10}
        >
          <div className="w-full h-full relative flex flex-col">
            <div className="absolute inset-0 z-0 bg-slate-50">
              <MainMapClientDynamic />
            </div>
            <MapOverlayUI />
          </div>
        </MapProvider>
      </section>
    </main>
  );
}
