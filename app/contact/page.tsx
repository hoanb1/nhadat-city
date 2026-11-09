import type { Metadata } from 'next';
import Link from 'next/link';
import { IconMail, IconPhone, IconMapPin, IconArrowLeft, IconClock, IconMessage } from '@tabler/icons-react';

const FAQ_ITEMS = [
  { q: 'Làm sao để đăng tin bất động sản?', a: 'Tạo tài khoản miễn phí, vào menu “Đăng tin” và điền thông tin bất động sản. Tin đăng sẽ xuất hiện trên bản đồ ngay sau khi duyệt.' },
  { q: 'Dữ liệu thống kê có chính xác không?', a: 'Số liệu được tính từ dữ liệu tin đăng thực tế và qua xử lý làm sạch bằng thuật toán Z-score (-2.5σ đến +6σ) để loại bỏ giá trị bất thường. Chỉ mang tính tham khảo, không phải định giá chính thức.' },
  { q: 'Làm sao báo cáo tin đăng gian lận?', a: 'Nhấn nút “Báo cáo” trên trang chi tiết tin đăng hoặc email trực tiếp đến support@nhadat.city kèm link tin đăng cần báo cáo.' },
  { q: 'Tôi có thể yêu cầu xóa dữ liệu cá nhân không?', a: 'Có. Vào Cài đặt → Xóa tài khoản, hoặc email privacy@nhadat.city. Chúng tôi xử lý trong 5 ngày làm việc.' },
  { q: 'Muốn hợp tác đặt quảng cáo hoặc tích hợp API?', a: 'Liên hệ partner@nhadat.city với mô tả chi tiết về nhu cầu hợp tác. Đội ngũ kinh doanh sẽ phản hồi trong 48 giờ.' },
];

export const metadata: Metadata = {
  title: 'Liên hệ NhaDat.City',
  description: 'Liên hệ với đội ngũ NhaDat.City để được hỗ trợ, hợp tác kinh doanh hoặc báo cáo vi phạm. Phản hồi trong vòng 24 giờ.',
  alternates: { canonical: 'https://nhadat.city/contact' },
};

