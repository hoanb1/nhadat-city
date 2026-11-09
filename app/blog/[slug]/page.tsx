import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublishedBlogBySlug, getRelatedBlog } from '@/lib/db/repo/publicBlog';
import { Map, Calendar, PenTool, Clock, Info, HelpCircle, Trophy, Newspaper } from 'lucide-react';

interface Props {
  params: Promise<{ slug: string }>;
}

async function getArticle(slug: string) {
  try {
    return await getPublishedBlogBySlug(slug);
  } catch {
    return null;
  }
}

async function getRelatedArticles(currentSlug: string) {
  try {
    return await getRelatedBlog(currentSlug, 4);
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: 'Không tìm thấy | NhaDat.City' };

  return {
    title: article.metaTitle || `${article.title} | NhaDat.City`,
    description: article.metaDescription || article.summary || article.title,
    keywords: article.tags?.join(', '),
    alternates: { canonical: `https://nhadat.city/blog/${slug}` },
    openGraph: {
      title: article.metaTitle || article.title,
      description: article.metaDescription || article.summary || '',
      url: `https://nhadat.city/blog/${slug}`,
      siteName: 'NhaDat.City',
      locale: 'vi_VN',
      type: 'article',
      images: [{ url: article.image || article.thumbnail || 'https://nhadat.city/og-image.jpg', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.metaTitle || article.title,
      description: article.metaDescription || article.summary || '',
      images: [article.image || article.thumbnail || 'https://nhadat.city/og-image.jpg'],
    },
  };
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) notFound();

  const related = await getRelatedArticles(slug);

  const publishedDate = article.createdAt
    ? new Date(article.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  return (
    <main className="min-h-screen" style={{ background: '#f8fafc', color: '#0f172a', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Top Navbar */}
      <header style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 1024, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#1e1b4b' }}>
            <Map className="w-6 h-6 text-indigo-600" strokeWidth={1.5} />
            <div>
              <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', color: '#4338ca' }}>NhaDat<span style={{ color: '#818cf8' }}>.City</span></span>
              <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bản đồ quy hoạch & BĐS</span>
            </div>
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <Link href="/" style={{ fontSize: 14, fontWeight: 600, color: '#475569', textDecoration: 'none' }}>Bản đồ trực tuyến</Link>
            <Link href="/blog" style={{ fontSize: 14, fontWeight: 700, color: '#4338ca', textDecoration: 'none' }}>Tất cả bài viết</Link>
          </nav>
        </div>
      </header>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 1024, margin: '0 auto', padding: '12px 20px' }}>
          <ol
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b', listStyle: 'none', margin: 0, padding: 0 }}
            itemScope itemType="https://schema.org/BreadcrumbList"
          >
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <Link href="/" itemProp="item" style={{ color: '#4338ca', textDecoration: 'none', fontWeight: 600 }}>
                <span itemProp="name">Trang chủ</span>
              </Link>
              <meta itemProp="position" content="1" />
            </li>
            <li style={{ color: '#cbd5e1' }}>›</li>
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <Link href="/blog" itemProp="item" style={{ color: '#4338ca', textDecoration: 'none', fontWeight: 600 }}>
                <span itemProp="name">Cẩm nang & quy hoạch</span>
              </Link>
              <meta itemProp="position" content="2" />
            </li>
            <li style={{ color: '#cbd5e1' }}>›</li>
            <li style={{ color: '#0f172a', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
              {article.title}
            </li>
          </ol>
        </div>
      </nav>

      {/* Article Container */}
      <div style={{ maxWidth: 1024, margin: '0 auto', padding: '32px 20px 64px' }}>
        <article
          itemScope itemType="https://schema.org/Article"
          style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}
        >
          {/* Header */}
          <header style={{ padding: '36px 36px 24px', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)' }}>
            <span style={{
              display: 'inline-block', padding: '4px 12px', borderRadius: 6,
              background: '#e0e7ff', color: '#4338ca', fontSize: 12, fontWeight: 800,
              marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              QUY HOẠCH & ĐẤT ĐAI 2026
            </span>
            <h1 itemProp="headline" style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.3, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
              {article.title}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13, color: '#64748b' }}>
              {publishedDate && (
                <time itemProp="datePublished" dateTime={article.createdAt ? new Date(article.createdAt).toISOString() : ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>{publishedDate}</span>
                </time>
              )}
              <span>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <PenTool className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>{article.author || 'Ban Biên Tập NhaDat.City'}</span>
              </span>
              <span>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>{Math.ceil((article.wordCount || 800) / 250)} phút đọc</span>
              </span>
            </div>

            {article.tags?.length > 0 && (
              <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {article.tags.map((tag: string) => (
                  <span key={tag} style={{
                    padding: '3px 10px', borderRadius: 999, background: '#f1f5f9',
                    color: '#475569', fontSize: 12, fontWeight: 500,
                  }}>#{tag}</span>
                ))}
              </div>
            )}
          </header>

          {/* Quick Summary Box */}
          {article.summary && (
            <div style={{ margin: '24px 36px 0', padding: '16px 20px', background: '#f0fdf4', borderLeft: '4px solid #16a34a', borderRadius: 8, fontSize: 14, color: '#166534', lineHeight: 1.6, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Info className="w-4 h-4 text-green-700 shrink-0 mt-0.5" strokeWidth={1.5} />
              <div><strong>Tóm tắt nhanh:</strong> {article.summary}</div>
            </div>
          )}

          {/* Content Body */}
          <div
            itemProp="articleBody"
            style={{
              padding: '28px 36px 36px',
              fontSize: '1.05rem',
              lineHeight: 1.8,
              color: '#1e293b',
            }}
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          {/* FAQ Accordion Section if available */}
          {article.faqs && article.faqs.length > 0 && (
            <div style={{ padding: '24px 36px 36px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <HelpCircle className="w-5 h-5 text-indigo-600" strokeWidth={1.5} />
                <span>Câu hỏi thường gặp về quy hoạch</span>
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {article.faqs.map((faq: { question: string; answer: string }, idx: number) => (
                  <div key={idx} style={{ background: '#ffffff', borderRadius: 10, padding: '16px 20px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#4338ca', margin: '0 0 8px' }}>
                      Q: {faq.question}
                    </h3>
                    <p style={{ fontSize: 14, color: '#334155', margin: 0, lineHeight: 1.6 }}>
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* Action Banners & Direct Map Link */}
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          <Link
            href="/"
            style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: 18,
              background: 'linear-gradient(135deg, #4338ca, #6366f1)',
              color: '#ffffff', borderRadius: 14, textDecoration: 'none',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            }}
          >
            <Map className="w-8 h-8 text-white shrink-0" strokeWidth={1.5} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Tra cứu bản đồ vệ tinh trực tiếp</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>Bật lớp ranh thửa VN-2000 và quy hoạch phân khu</div>
            </div>
          </Link>

          <a
            href="https://ve-so.com"
            target="_blank"
            rel="nofollow noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: 18,
              background: 'linear-gradient(135deg, #dc2626, #ef4444)',
              color: '#ffffff', borderRadius: 14, textDecoration: 'none',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            }}
          >
            <Trophy className="w-8 h-8 text-white shrink-0" strokeWidth={1.5} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Kết quả xổ số hôm nay</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>XSMB · XSMN · XSMT · Vietlott trực tiếp siêu tốc</div>
            </div>
          </a>
        </div>

        {/* Related Articles Carousel / Grid */}
        {related.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Newspaper className="w-5 h-5 text-indigo-600" strokeWidth={1.5} />
                <span>Bài viết quy hoạch liên quan</span>
              </h2>
              <Link href="/blog" style={{ fontSize: 13, fontWeight: 700, color: '#4338ca', textDecoration: 'none' }}>
                Xem tất cả bài viết →
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {related.map((item: any) => (
                <article
                  key={item.slug}
                  style={{
                    background: '#ffffff',
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#4338ca', background: '#e0e7ff', padding: '2px 6px', borderRadius: 4, display: 'inline-block', marginBottom: 6 }}>
                      QUY HOẠCH 2026
                    </span>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px', lineHeight: 1.4 }}>
                      <Link href={`/blog/${item.slug}`} style={{ color: '#0f172a', textDecoration: 'none' }}>
                        {item.title}
                      </Link>
                    </h3>
                    <p style={{ color: '#64748b', fontSize: 12, lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.summary || item.title}
                    </p>
                  </div>
                  <div style={{ marginTop: 12, borderTop: '1px solid #f1f5f9', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#94a3b8' }}>
                    <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '2026'}</span>
                    <Link href={`/blog/${item.slug}`} style={{ color: '#4338ca', fontWeight: 700, textDecoration: 'none' }}>
                      Đọc →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": article.title,
            "description": article.metaDescription || article.summary || article.title,
            "image": [article.image || article.thumbnail || 'https://nhadat.city/og-image.jpg'],
            "url": `https://nhadat.city/blog/${slug}`,
            "datePublished": article.createdAt,
            "dateModified": article.updatedAt || article.createdAt,
            "author": article.author ? {
              "@type": "Person",
              "name": article.author
            } : {
              "@type": "Organization",
              "name": "NhaDat.City",
              "url": "https://nhadat.city"
            },
            "publisher": {
              "@type": "Organization",
              "name": "NhaDat.City",
              "url": "https://nhadat.city",
              "logo": { "@type": "ImageObject", "url": "https://nhadat.city/logo.png" },
            },
            "keywords": article.tags?.join(', '),
            "mainEntityOfPage": { "@type": "WebPage", "@id": `https://nhadat.city/blog/${slug}` },
          })
        }}
      />
    </main>
  );
}
