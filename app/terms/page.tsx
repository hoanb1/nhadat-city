import type { Metadata } from 'next';
import Link from 'next/link';
import { IconScale, IconArrowLeft } from '@tabler/icons-react';

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng | NhaDat.City',
  description: 'Điều khoản và điều kiện sử dụng nền tảng NhaDat.City. Vui lòng đọc kỹ trước khi sử dụng dịch vụ.',
  alternates: { canonical: 'https://nhadat.city/terms' },
};

export default function TermsPage() {
  const sections = [
    {
      title: '1. Chấp nhận điều khoản',
      content: `Khi truy cập và sử dụng nền tảng NhaDat.City, bạn đồng ý chịu ràng buộc bởi các Điều Khoản Sử Dụng này. Nếu không đồng ý với bất kỳ phần nào, vui lòng không sử dụng dịch vụ của chúng tôi. NhaDat.City có quyền cập nhật điều khoản này bất kỳ lúc nào và sẽ thông báo qua email hoặc thông báo trên trang web.`,
    },
    {
      title: '2. Mô tả dịch vụ',
      content: `NhaDat.City là nền tảng thông tin bất động sản trực tuyến cung cấp: (a) Bản đồ bất động sản tương tác thời gian thực; (b) Công cụ tìm kiếm và lọc tin đăng bán/cho thuê; (c) Thống kê và phân tích thị trường khu vực; (d) Hệ thống tư vấn bằng AI; (e) Công cụ đăng tin bất động sản. Chúng tôi không phải là đại lý môi giới và không chịu trách nhiệm về tính chính xác của thông tin từ bên thứ ba.`,
    },
    {
      title: '3. Tài khoản người dùng',
      content: `Bạn có trách nhiệm bảo mật thông tin đăng nhập của mình. Mỗi người chỉ được tạo một tài khoản. Nghiêm cấm sử dụng tài khoản vào mục đích: đăng thông tin sai lệch, spam, lừa đảo, xâm phạm quyền sở hữu trí tuệ, hoặc vi phạm pháp luật Việt Nam. NhaDat.City có quyền khóa tài khoản vi phạm mà không cần thông báo trước.`,
    },
    {
      title: '4. Nội dung người dùng đăng tải',
      content: `Khi đăng tin trên NhaDat.City, bạn xác nhận: (a) Bạn là chủ sở hữu hoặc được ủy quyền hợp pháp đối với bất động sản đăng tin; (b) Thông tin về diện tích, giá cả, pháp lý là trung thực; (c) Hình ảnh đăng tải là ảnh thực của bất động sản và không vi phạm bản quyền; (d) Số điện thoại liên hệ là số thực và đang hoạt động. NhaDat.City có quyền xóa bất kỳ tin đăng nào vi phạm mà không hoàn phí.`,
    },
    {
      title: '5. Dữ liệu thống kê & phân tích',
      content: `Các số liệu thống kê trên NhaDat.City (giá trung bình, biến động giá...) được tính toán từ dữ liệu tin đăng đã qua xử lý làm sạch bằng thuật toán lọc ngoại lai thống kê (Z-score). Dữ liệu chỉ mang tính tham khảo và không phải định giá chính thức. NhaDat.City không chịu trách nhiệm về các quyết định đầu tư dựa trên dữ liệu này.`,
    },
    {
      title: '6. Sở hữu trí tuệ',
      content: `Toàn bộ nội dung trên NhaDat.City bao gồm logo, giao diện, mã nguồn, cơ sở dữ liệu và nội dung phân tích là tài sản của NhaDat.City và được bảo hộ bởi luật sở hữu trí tuệ Việt Nam. Nghiêm cấm sao chép, phân phối hoặc sử dụng thương mại bất kỳ nội dung nào mà không có sự đồng ý bằng văn bản.`,
    },
    {
      title: '7. Giới hạn trách nhiệm',
      content: `NhaDat.City cung cấp dịch vụ trên cơ sở "như hiện tại" và không đảm bảo tính liên tục hay không có lỗi. Chúng tôi không chịu trách nhiệm về thiệt hại trực tiếp, gián tiếp phát sinh từ việc sử dụng dịch vụ, bao gồm nhưng không giới hạn: mất dữ liệu, thiệt hại kinh doanh, quyết định đầu tư dựa trên thông tin từ nền tảng.`,
    },
    {
      title: '8. Luật điều chỉnh',
      content: `Các Điều Khoản này được điều chỉnh bởi pháp luật Cộng hòa Xã hội Chủ nghĩa Việt Nam. Mọi tranh chấp phát sinh sẽ được giải quyết tại Tòa án nhân dân có thẩm quyền tại Hà Nội. Nếu có bất kỳ điều khoản nào bị tuyên vô hiệu, các điều khoản còn lại vẫn có hiệu lực đầy đủ.`,
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
      <div className="bg-gradient-to-br from-indigo-900 to-indigo-700 py-14 px-6">
        <div className="max-w-4xl mx-auto flex items-center gap-5">
          <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center shrink-0">
            <IconScale size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white m-0 mb-1">Điều khoản sử dụng</h1>
            <p className="text-indigo-100 text-sm m-0">Cập nhật lần cuối: 16 tháng 5, 2026 · Hiệu lực từ 01/01/2025</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-8 text-sm text-amber-800">
          Vui lòng đọc kỹ các điều khoản dưới đây trước khi sử dụng dịch vụ. Việc tiếp tục sử dụng nền tảng đồng nghĩa với việc bạn chấp nhận toàn bộ điều khoản này.
        </div>

        <div className="flex flex-col gap-8">
          {sections.map((section) => (
            <section key={section.title} className="bg-white rounded-2xl p-7 shadow-sm border border-slate-100">
              <h2 className="text-[1.05rem] font-bold text-indigo-800 mt-0 mb-3">{section.title}</h2>
              <p className="text-[0.9rem] text-slate-600 leading-relaxed m-0">{section.content}</p>
            </section>
          ))}
        </div>

        {/* Footer links */}
        <div className="mt-10 pt-8 border-t border-slate-200 flex flex-wrap gap-4 text-sm text-slate-400">
          <Link href="/privacy" className="hover:text-indigo-600 no-underline transition-colors">Chính sách bảo mật</Link>
          <Link href="/about" className="hover:text-indigo-600 no-underline transition-colors">Về NhaDat.City</Link>
          <Link href="/contact" className="hover:text-indigo-600 no-underline transition-colors">Liên hệ</Link>
          <Link href="/" className="hover:text-indigo-600 no-underline transition-colors">← Quay về bản đồ</Link>
        </div>
      </main>
    </div>
  );
}
