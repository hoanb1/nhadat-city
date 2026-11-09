import Link from 'next/link';
import { PROVINCES } from '@/lib/utils/province';
import { Map, Home, Building2, Key, BookOpen } from 'lucide-react';

export default function SeoFooter() {
  const provinceList = Object.entries(PROVINCES);

  return (
    <footer className="bg-slate-900 text-slate-300 text-xs py-10 px-4 border-t border-slate-800 mt-auto">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Section 1: Mua bán nhà đất */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Home className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
            <span>Mua bán nhà đất 63 tỉnh thành</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-3 gap-y-1.5">
            {provinceList.map(([slug, name]) => (
              <Link
                key={`mb-${slug}`}
                href={`/${slug}`}
                className="hover:text-emerald-400 transition-colors truncate"
              >
                Nhà đất {name}
              </Link>
            ))}
          </div>
        </div>

        {/* Section 2: Cho thuê nhà đất */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
            <span>Cho thuê nhà đất toàn quốc</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-3 gap-y-1.5">
            {provinceList.map(([slug, name]) => (
              <Link
                key={`ct-${slug}`}
                href={`/${slug}?propertyType=cho_thue`}
                className="hover:text-amber-400 transition-colors truncate"
              >
                Cho thuê {name}
              </Link>
            ))}
          </div>
        </div>

        {/* Section 3: Dự án bất động sản */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" strokeWidth={1.5} />
            <span>Dự án bất động sản</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-3 gap-y-1.5">
            {provinceList.map(([slug, name]) => (
              <Link
                key={`da-${slug}`}
                href={`/du-an?province=${slug}`}
                className="hover:text-indigo-400 transition-colors truncate"
              >
                Dự án {name}
              </Link>
            ))}
          </div>
        </div>

        {/* Section 4: Tra cứu quy hoạch */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Map className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
            <span>Tra cứu bản đồ quy hoạch</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-3 gap-y-1.5">
            {provinceList.map(([slug, name]) => (
              <Link
                key={`qh-${slug}`}
                href={`/quy-hoach/${slug}`}
                className="hover:text-blue-400 transition-colors truncate"
              >
                Quy hoạch {name}
              </Link>
            ))}
          </div>
        </div>

        {/* Section 5: Cẩm nang quy hoạch & thị trường */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-400" strokeWidth={1.5} />
            <span>Cẩm nang & bản đồ quy hoạch 2026</span>
          </h3>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-slate-300">
            <Link href="/blog" className="hover:text-purple-400 font-medium">Tất cả bài phân tích quy hoạch</Link>
            <Link href="/thong-ke" className="hover:text-purple-400 font-medium">Thống kê giá đất thị trường</Link>
            <Link href="/quy-hoach" className="hover:text-purple-400 font-medium">Bản đồ số không gian VN-2000</Link>
            <Link href="/du-an" className="hover:text-purple-400 font-medium">Đại đô thị & dự án trọng điểm</Link>
          </div>
        </div>

        {/* Footer bottom */}
        <div className="pt-6 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-400 text-xs">
          <p>© {new Date().getFullYear()} NhaDat.City — Nền tảng bản đồ bất động sản thông minh hàng đầu Việt Nam</p>
          <div className="flex gap-4">
            <Link href="/about" className="hover:text-white">Về chúng tôi</Link>
            <Link href="/contact" className="hover:text-white">Liên hệ</Link>
            <Link href="/blog" className="hover:text-white">Cẩm nang</Link>
            <Link href="/thong-ke" className="hover:text-white">Thống kê</Link>
            <Link href="/terms" className="hover:text-white">Điều khoản</Link>
            <Link href="/privacy" className="hover:text-white">Bảo mật</Link>
            <Link href="/sitemap.xml" className="hover:text-white">Sitemap</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
