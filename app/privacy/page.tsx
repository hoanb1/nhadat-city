import type { Metadata } from 'next';
import Link from 'next/link';
import { IconShieldLock, IconArrowLeft } from '@tabler/icons-react';

export const metadata: Metadata = {
  title: 'Chính sách bảo mật | NhaDat.City',
  description: 'Chính sách bảo mật và quyền riêng tư của NhaDat.City. Chúng tôi cam kết bảo vệ thông tin cá nhân của bạn.',
  alternates: { canonical: 'https://nhadat.city/privacy' },
};

export default function PrivacyPage() {
  const sections = [
    {
      title: '1. Thông tin chúng tôi thu thập',
      items: [
        { label: 'Thông tin tài khoản', detail: 'Tên, email, số điện thoại khi đăng ký tài khoản hoặc đăng tin.' },
        { label: 'Dữ liệu sử dụng', detail: 'Lịch sử tìm kiếm, khu vực bản đồ đã xem, tin đăng đã xem — dùng để cải thiện trải nghiệm cá nhân hóa.' },
        { label: 'Dữ liệu vị trí', detail: 'Vị trí GPS (nếu bạn cấp quyền) để hiển thị bất động sản gần nhất. Dữ liệu này không được lưu trữ lâu dài.' },
        { label: 'Cookie & Tracking', detail: 'Cookie phiên đăng nhập và cookie phân tích (Google Analytics ẩn danh) để đo lường hiệu suất trang.' },
        { label: 'Dữ liệu AI Chat', detail: 'Nội dung hội thoại với AI tư vấn được xử lý real-time và không được lưu trữ vĩnh viễn.' },
      ],
    },
    {
      title: '2. Cách chúng tôi sử dụng thông tin',
      items: [
        { label: 'Cung cấp dịch vụ', detail: 'Hiển thị tin đăng phù hợp, xác thực danh tính người đăng tin, quản lý tài khoản.' },
        { label: 'Cải thiện sản phẩm', detail: 'Phân tích dữ liệu ẩn danh để nâng cao độ chính xác của bản đồ, thuật toán thống kê và AI tư vấn.' },
        { label: 'Liên lạc & Hỗ trợ', detail: 'Gửi thông báo về tin đăng của bạn, phản hồi khiếu nại, cập nhật điều khoản quan trọng.' },
        { label: 'Bảo mật & Phòng chống gian lận', detail: 'Phát hiện tài khoản giả mạo, tin đăng spam, hành vi bất thường trên nền tảng.' },
      ],
    },
    {
      title: '3. Chia sẻ thông tin',
      items: [
        { label: 'Không bán dữ liệu', detail: 'NhaDat.City cam kết KHÔNG bán thông tin cá nhân của bạn cho bên thứ ba vì mục đích thương mại.' },
        { label: 'Đối tác kỹ thuật', detail: 'Chúng tôi sử dụng Google OAuth, MongoDB Atlas và Google Gemini AI — các đối tác tuân thủ GDPR và bảo mật dữ liệu quốc tế.' },
        { label: 'Yêu cầu pháp lý', detail: 'Có thể cung cấp dữ liệu khi có yêu cầu hợp lệ từ cơ quan nhà nước có thẩm quyền theo quy định pháp luật Việt Nam.' },
      ],
    },
    {
      title: '4. Bảo mật dữ liệu',
      items: [
        { label: 'Mã hóa', detail: 'Toàn bộ dữ liệu truyền tải qua HTTPS/TLS 1.3. Mật khẩu được băm bằng bcrypt.' },
        { label: 'Quyền truy cập', detail: 'Chỉ nhân viên kỹ thuật được phân quyền mới có thể truy cập cơ sở dữ liệu production.' },
        { label: 'Lưu trữ', detail: 'Dữ liệu được lưu trên máy chủ đặt tại Việt Nam, sao lưu hàng ngày với mã hóa AES-256.' },
      ],
    },
    {
      title: '5. Quyền của bạn',
      items: [
        { label: 'Truy cập & Xuất dữ liệu', detail: 'Bạn có quyền xem và tải xuống toàn bộ dữ liệu cá nhân chúng tôi đang lưu trữ về bạn.' },
        { label: 'Chỉnh sửa', detail: 'Cập nhật thông tin cá nhân bất kỳ lúc nào qua trang Cài đặt tài khoản.' },
        { label: 'Xóa tài khoản', detail: 'Yêu cầu xóa toàn bộ dữ liệu cá nhân và tin đăng qua trang Cài đặt hoặc email hỗ trợ.' },
        { label: 'Từ chối marketing', detail: 'Hủy đăng ký email thông báo bất kỳ lúc nào bằng link ở cuối email hoặc trong phần Cài đặt.' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors no-underline text-sm">
            <IconArrowLeft size={16} />
            <span>Trang chủ</span>
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/" className="font-extrabold text-indigo-700 text-lg no-underline">NhaDat.City</Link>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-br from-emerald-900 to-emerald-700 py-14 px-6">
        <div className="max-w-4xl mx-auto flex items-center gap-5">
          <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center shrink-0">
            <IconShieldLock size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white m-0 mb-1">Chính sách bảo mật</h1>
            <p className="text-emerald-200 text-sm m-0">Cập nhật lần cuối: 16 tháng 5, 2026 · Hiệu lực từ 01/01/2025</p>
          </div>
        </div>
      </div>

      {/* Commitment Banner */}
      <div className="bg-emerald-600 py-3 px-6">
        <p className="max-w-4xl mx-auto text-center text-white text-sm font-semibold m-0">
          Cam kết: NhaDat.City KHÔNG bán dữ liệu cá nhân của bạn cho bất kỳ bên thứ ba nào.
        </p>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex flex-col gap-8">
          {sections.map((section) => (
            <section key={section.title} className="bg-white rounded-2xl p-7 shadow-sm border border-slate-100">
              <h2 className="text-[1.05rem] font-bold text-emerald-800 mt-0 mb-5">{section.title}</h2>
              <div className="flex flex-col gap-4">
                {section.items.map((item) => (
                  <div key={item.label} className="flex gap-3">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full mt-[7px] shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-800 text-[0.9rem]">{item.label}: </span>
                      <span className="text-slate-600 text-[0.88rem] leading-relaxed">{item.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* Contact Section */}
          <section className="bg-emerald-50 rounded-2xl p-7 border border-emerald-100">
            <h2 className="text-[1.05rem] font-bold text-emerald-800 mt-0 mb-3">6. Liên hệ về quyền riêng tư</h2>
            <p className="text-[0.9rem] text-slate-600 leading-relaxed m-0">
              Nếu có bất kỳ câu hỏi hoặc yêu cầu liên quan đến dữ liệu cá nhân, vui lòng liên hệ:{' '}
              <a href="mailto:privacy@nhadat.city" className="text-emerald-700 font-semibold no-underline hover:underline">
                privacy@nhadat.city
              </a>
              {' '}hoặc gửi văn bản đến địa chỉ của chúng tôi.
              Chúng tôi cam kết phản hồi trong vòng <strong>5 ngày làm việc</strong>.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-8 border-t border-slate-200 flex flex-wrap gap-4 text-sm text-slate-400">
          <Link href="/terms" className="hover:text-indigo-600 no-underline transition-colors">Điều khoản sử dụng</Link>
          <Link href="/about" className="hover:text-indigo-600 no-underline transition-colors">Về NhaDat.City</Link>
          <Link href="/contact" className="hover:text-indigo-600 no-underline transition-colors">Liên hệ</Link>
          <Link href="/" className="hover:text-indigo-600 no-underline transition-colors">← Quay về bản đồ</Link>
        </div>
      </main>
    </div>
  );
}
