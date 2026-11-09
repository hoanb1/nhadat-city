import Link from 'next/link';
import { PROVINCES } from '@/lib/utils/province';
import ProvinceLinks from '@/components/SEO/ProvinceLinks';

export default function StatisticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
      {/* ── Top Header & Breadcrumb ── */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <nav aria-label="Breadcrumb" className="text-xs text-slate-400">
            <ol className="flex items-center space-x-2">
              <li><Link href="/" className="hover:text-emerald-400">NhaDat.City</Link></li>
              <li><span>/</span></li>
              <li className="text-emerald-400 font-semibold">Thống kê thị trường</li>
            </ol>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-emerald-500 transition-all no-underline">
              Xem bản đồ
            </Link>
            <Link href="/mua-ban" className="text-xs text-white px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold transition-all no-underline shadow-sm">
              Mua bán nhà đất
            </Link>
          </div>
        </div>
      </header>

      {/* ── Province Filter Pills ── */}
      <div className="bg-slate-900 border-b border-slate-800 py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
            <span className="text-xs text-slate-400 shrink-0 font-medium">Chọn khu vực:</span>
            <Link href="/thong-ke" className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold shrink-0 no-underline shadow-sm">
              Toàn quốc
            </Link>
            {Object.entries(PROVINCES).slice(0, 14).map(([slug, name]) => (
              <Link
                key={slug}
                href={`/thong-ke/${slug}`}
                className="px-3 py-1.5 rounded-full bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 text-slate-300 hover:text-white text-xs shrink-0 no-underline transition-all"
              >
                {name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Dashboard Content ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        <div className="bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
          {children}
        </div>

        {/* ── 63 Provinces Matrix Footer ── */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 text-slate-300 p-6 shadow-xl space-y-4">
          <h2 className="text-base font-bold text-white">Tra cứu báo cáo thống kê giá nhà đất 63 tỉnh thành</h2>
          <p className="text-xs text-slate-400">Xem phân tích chuyên sâu biến động giá trung bình theo m², nguồn cung và phân khúc diện tích từng tỉnh thành:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {Object.entries(PROVINCES).map(([slug, name]) => (
              <Link
                key={slug}
                href={`/thong-ke/${slug}`}
                className="p-2.5 bg-slate-950/70 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/40 rounded-xl text-xs text-slate-300 hover:text-emerald-400 transition-all no-underline text-center truncate"
              >
                BĐS {name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
