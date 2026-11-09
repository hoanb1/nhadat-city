import type { Metadata } from 'next';
import Link from 'next/link';
import { IconMap2, IconChartBar, IconBrain, IconShield, IconUsers, IconArrowLeft } from '@tabler/icons-react';

export const metadata: Metadata = {
  title: 'Về NhaDat.City – Nền tảng bản đồ bất động sản thông minh',
  description: 'NhaDat.City là nền tảng bản đồ bất động sản thông minh hàng đầu Việt Nam, ứng dụng AI và phân tích dữ liệu lớn để cung cấp thông tin thị trường minh bạch.',
  alternates: { canonical: 'https://nhadat.city/about' },
};

const features = [
  {
    icon: IconMap2,
    color: 'indigo',
    title: 'Bản đồ BĐS thời gian thực',
    desc: 'Hơn 1.2 triệu tin đăng được hiển thị trực tiếp trên bản đồ 3D tương tác, cập nhật liên tục 24/7. Xem quy hoạch, cluster theo mật độ dân số và lọc theo hàng chục tiêu chí.',
  },
  {
    icon: IconChartBar,
    color: 'emerald',
    title: 'Thống kê & Phân tích chuyên sâu',
    desc: 'Biểu đồ biến động giá, phân khúc thị trường, loại hình BĐS cho từng tỉnh thành. Dữ liệu được làm sạch bằng thuật toán Z-score lọc ngoại lai thống kê.',
  },
  {
    icon: IconBrain,
    color: 'purple',
    title: 'AI Tư vấn thông minh',
    desc: 'Trợ lý AI được tích hợp trực tiếp trên bản đồ, hiểu được khu vực bạn đang xem và bất động sản bạn quan tâm để đưa ra tư vấn cá nhân hóa tức thì.',
  },
  {
    icon: IconShield,
    color: 'amber',
    title: 'Minh bạch & Đáng tin cậy',
    desc: 'Mỗi tin đăng được xác thực thông tin liên hệ. Hệ thống đánh giá đa chiều (Radar Chart) giúp người mua so sánh khách quan dựa trên giá, vị trí, tiện ích.',
  },
];

const stats = [
  { value: '1.2M+', label: 'Tin đăng', sublabel: 'cập nhật liên tục' },
  { value: '63', label: 'Tỉnh thành', sublabel: 'phủ sóng toàn quốc' },
  { value: '<2s', label: 'Tốc độ tải', sublabel: 'trải nghiệm mượt mà' },
  { value: '24/7', label: 'Hoạt động', sublabel: 'không gián đoạn' },
];

const techStack = [
  { name: 'Next.js 16', role: 'Framework Web', color: '#000' },
  { name: 'MapLibre GL', role: 'Bản đồ 3D', color: '#3b82f6' },
  { name: 'MongoDB', role: 'Database', color: '#10b981' },
  { name: 'Google Gemini', role: 'AI Engine', color: '#8b5cf6' },
  { name: 'Recharts', role: 'Biểu đồ', color: '#f59e0b' },
  { name: 'PM2 Cluster', role: 'Server', color: '#ef4444' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50">
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
      <div className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 py-20 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #6366f1 0%, transparent 60%), radial-gradient(circle at 80% 50%, #8b5cf6 0%, transparent 60%)' }} />
        <div className="max-w-5xl mx-auto relative">
          <div className="flex items-center gap-3 mb-6">
            <IconMap2 size={36} className="text-indigo-400" />
            <span className="text-3xl font-black text-white tracking-tight">NhaDat.City</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white leading-tight m-0 mb-4">
            Nền tảng bản đồ BĐS<br />
            <span className="text-indigo-400">thông minh hàng đầu Việt Nam</span>
          </h1>
          <p className="text-slate-300 text-lg max-w-2xl m-0 leading-relaxed">
            Kết hợp dữ liệu thời gian thực, trí tuệ nhân tạo và phân tích thống kê chuyên sâu để đưa thị trường bất động sản đến tay mọi người — minh bạch và dễ hiểu.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-indigo-600 py-8 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-black text-white">{s.value}</div>
              <div className="text-indigo-100 font-bold text-sm mt-0.5">{s.label}</div>
              <div className="text-indigo-100 text-xs">{s.sublabel}</div>
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Mission */}
        <section className="mb-12">
          <h2 className="text-2xl font-black text-slate-800 mb-4">Sứ mệnh của chúng tôi</h2>
          <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
            <p className="text-slate-600 leading-relaxed text-[0.95rem] m-0">
              Chúng tôi tin rằng thị trường bất động sản Việt Nam cần sự minh bạch hơn. Với hàng triệu người đang tìm mua nhà, thuê phòng hay đầu tư bất động sản, việc tiếp cận thông tin giá cả thực tế, xu hướng thị trường và chất lượng khu dân cư không nên là đặc quyền của các công ty môi giới lớn.
            </p>
            <p className="text-slate-600 leading-relaxed text-[0.95rem] mt-4 mb-0">
              <strong className="text-indigo-700">NhaDat.City</strong> được xây dựng để dân chủ hóa thông tin bất động sản — đưa những công cụ phân tích chuyên sâu vốn chỉ dành cho giới đầu tư chuyên nghiệp đến tay người mua nhà bình thường, hoàn toàn miễn phí.
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="mb-12">
          <h2 className="text-2xl font-black text-slate-800 mb-6">Tính năng nổi bật</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex gap-4">
                <div className={`w-12 h-12 rounded-xl bg-${f.color}-50 flex items-center justify-center shrink-0`}>
                  <f.icon size={22} className={`text-${f.color}-600`} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 mt-0 mb-2 text-[0.95rem]">{f.title}</h3>
                  <p className="text-slate-500 text-[0.85rem] leading-relaxed m-0">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tech Stack */}
        <section className="mb-12">
          <h2 className="text-2xl font-black text-slate-800 mb-6">Công nghệ sử dụng</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {techStack.map((t) => (
              <div key={t.name} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                <div>
                  <div className="font-bold text-slate-800 text-sm">{t.name}</div>
                  <div className="text-slate-500 text-xs">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-8 text-center">
          <IconUsers size={32} className="text-white mx-auto mb-3" />
          <h2 className="text-xl font-black text-white m-0 mb-2">Liên hệ hợp tác</h2>
          <p className="text-indigo-100 text-sm mb-5 m-0">Đối tác môi giới, nhà phát triển dự án, báo chí và media</p>
          <Link href="/contact" className="inline-block bg-white text-indigo-700 font-bold px-6 py-2.5 rounded-xl no-underline text-sm hover:bg-indigo-50 transition-colors">
            Liên hệ ngay →
          </Link>
        </section>

        <div className="mt-10 pt-8 border-t border-slate-200 flex flex-wrap gap-4 text-sm text-slate-400">
          <Link href="/terms" className="hover:text-indigo-600 no-underline transition-colors">Điều khoản sử dụng</Link>
          <Link href="/privacy" className="hover:text-indigo-600 no-underline transition-colors">Chính sách bảo mật</Link>
          <Link href="/contact" className="hover:text-indigo-600 no-underline transition-colors">Liên hệ</Link>
          <Link href="/" className="hover:text-indigo-600 no-underline transition-colors">← Quay về bản đồ</Link>
        </div>
      </main>
    </div>
  );
}
