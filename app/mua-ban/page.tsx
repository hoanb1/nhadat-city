import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { PROVINCES } from '@/lib/utils/province';

// ISR: revalidate every 5 minutes
export const revalidate = 300;

const MONTH = new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

export const metadata: Metadata = {
  title: `Mua bán nhà đất toàn quốc – Chính chủ, cập nhật ${MONTH} | NhaDat.City`,
  description: 'Tìm mua nhà đất chính chủ trên toàn quốc. Hàng chục nghìn tin đăng bất động sản giá tốt, pháp lý rõ ràng, không qua môi giới. Nhà phố, đất nền, chung cư, biệt thự — tất cả tại NhaDat.City.',
  alternates: {
    canonical: 'https://nhadat.city/mua-ban',
  },
  openGraph: {
    title: `Mua bán nhà đất toàn quốc – Chính chủ ${MONTH} | NhaDat.City`,
    description: 'Hàng chục nghìn tin đăng mua bán nhà đất toàn quốc. Giá tốt, pháp lý rõ ràng, không qua môi giới.',
    url: 'https://nhadat.city/mua-ban',
    siteName: 'NhaDat.City',
    locale: 'vi_VN',
    type: 'website',
  },
};

const TOP_PROVINCES = [
  'ho-chi-minh', 'ha-noi', 'binh-duong', 'dong-nai', 'da-nang',
  'ba-ria-vung-tau', 'long-an', 'khanh-hoa', 'can-tho', 'hai-phong',
];

export default async function MuaBanPage() {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: 'https://nhadat.city' },
      { '@type': 'ListItem', position: 2, name: 'Mua bán nhà đất', item: 'https://nhadat.city/mua-ban' },
    ],
  };

  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Làm thế nào để mua nhà đất chính chủ không qua môi giới?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Tại NhaDat.City, tất cả tin đăng đều là từ chủ nhà trực tiếp. Bạn chọn tỉnh thành, lọc theo giá và diện tích mong muốn, sau đó liên hệ trực tiếp với chủ sở hữu để trao đổi và xem nhà.',
        },
      },
      {
        '@type': 'Question',
        name: 'Giá nhà đất tại TP.HCM và Hà Nội năm nay như thế nào?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Giá bất động sản liên tục cập nhật tại NhaDat.City. Truy cập trang thống kê thị trường tại /thong-ke để xem biến động giá theo từng quận, huyện theo thời gian thực.',
        },
      },
      {
        '@type': 'Question',
        name: 'Có thể xem bản đồ quy hoạch khu đất muốn mua không?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Có. NhaDat.City tích hợp bản đồ quy hoạch toàn quốc. Chọn tỉnh thành bất kỳ và click vào vị trí mong muốn trên bản đồ để xem thông tin quy hoạch chi tiết.',
        },
      },
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumb} />
      <JsonLd data={faq} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-800 mb-3">
            Mua bán nhà đất toàn quốc — Chính chủ, không môi giới
          </h1>
          <p className="text-slate-600 text-lg leading-relaxed max-w-3xl">
            Hàng chục nghìn tin đăng bất động sản từ chủ nhà trực tiếp trên toàn quốc.
            Nhà phố, đất nền, chung cư, biệt thự — tất cả cập nhật {MONTH}, pháp lý rõ ràng.
          </p>
        </header>

        {/* Province grid */}
        <section className="mb-10" aria-label="Mua bán nhà đất theo tỉnh thành">
          <h2 className="text-xl font-bold text-slate-700 mb-4">Tìm theo tỉnh thành</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {TOP_PROVINCES.map((slug) => {
              const name = PROVINCES[slug as keyof typeof PROVINCES] || slug;
              return (
                <Link
                  key={slug}
                  href={`/${slug}`}
                  className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-all no-underline"
                >
                  {name}
                </Link>
              );
            })}
            {Object.entries(PROVINCES)
              .filter(([slug]) => !TOP_PROVINCES.includes(slug))
              .map(([slug, name]) => (
                <Link
                  key={slug}
                  href={`/${slug}`}
                  className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-all no-underline"
                >
                  {name}
                </Link>
              ))}
          </div>
        </section>


        <section className="mb-10" aria-label="Câu hỏi thường gặp về mua bán nhà đất">
          <h2 className="text-xl font-bold text-slate-700 mb-4">Câu hỏi thường gặp</h2>
          <div className="space-y-4">
            <details className="bg-white border border-slate-200 rounded-lg p-4 open:shadow-sm">
              <summary className="font-semibold text-slate-700 cursor-pointer">
                Làm thế nào để mua nhà đất chính chủ không qua môi giới?
              </summary>
              <p className="mt-3 text-slate-600 leading-relaxed">
                Tại NhaDat.City, tất cả tin đăng đều từ chủ nhà trực tiếp. Chọn tỉnh thành, lọc theo giá và diện tích,
                sau đó liên hệ trực tiếp với chủ sở hữu để trao đổi và xem nhà.
              </p>
            </details>
            <details className="bg-white border border-slate-200 rounded-lg p-4 open:shadow-sm">
              <summary className="font-semibold text-slate-700 cursor-pointer">
                Giá nhà đất tại TP.HCM và Hà Nội hiện nay như thế nào?
              </summary>
              <p className="mt-3 text-slate-600 leading-relaxed">
                Giá bất động sản cập nhật liên tục. Truy cập{' '}
                <Link href="/thong-ke" className="text-indigo-600 hover:underline">trang thống kê thị trường</Link>{' '}
                để xem biến động giá theo từng quận, huyện theo thời gian thực.
              </p>
            </details>
            <details className="bg-white border border-slate-200 rounded-lg p-4 open:shadow-sm">
              <summary className="font-semibold text-slate-700 cursor-pointer">
                Có thể xem bản đồ quy hoạch khu đất muốn mua không?
              </summary>
              <p className="mt-3 text-slate-600 leading-relaxed">
                Có. NhaDat.City tích hợp bản đồ quy hoạch toàn quốc. Chọn tỉnh thành và click vào vị trí
                trên bản đồ để xem thông tin quy hoạch chi tiết.
              </p>
            </details>
          </div>
        </section>

        {/* Internal links */}
        <section aria-label="Xem thêm">
          <h2 className="text-xl font-bold text-slate-700 mb-3">Xem thêm</h2>
          <ul className="flex flex-wrap gap-3 list-none p-0">
            <li><Link href="/cho-thue" className="text-indigo-600 hover:underline font-medium">Nhà đất cho thuê</Link></li>
            <li><Link href="/thong-ke" className="text-indigo-600 hover:underline font-medium">Thống kê thị trường BĐS</Link></li>
            <li><Link href="/ho-chi-minh" className="text-indigo-600 hover:underline font-medium">Nhà đất TP.HCM</Link></li>
            <li><Link href="/ha-noi" className="text-indigo-600 hover:underline font-medium">Nhà đất Hà Nội</Link></li>
            <li><Link href="/da-nang" className="text-indigo-600 hover:underline font-medium">Nhà đất Đà Nẵng</Link></li>
          </ul>
        </section>
      </main>
    </>
  );
}
