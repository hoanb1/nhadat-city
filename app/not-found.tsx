import Link from 'next/link';
import { IconMapSearch, IconHome } from '@tabler/icons-react';

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <div className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
        <IconMapSearch size={48} stroke={1.5} />
      </div>
      
      <h1 className="text-3xl font-bold text-slate-800 mb-3">
        Không tìm thấy nội dung
      </h1>
      
      <p className="text-slate-600 max-w-md mb-8 text-lg">
        Tin đăng hoặc trang bạn đang tìm kiếm không tồn tại, đã bị xóa hoặc URL không chính xác.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <Link 
          href="/"
          className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-full font-semibold hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg no-underline"
        >
          <IconHome size={20} />
          Về trang chủ
        </Link>
        <Link 
          href="/du-an"
          className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-full font-semibold hover:bg-slate-50 transition-colors shadow-sm no-underline"
        >
          Xem dự án nổi bật
        </Link>
      </div>
    </div>
  );
}
