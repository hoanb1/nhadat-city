import type { Metadata } from 'next';
import { getListingsByKeywordTerms } from '@/lib/db/repo/publicUser';
import { JsonLd } from '@/components/JsonLd';
import { makeUrlSlug } from '@/lib/utils/utils';
import ProvinceLinks from '@/components/SEO/ProvinceLinks';
import { Phone, MessageSquare, MapPin, Tag } from 'lucide-react';

interface TagPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { slug } = await params;
  const topicName = slug.replace(/-/g, ' ');
  const capitalizedTopic = topicName.charAt(0).toUpperCase() + topicName.slice(1);
  const month = new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  return {
    title: `Bán nhà đất ${topicName} chính chủ – Cập nhật ${month}`,
    description: `Danh sách tin đăng mua bán bất động sản ${topicName} mới nhất ${month}. Thông tin sổ đỏ chính chủ, vị trí đẹp, xem bản đồ quy hoạch trực tuyến tại nhadat.city.`,
    keywords: [topicName, `mua nha ${topicName}`, `ban dat ${topicName}`, `gia nha ${topicName}`, 'nhadat.city'],
    alternates: {
      canonical: `https://nhadat.city/tu-khoa/${slug}`,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      title: `Bán nhà đất ${topicName} chính chủ – Cập nhật ${month}`,
      description: `Tin đăng mua bán bất động sản ${topicName} chính chủ giá tốt. Xem vị trí bản đồ quy hoạch trực tiếp.`,
      url: `https://nhadat.city/tu-khoa/${slug}`,
      siteName: 'nhadat.city',
      type: 'website',
    },
  };
}

