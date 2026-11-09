import type { Metadata } from 'next';
import Link from 'next/link';
import { listPublishedBlog } from '@/lib/db/repo/publicBlog';
import { Map, MapPin, Sparkles, Calendar, PenTool, BookOpen, Building2, Globe, Trophy } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Cẩm nang & bản đồ quy hoạch bất động sản 2026 | NhaDat.City',
  description: 'Tra cứu cẩm nang quy hoạch đất đai, bản đồ phân khu, bảng giá đất 63 tỉnh thành mới nhất 2026. Phân tích thị trường bất động sản chuyên sâu cùng NhaDat.City.',
  keywords: 'quy hoạch đất đai 2026, bản đồ quy hoạch hà nội, bản đồ quy hoạch tphcm, bảng giá đất, ranh thửa đất đai, tra cứu quy hoạch',
  alternates: { canonical: 'https://nhadat.city/blog' },
  openGraph: {
    title: 'Cẩm nang & bản đồ quy hoạch bất động sản 2026 | NhaDat.City',
    description: 'Tổng hợp bản đồ quy hoạch chi tiết, bảng giá đất và định hướng phát triển hạ tầng 63 tỉnh thành.',
    url: 'https://nhadat.city/blog',
    siteName: 'NhaDat.City',
    locale: 'vi_VN',
    type: 'website',
    images: [{ url: 'https://nhadat.city/og-image.jpg', width: 1200, height: 630 }],
  },
};

async function getArticles() {
  try {
    const articles = await listPublishedBlog(60);
    return articles.filter((a: any) => a.slug && a.slug !== 'null');
  } catch (err) {
    console.error('[Blog Page Error] Failed to fetch articles:', err);
    return [];
  }
}

