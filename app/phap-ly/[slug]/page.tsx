import { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { ContentEnhancer } from '@/lib/contentEnhancer';
import { SEOAnalyticClient } from '@/lib/seoAnalyticClient';

interface LegalPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  const { slug } = await params;
  const topicName = slug.replace(/-/g, ' ');

  return {
    title: `Pháp lý ${topicName} – Hướng dẫn & quy định mới nhất | NhaDat.City`,
    description: `Tư vấn pháp lý chi tiết về ${topicName}. Giải đáp quy định sổ đỏ, vi bằng, tranh chấp và thủ tục sang tên nhà đất chính xác 2026 tại NhaDat.City.`,
    keywords: [`phap ly ${topicName}`, topicName, `sang ten ${topicName}`, `tuyen dung phap ly ${topicName}`, 'nhadat.city'],
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
      title: `Tư vấn pháp lý BĐS: ${topicName} | NhaDat.City`,
      description: `Giải đáp thắc mắc pháp lý về ${topicName} mới nhất 2026.`,
      url: `https://nhadat.city/phap-ly/${slug}`,
      siteName: 'NhaDat.City',
      type: 'article',
    },
  };
}

export default async function LegalNichePage({ params }: LegalPageProps) {
  const { slug } = await params;
  const topicName = slug.replace(/-/g, ' ');
  
  const faqs = ContentEnhancer.generatePropertyFAQs(topicName);
  const lsiKeywords = ContentEnhancer.getLSIKeywords(topicName);
  const faqSchema = ContentEnhancer.buildFAQSchema(faqs);

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `Tư vấn pháp lý chi tiết về ${topicName}`,
    url: `https://nhadat.city/phap-ly/${slug}`,
    publisher: {
      '@type': 'Organization',
      name: 'NhaDat.City',
      url: 'https://nhadat.city',
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: 'https://nhadat.city' },
      { '@type': 'ListItem', position: 2, name: 'Tư vấn pháp lý', item: 'https://nhadat.city/phap-ly' },
      { '@type': 'ListItem', position: 3, name: topicName, item: `https://nhadat.city/phap-ly/${slug}` },
    ],
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <JsonLd data={faqSchema} />
      <JsonLd data={articleSchema} />
      <JsonLd data={breadcrumbSchema} />

      <div className="max-w-4xl mx-auto space-y-10">
        <header className="border-b border-slate-800 pb-6">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/50 uppercase tracking-wider">
            Chuyên mục pháp lý BĐS
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-4 leading-tight">
            Tư vấn & quy định mới nhất về {topicName} (cập nhật 2026)
          </h1>
          <p className="mt-3 text-slate-400 text-sm leading-relaxed">
            Giải đáp toàn bộ thắc mắc về điều kiện giao dịch, thủ tục công chứng, rủi ro pháp lý và kinh nghiệm mua bán đối với <strong className="text-emerald-400">{topicName}</strong>.
          </p>
        </header>

        {/* Nội dung chi tiết bài viết ngách */}
        <article className="prose prose-invert max-w-none space-y-6 text-slate-300 text-sm leading-relaxed">
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-emerald-400">1. Quy định pháp lý hiện hành về {topicName}</h2>
            <p>
              Theo Luật Đất đai và các văn bản hướng dẫn mới nhất, giao dịch liên quan đến <strong>{topicName}</strong> đòi hỏi các bên phải tuân thủ nghiêm ngặt các quy định về thẩm quyền công chứng, đăng ký biến động đất đai và thực hiện đầy đủ nghĩa vụ tài chính với Nhà nước.
            </p>
            <p>
              Việc nắm rõ hồ sơ pháp lý giúp hạn chế tối đa rủi ro tranh chấp tài sản, đặc biệt là với các loại hình bất động sản thuộc khu vực quy hoạch treo hoặc đồng sở hữu.
            </p>
          </section>

          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-emerald-400">2. Các bước thực hiện thủ tục {topicName} đúng luật</h2>
            <ol className="list-decimal list-inside space-y-2 text-slate-300">
              <li><strong>Bước 1:</strong> Kiểm tra trích lục bản đồ địa chính và thông tin quy hoạch tại UBND Quận/Huyện.</li>
              <li><strong>Bước 2:</strong> Lập hợp đồng mua bán/chuyển nhượng có công chứng hoặc chứng thực hợp pháp.</li>
              <li><strong>Bước 3:</strong> Kê khai thuế thu nhập cá nhân và lệ phí trước bạ tại Chi cục Thuế.</li>
              <li><strong>Bước 4:</strong> Nộp hồ sơ sang tên tại Văn phòng Đăng ký Đất đai để nhận Giấy chứng nhận mới.</li>
            </ol>
          </section>

          {/* Câu hỏi thường gặp FAQ */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">3. Câu hỏi thường gặp về {topicName}</h2>
            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <div key={idx} className="border border-slate-800 rounded-lg p-4 bg-slate-950/60">
                  <h3 className="text-sm font-bold text-emerald-400">Q: {faq.question}</h3>
                  <p className="text-xs text-slate-300 mt-2 leading-normal">A: {faq.answer}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Từ khóa LSI Mở Rộng */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Từ khóa liên quan được tìm kiếm nhiều:</h3>
            <div className="flex flex-wrap gap-2">
              {lsiKeywords.map((kw, i) => (
                <span key={i} className="px-3 py-1 rounded-md bg-slate-800 text-xs text-slate-300 border border-slate-700">
                  #{kw}
                </span>
              ))}
            </div>
          </section>
        </article>
      </div>
    </main>
  );
}
