import type { Metadata } from 'next';
import { PROVINCES, PROVINCE_MERGED_INTO } from '@/lib/utils/province';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';

export const metadata: Metadata = {
  title: 'Bản đồ quy hoạch toàn quốc – Tra cứu trực tuyến miễn phí | NhaDat.City',
  description: 'Tra cứu bản đồ quy hoạch toàn quốc: quy hoạch sử dụng đất, giao thông, phân khu chức năng 34 tỉnh thành. Kiểm tra đất có nằm trong quy hoạch không. Miễn phí, cập nhật mới nhất.',
  alternates: {
    canonical: 'https://nhadat.city/quy-hoach',
  },
  openGraph: {
    title: 'Bản đồ quy hoạch toàn quốc – Tra cứu trực tuyến miễn phí | NhaDat.City',
    description: 'Tra cứu bản đồ quy hoạch sử dụng đất, giao thông, phân khu chức năng 34 tỉnh thành trực tuyến miễn phí.',
    url: 'https://nhadat.city/quy-hoach',
    type: 'website',
  },
};

export default function QuyHoachIndexPage() {
  const year = new Date().getFullYear();

  // Group: current 34 provinces first, then legacy merged ones
  const currentProvinces = Object.entries(PROVINCES).filter(([slug]) => !PROVINCE_MERGED_INTO[slug]);
  const legacyProvinces = Object.entries(PROVINCES).filter(([slug]) => !!PROVINCE_MERGED_INTO[slug]);

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: 'https://nhadat.city' },
      { '@type': 'ListItem', position: 2, name: 'Quy hoạch', item: 'https://nhadat.city/quy-hoach' },
    ],
  };

  const collectionPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Bản đồ quy hoạch toàn quốc',
    description: 'Tra cứu bản đồ quy hoạch sử dụng đất, giao thông, phân khu chức năng toàn quốc trực tuyến miễn phí.',
    url: 'https://nhadat.city/quy-hoach',
    hasPart: currentProvinces.map(([slug, name]) => ({
      '@type': 'WebPage',
      name: `Bản đồ quy hoạch ${name}`,
      url: `https://nhadat.city/quy-hoach/${slug}`,
    })),
  };

  return (
    <main className="min-h-screen bg-white">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={collectionPageJsonLd} />

      <article className="max-w-5xl mx-auto px-4 py-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500">
          <ol className="flex gap-2">
            <li><Link href="/" className="hover:text-blue-600">Trang chủ</Link> ›</li>
            <li className="text-gray-800 font-medium">Quy hoạch</li>
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Bản đồ quy hoạch toàn quốc {year}
        </h1>

        <p className="text-lg text-gray-700 mb-8 leading-relaxed">
          Tra cứu <strong>bản đồ quy hoạch</strong> toàn bộ 34 tỉnh thành Việt Nam trực tuyến miễn phí.
          Xem quy hoạch sử dụng đất, quy hoạch giao thông, phân khu chức năng và ranh giới thửa đất.
          Dữ liệu cập nhật theo nguồn chính thức.
        </p>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            34 tỉnh thành hiện tại
          </h2>
          <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {currentProvinces.map(([slug, name]) => (
              <li key={slug}>
                <Link
                  href={`/quy-hoach/${slug}`}
                  className="block p-4 border rounded-xl hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm transition-all"
                >
                  <span className="font-medium text-gray-800">Quy hoạch {name}</span>
                  <span className="block text-xs text-blue-600 mt-1">Xem bản đồ →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {legacyProvinces.length > 0 && (
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">
              Khu vực đã sáp nhập (trước 2025)
            </h2>
            <p className="text-gray-600 mb-4 text-sm">
              Các tỉnh/thành đã sáp nhập theo quy hoạch hành chính 2025. Dữ liệu quy hoạch cũ vẫn có giá trị tham khảo.
            </p>
            <ul className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              {legacyProvinces.map(([slug, name]) => (
                <li key={slug}>
                  <Link
                    href={`/quy-hoach/${slug}`}
                    className="text-blue-600 hover:underline"
                  >
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="prose prose-blue max-w-none">
          <h2>Hướng dẫn tra cứu bản đồ quy hoạch</h2>
          <ol>
            <li>Chọn tỉnh/thành phố cần tra cứu từ danh sách trên.</li>
            <li>Trong trang quy hoạch tỉnh, chọn quận/huyện cụ thể (nếu cần).</li>
            <li>Nhấn &ldquo;Mở bản đồ tương tác&rdquo; và bật lớp quy hoạch.</li>
            <li>Click vào thửa đất để xem thông tin quy hoạch chi tiết.</li>
          </ol>

          <h2>Tại sao cần tra cứu quy hoạch?</h2>
          <ul>
            <li><strong>Mua bán nhà đất</strong> — Kiểm tra đất có nằm trong quy hoạch đường, công viên, hay dự án trước khi mua.</li>
            <li><strong>Xây dựng</strong> — Xác định mục đích sử dụng đất trước khi xin phép xây dựng.</li>
            <li><strong>Đầu tư</strong> — Đánh giá tiềm năng tăng giá dựa trên quy hoạch giao thông, hạ tầng.</li>
          </ul>
        </section>
      </article>
    </main>
  );
}

