import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { PROVINCES } from '@/lib/utils/province';

// ISR: revalidate every 5 minutes
export const revalidate = 300;

const MONTH = new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

export const metadata: Metadata = {
  title: `Cho thuê nhà đất toàn quốc – Cập nhật ${MONTH} | NhaDat.City`,
  description: 'Tìm nhà đất cho thuê trên toàn quốc. Phòng trọ, nhà nguyên căn, căn hộ, mặt bằng kinh doanh — giá tốt, cập nhật hằng ngày. Liên hệ trực tiếp chủ nhà tại NhaDat.City.',
  alternates: {
    canonical: 'https://nhadat.city/cho-thue',
  },
  openGraph: {
    title: `Cho thuê nhà đất toàn quốc – Cập nhật ${MONTH} | NhaDat.City`,
    description: 'Tìm nhà cho thuê uy tín toàn quốc. Phòng trọ, căn hộ, nhà nguyên căn — giá tốt, liên hệ chủ nhà trực tiếp.',
    url: 'https://nhadat.city/cho-thue',
    siteName: 'NhaDat.City',
    locale: 'vi_VN',
    type: 'website',
  },
};

const TOP_PROVINCES = [
  'ho-chi-minh', 'ha-noi', 'binh-duong', 'dong-nai', 'da-nang',
  'ba-ria-vung-tau', 'long-an', 'khanh-hoa', 'can-tho', 'hai-phong',
];

export default async function ChoThuePage() {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: 'https://nhadat.city' },
      { '@type': 'ListItem', position: 2, name: 'Cho thuê nhà đất', item: 'https://nhadat.city/cho-thue' },
    ],
  };

  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Tìm phòng trọ hay căn hộ cho thuê giá rẻ ở đâu?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'NhaDat.City tổng hợp hàng nghìn tin đăng cho thuê từ chủ nhà trực tiếp trên toàn quốc. Chọn tỉnh thành, lọc theo mức giá mong muốn và liên hệ trực tiếp để tránh phí môi giới.',
        },
      },
      {
        '@type': 'Question',
        name: 'Giá thuê nhà tại TP.HCM và Hà Nội hiện nay khoảng bao nhiêu?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Giá thuê trung bình phòng trọ tại TP.HCM dao động 2-5 triệu/tháng, căn hộ mini 5-10 triệu/tháng. Tại Hà Nội thấp hơn khoảng 10-20%. Xem chi tiết tại trang thống kê giá thuê của NhaDat.City.',
        },
      },
      {
        '@type': 'Question',
        name: 'Cho thuê mặt bằng kinh doanh, văn phòng có trên NhaDat.City không?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Có. NhaDat.City có đầy đủ loại hình bất động sản cho thuê: phòng trọ, nhà nguyên căn, căn hộ, mặt bằng kinh doanh, văn phòng, kho xưởng. Dùng bộ lọc để tìm đúng loại hình cần thuê.',
        },
      },
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumb} />
      <JsonLd data={faq} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero */}
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-800 mb-3">
            Cho thuê nhà đất toàn quốc — Chính chủ, giá tốt nhất
          </h1>
          <p className="text-slate-600 text-lg leading-relaxed max-w-3xl">
            Hàng nghìn tin đăng cho thuê nhà, phòng trọ, căn hộ, mặt bằng kinh doanh từ chủ nhà trực tiếp.
            Cập nhật hằng ngày — {MONTH}, liên hệ ngay không qua môi giới.
          </p>
        </header>

        {/* Province grid */}
        <section className="mb-10" aria-label="Cho thuê nhà đất theo tỉnh thành">
          <h2 className="text-xl font-bold text-slate-700 mb-4">Tìm cho thuê theo tỉnh thành</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {TOP_PROVINCES.map((slug) => {
              const name = PROVINCES[slug as keyof typeof PROVINCES] || slug;
              return (
                <Link
                  key={slug}
                  href={`/${slug}`}
                  className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-all no-underline"
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
                  className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-all no-underline"
                >
                  {name}
                </Link>
              ))}
          </div>
        </section>


        <section className="mb-10" aria-label="Câu hỏi thường gặp về cho thuê nhà đất">
          <h2 className="text-xl font-bold text-slate-700 mb-4">Câu hỏi thường gặp</h2>
          <div className="space-y-4">
            <details className="bg-white border border-slate-200 rounded-lg p-4 open:shadow-sm">
              <summary className="font-semibold text-slate-700 cursor-pointer">
                Tìm phòng trọ hay căn hộ cho thuê giá rẻ ở đâu?
              </summary>
              <p className="mt-3 text-slate-600 leading-relaxed">
                NhaDat.City tổng hợp hàng nghìn tin đăng cho thuê từ chủ nhà trực tiếp.
                Chọn tỉnh thành, lọc theo mức giá và liên hệ trực tiếp để tránh phí môi giới.
              </p>
            </details>
            <details className="bg-white border border-slate-200 rounded-lg p-4 open:shadow-sm">
              <summary className="font-semibold text-slate-700 cursor-pointer">
                Giá thuê nhà tại TP.HCM và Hà Nội hiện nay khoảng bao nhiêu?
              </summary>
              <p className="mt-3 text-slate-600 leading-relaxed">
                Giá thuê trung bình phòng trọ tại TP.HCM dao động 2–5 triệu/tháng, căn hộ mini 5–10 triệu/tháng.
                Hà Nội thấp hơn khoảng 10–20%. Xem chi tiết tại{' '}
                <Link href="/thong-ke" className="text-emerald-600 hover:underline">trang thống kê</Link>.
              </p>
            </details>
            <details className="bg-white border border-slate-200 rounded-lg p-4 open:shadow-sm">
              <summary className="font-semibold text-slate-700 cursor-pointer">
                Cho thuê mặt bằng kinh doanh, văn phòng có trên NhaDat.City không?
              </summary>
              <p className="mt-3 text-slate-600 leading-relaxed">
                Có đầy đủ: phòng trọ, nhà nguyên căn, căn hộ, mặt bằng kinh doanh, văn phòng, kho xưởng.
                Dùng bộ lọc để tìm đúng loại hình cần thuê.
              </p>
            </details>
          </div>
        </section>

        {/* Internal links */}
        <section aria-label="Xem thêm">
          <h2 className="text-xl font-bold text-slate-700 mb-3">Xem thêm</h2>
          <ul className="flex flex-wrap gap-3 list-none p-0">
            <li><Link href="/mua-ban" className="text-emerald-600 hover:underline font-medium">Mua bán nhà đất</Link></li>
            <li><Link href="/thong-ke" className="text-emerald-600 hover:underline font-medium">Thống kê thị trường BĐS</Link></li>
            <li><Link href="/ho-chi-minh" className="text-emerald-600 hover:underline font-medium">Cho thuê TP.HCM</Link></li>
            <li><Link href="/ha-noi" className="text-emerald-600 hover:underline font-medium">Cho thuê Hà Nội</Link></li>
            <li><Link href="/da-nang" className="text-emerald-600 hover:underline font-medium">Cho thuê Đà Nẵng</Link></li>
          </ul>
        </section>
      </main>
    </>
  );
}