export default async function BlogIndexPage() {
  const articles = await getArticles();
  const featured = articles[0] || null;
  const recentArticles = articles.slice(1);

  const hotLocations = [
    { name: 'Hà Nội', slug: 'ha-noi', count: '12 phân khu' },
    { name: 'TP. Hồ Chí Minh', slug: 'ho-chi-minh', count: '16 phân khu' },
    { name: 'Đà Nẵng', slug: 'da-nang', count: '8 phân khu' },
    { name: 'Bắc Ninh', slug: 'bac-ninh', count: '6 phân khu' },
    { name: 'Bình Dương', slug: 'binh-duong', count: '9 phân khu' },
    { name: 'Đồng Nai', slug: 'dong-nai', count: '7 phân khu' },
    { name: 'Hải Phòng', slug: 'hai-phong', count: '8 phân khu' },
  ];

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', color: '#0f172a', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Top Navbar */}
      <header style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#1e1b4b' }}>
            <Map className="w-6 h-6 text-indigo-600" strokeWidth={1.5} />
            <div>
              <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', color: '#4338ca' }}>NhaDat<span style={{ color: '#818cf8' }}>.City</span></span>
              <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bản đồ quy hoạch & BĐS</span>
            </div>
          </Link>

          <nav style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 18 }}>
            <Link href="/" style={{ fontSize: 14, fontWeight: 600, color: '#475569', textDecoration: 'none' }}>Bản đồ trực tuyến</Link>
            <Link href="/du-an" style={{ fontSize: 14, fontWeight: 600, color: '#475569', textDecoration: 'none' }}>Dự án</Link>
            <Link href="/blog" style={{ fontSize: 14, fontWeight: 700, color: '#4338ca', textDecoration: 'none', borderBottom: '2px solid #4338ca', paddingBottom: 2 }}>Cẩm nang & quy hoạch</Link>
          </nav>
        </div>
      </header>

      {/* Hero Banner */}
      <section style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)', color: '#ffffff', padding: '48px 20px 56px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" style={{ marginBottom: 20 }}>
            <ol style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#c7d2fe', listStyle: 'none', margin: 0, padding: 0 }}>
              <li><Link href="/" style={{ color: '#e0e7ff', textDecoration: 'none' }}>Trang chủ</Link></li>
              <li>›</li>
              <li style={{ color: '#ffffff', fontWeight: 600 }}>Cẩm nang & bản đồ quy hoạch</li>
            </ol>
          </nav>

          <h1 style={{ fontSize: '2.25rem', fontWeight: 900, lineHeight: 1.2, margin: '0 0 14px', letterSpacing: '-0.025em' }}>
            Tra cứu bản đồ quy hoạch & cẩm nang bất động sản 2026
          </h1>
          <p style={{ fontSize: '1.05rem', color: '#e0e7ff', maxWidth: 720, lineHeight: 1.6, margin: '0 0 24px' }}>
            Cập nhật chi tiết đồ án quy hoạch phân khu 1/2000, 1/500, biến động bảng giá đất thị trường, phân tích ranh thửa và hành lang pháp lý đất đai trên toàn quốc.
          </p>

          {/* Quick Filter Tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#c7d2fe', alignSelf: 'center', marginRight: 4 }}>Khu vực trọng điểm:</span>
            {hotLocations.map(loc => (
              <Link
                key={loc.slug}
                href={`/${loc.slug}`}
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  padding: '6px 14px',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  transition: 'background 0.2s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <MapPin className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>{loc.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <div style={{ maxWidth: 1120, margin: '-24px auto 60px', padding: '0 20px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 32 }}>
        {/* Left Column: Articles List */}
        <div>
          {/* Featured Article Card */}
          {featured && (
            <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden', marginBottom: 32 }}>
              <div style={{ padding: '28px 32px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#dcfce7', color: '#15803d', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 10px', borderRadius: 6, marginBottom: 12 }}>
                  <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>BÀI VIẾT MỚI NHẤT</span>
                </span>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0 0 12px', lineHeight: 1.3 }}>
                  <Link href={`/blog/${featured.slug}`} style={{ color: '#0f172a', textDecoration: 'none' }}>
                    {featured.title}
                  </Link>
                </h2>
                <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6, margin: '0 0 18px' }}>
                  {featured.summary || featured.title}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                  <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />
                      {featured.createdAt ? new Date(featured.createdAt).toLocaleDateString('vi-VN') : '2026'}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <PenTool className="w-3.5 h-3.5" strokeWidth={1.5} />
                      {featured.author || 'Ban Biên Tập Quy Hoạch'}
                    </span>
                  </div>
                  <Link
                    href={`/blog/${featured.slug}`}
                    style={{
                      background: '#4338ca',
                      color: '#ffffff',
                      padding: '8px 18px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    Xem chi tiết →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Articles Grid */}
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e1b4b', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BookOpen className="w-5 h-5 text-indigo-600" strokeWidth={1.5} />
            <span>Tất cả bài phân tích quy hoạch & bản đồ ({articles.length} bài)</span>
          </h2>

          {articles.length === 0 ? (
            <div style={{ background: '#ffffff', padding: 48, borderRadius: 16, textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: 16, color: '#64748b' }}>Đang cập nhật thêm các bài viết quy hoạch mới...</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
              {recentArticles.map((art: any) => (
                <article
                  key={art.slug}
                  style={{
                    background: '#ffffff',
                    borderRadius: 14,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                >
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#4338ca', background: '#e0e7ff', padding: '3px 8px', borderRadius: 4, display: 'inline-block', marginBottom: 8 }}>
                      QUY HOẠCH 2026
                    </span>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 8px', lineHeight: 1.4 }}>
                      <Link href={`/blog/${art.slug}`} style={{ color: '#0f172a', textDecoration: 'none' }}>
                        {art.title}
                      </Link>
                    </h3>
                    <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5, margin: '0 0 14px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {art.summary || art.title}
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: '#94a3b8' }}>
                      {art.createdAt ? new Date(art.createdAt).toLocaleDateString('vi-VN') : '2026'}
                    </span>
                    <Link href={`/blog/${art.slug}`} style={{ color: '#4338ca', fontWeight: 700, textDecoration: 'none' }}>
                      Đọc tiếp →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Sidebar */}
        <aside>
          {/* Direct Map Interactive Tool CTA */}
          <div style={{ background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)', color: '#ffffff', borderRadius: 16, padding: 24, marginBottom: 24, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <MapPin className="w-8 h-8 text-white mb-2" strokeWidth={1.5} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '10px 0 8px' }}>Tra Cứu Bản Đồ Vệ Tinh</h3>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: '#e0e7ff', margin: '0 0 16px' }}>
              Soi ranh thửa, kiểm tra số tờ số thửa VN-2000 và quy hoạch mở đường trực tiếp trên bản đồ số.
            </p>
            <Link
              href="/"
              style={{
                display: 'block',
                background: '#ffffff',
                color: '#4338ca',
                textAlign: 'center',
                padding: '10px 16px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              Mở Bản Đồ Ngay →
            </Link>
          </div>

          {/* Quick District Navigation */}
          <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, marginBottom: 24 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building2 className="w-4 h-4 text-indigo-600" strokeWidth={1.5} />
              <span>Đô Thị Trọng Điểm</span>
            </h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {hotLocations.map(l => (
                <li key={l.slug} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <Link
                    href={`/${l.slug}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 4px',
                      textDecoration: 'none',
                      color: '#334155',
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    <span>{l.name}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{l.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Partner Cross Promotion CTA */}
          <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Globe className="w-4 h-4 text-indigo-600" strokeWidth={1.5} />
              <span>Tiện Ích Liên Kết</span>
            </h3>
            <a
              href="https://ve-so.com"
              target="_blank"
              rel="nofollow noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                color: '#dc2626',
                textDecoration: 'none',
                marginBottom: 10,
              }}
            >
              <Trophy className="w-6 h-6 text-red-600 shrink-0" strokeWidth={1.5} />
              <div>
                <strong style={{ display: 'block', fontSize: 13, color: '#991b1b' }}>Kết quả xổ số 3 miền</strong>
                <span style={{ fontSize: 11, color: '#b91c1c' }}>ve-so.com · Trực tiếp siêu tốc</span>
              </div>
            </a>
          </div>
        </aside>
      </div>

      {/* Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Cẩm nang & bản đồ quy hoạch bất động sản 2026',
            description: 'Tổng hợp bản đồ quy hoạch chi tiết, bảng giá đất và định hướng phát triển hạ tầng 63 tỉnh thành.',
            url: 'https://nhadat.city/blog',
            publisher: {
              '@type': 'Organization',
              name: 'NhaDat.City',
              url: 'https://nhadat.city',
            },
          }),
        }}
      />
    </div>
  );
}
