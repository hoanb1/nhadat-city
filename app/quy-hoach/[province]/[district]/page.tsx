import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDistrict, listDistrictsByProvince, countListingsByProvince } from '@/lib/db/repo/publicGeo';
import { PROVINCES, slugToProvince, PROVINCE_MERGED_INTO } from '@/lib/utils/province';
import { JsonLd } from '@/components/JsonLd';
import MapOverlayUI from '@/components/Map/MapOverlayUI';
import { MapProvider } from '@/components/Map/MapContext';
import MainMapClientDynamic from '@/components/Map/MainMapClientDynamic';
import Link from 'next/link';
import { Info, Map } from 'lucide-react';

interface Props {
  params: Promise<{ province: string; district: string }>;
}

export const revalidate = 86400;

async function getDistrictInfo(province: string, district: string) {
  return getDistrict(province, district);
}

async function getWardsInDistrict(province: string, district: string) {
  // Wards reference province, not district directly — filter by matching ProvinceCodeName
  // and checking if the ward belongs to this district's area
  const districtInfo = await getDistrictInfo(province, district);
  if (!districtInfo) return [];

  // ward2025 doesn't have district reference directly, so we get all wards for the province
  // In practice, we'd need a more precise mapping. For now, return province-level wards.
  return [];
}

async function getListingCount(province: string): Promise<number> {
  return countListingsByProvince(province);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { province, district } = await params;

  if (!PROVINCES[province]) notFound();

  const districtInfo = await getDistrictInfo(province, district);
  if (!districtInfo) notFound();

  const provinceName = slugToProvince(province);
  const districtName = districtInfo.Name;
  const year = new Date().getFullYear();

  const title = `Bản đồ quy hoạch ${districtName}, ${provinceName} ${year} – Tra cứu trực tuyến`;
  const description = `Xem bản đồ quy hoạch ${districtName}, ${provinceName} năm ${year}. Tra cứu quy hoạch sử dụng đất, ranh thửa, giao thông tại ${districtName}. Kiểm tra đất có nằm trong quy hoạch không – miễn phí.`;

  return {
    title,
    description,
    keywords: `quy hoạch ${districtName} ${provinceName}, bản đồ quy hoạch ${districtName}, quy hoạch sử dụng đất ${districtName}, ranh thửa ${districtName}, ${districtName} ${provinceName} ${year}`,
    alternates: {
      canonical: `https://nhadat.city/quy-hoach/${province}/${district}`,
    },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
    openGraph: {
      title,
      description,
      url: `https://nhadat.city/quy-hoach/${province}/${district}`,
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

export default async function QuyHoachDistrictPage({ params }: Props) {
  const { province, district } = await params;

  if (!PROVINCES[province]) notFound();

  const districtInfo = await getDistrictInfo(province, district);
  if (!districtInfo) notFound();

  const provinceName = slugToProvince(province);
  const districtName = districtInfo.Name;
  const districtType = districtInfo.Type || 'Quận/Huyện';
  const year = new Date().getFullYear();
  const mergedInto = PROVINCE_MERGED_INTO[province];

  // Sibling districts for internal links
  const siblingDistricts = await listDistrictsByProvince(province, { excludeSlug: district, limit: 12 });

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: 'https://nhadat.city' },
      { '@type': 'ListItem', position: 2, name: 'Quy hoạch', item: 'https://nhadat.city/quy-hoach' },
      { '@type': 'ListItem', position: 3, name: provinceName, item: `https://nhadat.city/quy-hoach/${province}` },
      { '@type': 'ListItem', position: 4, name: districtName, item: `https://nhadat.city/quy-hoach/${province}/${district}` },
    ],
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Bản đồ quy hoạch ${districtName} xem ở đâu?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Xem bản đồ quy hoạch ${districtName} (${provinceName}) trực tuyến miễn phí tại NhaDat.City. Tra cứu quy hoạch sử dụng đất, lộ giới, dự án hạ tầng.`,
        },
      },
      {
        '@type': 'Question',
        name: `Quy hoạch ${districtName} có những phân khu nào?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Quy hoạch ${districtName} bao gồm các phân khu chức năng: đất ở đô thị/nông thôn, thương mại dịch vụ, công nghiệp, công viên cây xanh và đất giao thông theo quy hoạch được duyệt.`,
        },
      },
    ],
  };

  return (
    <main className="min-h-screen bg-white">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={faqJsonLd} />

      <article className="max-w-5xl mx-auto px-4 py-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500">
          <ol className="flex gap-2 flex-wrap">
            <li><Link href="/" className="hover:text-blue-600">Trang chủ</Link> ›</li>
            <li><Link href="/quy-hoach" className="hover:text-blue-600">Quy hoạch</Link> ›</li>
            <li><Link href={`/quy-hoach/${province}`} className="hover:text-blue-600">{provinceName}</Link> ›</li>
            <li className="text-gray-800 font-medium">{districtName}</li>
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Bản đồ quy hoạch {districtName}, {provinceName} {year}
        </h1>

        {mergedInto && (
          <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded mb-4 flex items-center gap-1.5">
            <Info className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            <span>{provinceName} nay thuộc {slugToProvince(mergedInto)} theo quy hoạch hành chính 2025.</span>
          </p>
        )}

        <p className="text-lg text-gray-700 mb-6 leading-relaxed">
          Tra cứu <strong>bản đồ quy hoạch {districtName}</strong> ({districtType} thuộc {provinceName}) năm {year}.
          Xem chi tiết quy hoạch sử dụng đất, ranh giới thửa đất, quy hoạch giao thông và phân khu chức năng
          tại khu vực {districtName}.
        </p>

        <div className="flex flex-wrap gap-3 mb-8">
          <Link
            href={`/${province}`}
            className="px-5 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <Map className="w-4 h-4" strokeWidth={1.5} />
            <span>Mở bản đồ {districtName}</span>
          </Link>
          <Link
            href={`/quy-hoach/${province}`}
            className="px-5 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            ← Quy hoạch {provinceName}
          </Link>
        </div>

        {/* Content about this district */}
        <section className="mb-8 prose prose-blue max-w-none">
          <h2>Thông tin quy hoạch {districtName}</h2>
          <p>
            {districtName} là {districtType.toLowerCase()} thuộc {provinceName}.
            Theo quy hoạch sử dụng đất mới nhất, khu vực {districtName} bao gồm các phân khu:
            đất ở đô thị, đất nông nghiệp, đất thương mại dịch vụ, đất giao thông và đất cây xanh.
          </p>

          <h2>Cách tra cứu quy hoạch {districtName} trên NhaDat.City</h2>
          <ol>
            <li>Nhấn <strong>&ldquo;Mở bản đồ {districtName}&rdquo;</strong> ở trên.</li>
            <li>Trong menu bên trái, bật lớp <strong>Quy hoạch sử dụng đất</strong>.</li>
            <li>Zoom vào khu vực cần tra cứu trong {districtName}.</li>
            <li>Click vào thửa đất để xem thông tin: mục đích sử dụng, diện tích, số tờ/số thửa.</li>
          </ol>

          <h2>Lưu ý khi tra cứu quy hoạch</h2>
          <ul>
            <li>Dữ liệu quy hoạch được cập nhật theo nguồn chính thức từ cơ quan quản lý đất đai.</li>
            <li>Để có thông tin pháp lý chính xác nhất, nên đối chiếu với Sở Tài nguyên & Môi trường {provinceName}.</li>
            <li>Bản đồ ranh thửa giúp xác định chính xác vị trí và diện tích thửa đất.</li>
          </ul>
        </section>

        {/* Sibling districts */}
        {siblingDistricts.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Quy hoạch các quận/huyện khác tại {provinceName}
            </h2>
            <ul className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {siblingDistricts.map((d: any) => (
                <li key={d.CodeName}>
                  <Link
                    href={`/quy-hoach/${province}/${d.CodeName}`}
                    className="block p-2 border rounded hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    {d.Name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      {/* Map preview */}
      <section className="h-[60vh] relative border-t">
        <MapProvider
          initialProvince={province}
          initialLocationName={`${districtName}, ${provinceName}`}
          initialZoom={12}
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