export default function ContactPage() {
  const channels = [
    {
      icon: IconMail,
      color: 'indigo',
      title: 'Email hỗ trợ',
      value: 'support@nhadat.city',
      href: 'mailto:support@nhadat.city',
      note: 'Phản hồi trong 24 giờ làm việc',
    },
    {
      icon: IconMail,
      color: 'emerald',
      title: 'Email hợp tác',
      value: 'partner@nhadat.city',
      href: 'mailto:partner@nhadat.city',
      note: 'Đối tác môi giới & dự án BĐS',
    },
    {
      icon: IconMail,
      color: 'purple',
      title: 'Email bảo mật',
      value: 'privacy@nhadat.city',
      href: 'mailto:privacy@nhadat.city',
      note: 'Yêu cầu về quyền riêng tư & dữ liệu',
    },
    {
      icon: IconMessage,
      color: 'blue',
      title: 'Zalo hỗ trợ',
      value: 'Zalo: NhaDat.City',
      href: 'https://zalo.me/nhadatcity',
      note: 'Hỗ trợ nhanh qua Zalo',
    },
  ];

  const faq = FAQ_ITEMS;

  // JSON-LD: FAQPage
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  // JSON-LD: ContactPage
  const contactJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: 'Liên Hệ NhaDat.City',
    url: 'https://nhadat.city/contact',
    description: 'Liên hệ đội ngũ NhaDat.City để được hỗ trợ, hợp tác kinh doanh hoặc báo cáo vi phạm.',
    mainEntity: {
      '@type': 'Organization',
      name: 'NhaDat.City',
      email: 'support@nhadat.city',
      url: 'https://nhadat.city',
    },
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }} />
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors no-underline text-sm">
            <IconArrowLeft size={16} />
            <span>Trang chủ</span>
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/" className="font-extrabold text-indigo-700 text-lg no-underline">NhaDat.City</Link>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-black text-white m-0 mb-2">Liên hệ với chúng tôi</h1>
          <p className="text-slate-400 text-base m-0">Hỗ trợ kỹ thuật, hợp tác kinh doanh, báo cáo vi phạm và góp ý sản phẩm.</p>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Channels */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <h2 className="text-xl font-black text-slate-800 m-0">Kênh liên lạc</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {channels.map((c) => (
                <a
                  key={c.title}
                  href={c.href}
                  target={c.href.startsWith('http') ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex gap-4 no-underline hover:border-indigo-200 hover:shadow-md transition-all group"
                >
                  <div className={`w-11 h-11 rounded-xl bg-${c.color}-50 flex items-center justify-center shrink-0 group-hover:bg-${c.color}-100 transition-colors`}>
                    <c.icon size={20} className={`text-${c.color}-600`} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-0.5">{c.title}</div>
                    <div className="font-bold text-slate-800 text-sm">{c.value}</div>
                    <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-1">
                      <IconClock size={11} />
                      {c.note}
                    </div>
                  </div>
                </a>
              ))}
            </div>

            {/* Address */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex gap-4">
              <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                <IconMapPin size={20} className="text-rose-600" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Địa chỉ văn phòng</div>
                <div className="font-bold text-slate-800 text-sm">Hà Nội, Việt Nam</div>
                <div className="text-slate-500 text-sm mt-0.5">Giờ làm việc: 8:00–17:30, Thứ 2 – Thứ 6</div>
              </div>
            </div>

            {/* FAQ */}
            <div>
              <h2 className="text-xl font-black text-slate-800 mb-4">Câu hỏi thường gặp</h2>
              <div className="flex flex-col gap-3">
                {faq.map((item, i) => (
                  <details key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm group">
                    <summary className="px-5 py-4 font-semibold text-slate-800 text-[0.9rem] cursor-pointer list-none flex items-center justify-between">
                      {item.q}
                      <span className="text-slate-400 text-lg group-open:rotate-45 transition-transform inline-block">+</span>
                    </summary>
                    <div className="px-5 pb-4 text-slate-600 text-[0.85rem] leading-relaxed border-t border-slate-100 pt-3">
                      {item.a}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Info Card */}
          <div className="flex flex-col gap-5">
            <div className="bg-indigo-600 rounded-2xl p-6 text-white">
              <h3 className="font-black text-lg m-0 mb-3">Thông tin công ty</h3>
              <div className="flex flex-col gap-2.5 text-sm">
                <div>
                  <span className="text-indigo-100 text-xs uppercase font-bold block mb-0.5">Tên nền tảng</span>
                  <span className="font-bold">NhaDat.City</span>
                </div>
                <div>
                  <span className="text-indigo-100 text-xs uppercase font-bold block mb-0.5">Lĩnh vực</span>
                  <span>Công nghệ PropTech & Data Analytics</span>
                </div>
                <div>
                  <span className="text-indigo-100 text-xs uppercase font-bold block mb-0.5">Thành lập</span>
                  <span>2024</span>
                </div>
                <div>
                  <span className="text-indigo-100 text-xs uppercase font-bold block mb-0.5">Phủ sóng</span>
                  <span>63 tỉnh thành Việt Nam</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm m-0 mb-4 uppercase tracking-wide">Liên kết nhanh</h3>
              <div className="flex flex-col gap-2">
                {[
                  { href: '/terms', label: 'Điều khoản sử dụng' },
                  { href: '/privacy', label: 'Chính sách bảo mật' },
                  { href: '/about', label: 'Về NhaDat.City' },
                  { href: '/thong-ke', label: 'Thống kê thị trường' },
                  { href: '/', label: 'Bản đồ bất động sản' },
                ].map((l) => (
                  <Link key={l.href} href={l.href} className="text-[0.85rem] text-slate-600 hover:text-indigo-600 no-underline transition-colors py-1 border-b border-slate-50 last:border-0">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