export default async function TagPage({ params }: TagPageProps) {
  const { slug } = await params;
  const topicName = slug.replace(/-/g, ' ');
  const capitalizedTopic = topicName.charAt(0).toUpperCase() + topicName.slice(1);
  const month = new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  let listings: any[] = [];
  try {
    const cleanQuery = topicName.replace(/ban|cho-thue|nha|dat|can-ho|chung-cu/gi, '').trim();
    const terms = cleanQuery.split(' ').filter(Boolean);
    listings = await getListingsByKeywordTerms(terms, 12);
  } catch {
    listings = [];
  }

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Bất động sản ${topicName}`,
    url: `https://nhadat.city/tu-khoa/${slug}`,
    description: `Danh sách bất động sản chính chủ liên quan đến từ khóa ${topicName}`,
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: 'https://nhadat.city' },
      { '@type': 'ListItem', position: 2, name: `Từ khóa: ${topicName}`, item: `https://nhadat.city/tu-khoa/${slug}` },
    ],
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Mua bán bất động sản ${topicName} ở đâu chính chủ giá tốt?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `NhaDat.City tổng hợp các tin đăng bất động sản ${topicName} chính chủ, thông tin pháp lý sổ đỏ rõ ràng, cập nhật ${month}.`
        }
      },
      {
        '@type': 'Question',
        name: `Giá bất động sản ${topicName} hiện nay bao nhiêu?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Giá mua bán nhà đất ${topicName} thay đổi tùy vị trí và diện tích. Tham khảo tin đăng thực tế và xem bản đồ quy hoạch trực tiếp trên NhaDat.City.`
        }
      }
    ]
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white py-12 px-4 sm:px-6 lg:px-8">
      <JsonLd data={collectionJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={faqJsonLd} />

      <div className="max-w-6xl mx-auto space-y-8">
        <header className="border-b border-slate-800 pb-6">
          <nav className="text-xs text-slate-400 mb-3 flex items-center space-x-2">
            <a href="/" className="hover:text-emerald-400">Trang chủ</a>
            <span>/</span>
            <span className="text-slate-200">Từ khóa: {topicName}</span>
          </nav>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-emerald-400">
            Mua bán bất động sản {topicName}
          </h1>
          <p className="mt-2 text-slate-400 text-sm">
            Danh sách tin đăng mua bán nhà đất chính chủ, biệt thự, đất nền, căn hộ hot nhất dành cho từ khóa <strong className="text-white">&quot;{topicName}&quot;</strong> – Cập nhật {month}.
          </p>
        </header>

        {/* Lead Conversion CTA Bar */}
        <section className="bg-gradient-to-r from-emerald-900/60 via-slate-900 to-emerald-950/60 border border-emerald-500/30 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
          <div>
            <h3 className="text-base font-bold text-white">Cần tư vấn / đăng tin chính chủ khu vực {topicName}?</h3>
            <p className="text-xs text-slate-300">Kết nối trực tiếp chủ nhà, xem bản đồ quy hoạch trực tuyến hoàn toàn miễn phí.</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <a
              href="tel:+84000000000"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Gọi tư vấn ngay</span>
            </a>
            <a
              href="https://zalo.me"
              target="_blank"
              rel="noreferrer"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all shadow-md"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat Zalo chính chủ</span>
            </a>
          </div>
        </section>

        {/* Listings Grid */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-4">
            Tin đăng bất động sản mới nhất ({listings.length})
          </h2>
          {listings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((item) => {
                const prov = item.adminunit?.province || 'bat-dong-san';
                const ward = item.adminunit?.ward || '';
                const idToUse = item.shortId || item._id;
                const itemUrl = `https://nhadat.city/${prov}/${ward}/${idToUse}/${makeUrlSlug(item.title || '')}`;
                return (
                  <article key={item._id.toString()} className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-emerald-500/50 transition-all flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                        {item.price ? `${(item.price / 1000000000).toFixed(2)} Tỷ` : 'Thỏa thuận'}
                      </span>
                      <h3 className="mt-2 text-sm font-bold text-white line-clamp-2 hover:text-emerald-300">
                        <a href={itemUrl}>{item.title}</a>
                      </h3>
                      <p className="mt-1 text-xs text-slate-400 line-clamp-3">
                        {item.description || 'Thông tin nhà đất chính chủ, vị trí đẹp, pháp lý sổ đỏ rõ ràng.'}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {item.adminunit?.ward || 'Khu vực'}
                      </span>
                      <a href={itemUrl} className="text-emerald-400 font-semibold hover:underline">Xem chi tiết →</a>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-sm">
              Đang cập nhật tin đăng mua bán bất động sản cho từ khóa <strong className="text-white">&quot;{topicName}&quot;</strong>. 
              Vui lòng xem bản đồ quy hoạch trực tuyến hoặc liên hệ để được hỗ trợ thông tin mới nhất.
            </div>
          )}
        </section>

        {/* Niche Keyword Suggestions */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-3">
            Gợi ý từ khóa mua bán nhà đất liên quan
          </h2>
          <div className="flex flex-wrap gap-2">
            {[
              'bán nhà linh xuân',
              'bán nhà 1 tỷ ngõ 13 lĩnh nam',
              'bán chung cư newlife bãi cháy',
              'bán nhà lý triện đà nẵng',
              'bán nhà mặt tiền phan văn sửu',
              'bán nhà mặt tiền dương thị mười',
              'bán nhà luong ngoc quyen ha dong',
              'bán nhà mặt tiền quách điêu',
              'bán nhà khu dân cư việt sing',
              'bán nhà khu đô thị chí linh vũng tàu',
            ].map((tag, i) => (
              <a
                key={i}
                href={`/tu-khoa/${encodeURIComponent(tag.replace(/\s+/g, '-'))}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600/20 hover:border-emerald-500/50 border border-slate-700 text-xs text-slate-300 transition-all"
              >
                <Tag className="w-3 h-3 text-emerald-400" />
                <span>{tag}</span>
              </a>
            ))}
          </div>
        </section>

        {/* Internal Link Matrix */}
        <ProvinceLinks className="rounded-xl border border-slate-800" />
      </div>
    </main>
  );
}
