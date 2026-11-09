import { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import Link from 'next/link';
import { getProjectById } from '@/lib/db/realEstate';
import { getImageUrl, formatMoney, makeUrlSlug, IMAGE_SIZES } from '@/lib/utils/utils';
import { JsonLd } from '@/components/JsonLd';
import ProjectDetailContent from '@/components/ProjectDetail/ProjectDetailContent';

export const revalidate = 3600;

interface Props {
  params: Promise<{ id: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = await getProjectById(id);

  if (!item) {
    notFound();
  }

  const cleanTitle = item.title.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, '').trim();

  // Build location string for title
  const locationParts = [
    item.adminunit?.ward,
    item.adminunit?.district,
    item.adminunit?.provinceName || item.adminunit?.province,
  ].filter(Boolean);
  const locationStr = locationParts.length > 0 ? ` tại ${locationParts.slice(-2).join(', ')}` : '';

  // Build price string if available
  const priceStr = item.minPrice && item.maxPrice
    ? ` – Giá từ ${formatMoney(item.minPrice)}`
    : item.minPrice ? ` – Giá từ ${formatMoney(item.minPrice)}` : '';

  // Intent-matching title: "Dự án [project] – Bảng giá, tiến độ & quy hoạch mới nhất | NhaDat.City"
  const enrichedTitle = `Dự án ${cleanTitle} – Bảng giá, tiến độ & quy hoạch mới nhất | NhaDat.City`;

  // Rich description: action + location + key specs
  const descBase = item.description
    ? item.description.replace(/<[^>]*>/g, '').substring(0, 100)
    : `Thông tin chi tiết dự án ${cleanTitle}`;
  const specs = [
    item.totalApartment ? `${item.totalApartment} căn hộ` : null,
    item.totalArea ? `${item.totalArea}ha` : null,
    item.ownership || null,
  ].filter(Boolean).join(', ');
  const description = `${descBase}. ${specs ? `Quy mô: ${specs}. ` : ''}Xem bảng giá, pháp lý, tiến độ xây dựng dự án${locationStr} tại NhaDat.City.`.substring(0, 160);

  const imageUrl = getImageUrl(item.images?.[0], String(item._id), IMAGE_SIZES.CAROUSEL.width, IMAGE_SIZES.CAROUSEL.height);
  const canonicalUrl = `https://nhadat.city/du-an/${id}/${makeUrlSlug(item.title)}`;

  return {
    title: enrichedTitle,
    description,
    keywords: `dự án ${cleanTitle}, tiến độ ${cleanTitle}, bảng giá ${cleanTitle}${locationStr ? `, bất động sản${locationStr}` : ''}`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: enrichedTitle,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: cleanTitle }],
      type: 'article',
      url: canonicalUrl,
      siteName: 'NhaDat.City',
      locale: 'vi_VN',
    },
    twitter: {
      card: 'summary_large_image',
      title: enrichedTitle,
      description,
      images: [imageUrl],
    },
    ...(!item.images?.length && (!item.description || item.description.length < 100)
      ? { robots: { index: false, follow: true } }
      : {}),
  };
}


export default async function ProjectDetailPage({ params }: Props) {
  const { id, slug } = await params;
  const item = await getProjectById(id);
  if (!item) notFound();

  // Redirect to short ID and correct slug URL if needed
  const correctId = item.shortId ? String(item.shortId) : String(item._id);
  const correctSlug = makeUrlSlug(item.title);
  if (id !== correctId || slug !== correctSlug) {
    permanentRedirect(`https://nhadat.city/du-an/${correctId}/${correctSlug}`);
  }

  const cleanTitle = item.title.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, '').trim();
  const canonicalUrl = `https://nhadat.city/du-an/${id}/${makeUrlSlug(item.title)}`;

  // ── JSON-LD: ApartmentComplex / Place ─────────────────────────────────────
  const listingJsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'ApartmentComplex',
    '@id': canonicalUrl,
    name: cleanTitle,
    description: item.description ? item.description.replace(/<[^>]*>/g, '').substring(0, 500) : cleanTitle,
    url: canonicalUrl,
    image: item.images && item.images.length > 0 ? item.images.map((img: string) => getImageUrl(img, String(item._id), 1200, 800)) : undefined,
    datePosted: item.createdAt,
    dateModified: item.updatedAt || item.createdAt,
    offers: {
      '@type': 'Offer',
      price: item.price || item.minPrice || 0,
      priceCurrency: 'VND',
      availability: 'https://schema.org/InStock',
      url: canonicalUrl,
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: item.address || undefined,
      addressLocality: item.adminunit?.district || undefined,
      addressRegion: item.adminunit?.province || undefined,
      addressCountry: 'VN',
    },
    ...(item.coordinates ? {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: item.coordinates[1],
        longitude: item.coordinates[0],
      },
    } : {}),
    seller: item.investorName ? {
      '@type': 'Organization',
      name: item.investorName,
      ...(item.investorLogo ? { logo: item.investorLogo } : {}),
      ...(item.investorDescription ? { description: item.investorDescription.substring(0, 200) } : {}),
    } : {
      '@type': 'Organization',
      name: 'NhaDat.City',
      url: 'https://nhadat.city',
    },
    ...(item.totalApartment ? { numberOfAccommodationUnits: item.totalApartment } : {}),
    ...(item.totalArea ? { floorSize: { '@type': 'QuantitativeValue', value: item.totalArea, unitText: 'SQM' } } : {}),
  };

  const breadcrumbItems = [
    { '@type': 'ListItem', position: 1, name: 'NhaDat.City', item: 'https://nhadat.city' },
    { '@type': 'ListItem', position: 2, name: 'Dự án', item: 'https://nhadat.city/du-an' },
  ];
  if (item.adminunit?.province) {
    breadcrumbItems.push({ '@type': 'ListItem', position: 3, name: item.adminunit.province, item: `https://nhadat.city/du-an?province=${encodeURIComponent(item.adminunit.province)}` });
    breadcrumbItems.push({ '@type': 'ListItem', position: 4, name: cleanTitle, item: canonicalUrl });
  } else {
    breadcrumbItems.push({ '@type': 'ListItem', position: 3, name: cleanTitle, item: canonicalUrl });
  }
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  };

  // FAQ Schema for project pages (SEO boost)
  const faqEntries: { question: string; answer: string }[] = [];
  if (item.investorName) faqEntries.push({ question: `Chủ đầu tư dự án ${cleanTitle} là ai?`, answer: `Chủ đầu tư dự án ${cleanTitle} là ${item.investorName}.` });
  if (item.address) faqEntries.push({ question: `Dự án ${cleanTitle} ở đâu?`, answer: `Dự án ${cleanTitle} tọa lạc tại ${item.address}.` });
  if (item.totalApartment) faqEntries.push({ question: `Dự án ${cleanTitle} có bao nhiêu căn hộ?`, answer: `Dự án có tổng cộng ${item.totalApartment} căn hộ.` });
  if (item.ownership) faqEntries.push({ question: `Hình thức sở hữu dự án ${cleanTitle}?`, answer: `Hình thức sở hữu: ${item.ownership}.` });
  const faqJsonLd = faqEntries.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqEntries.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  } : null;

  return (
    <main className="bg-slate-50 min-h-screen pb-12">
      <JsonLd data={listingJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      {faqJsonLd && <JsonLd data={faqJsonLd} />}
      
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-3 lg:py-4">
        {/* Breadcrumb Header */}
        <nav className="flex text-sm text-slate-500 font-medium mb-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
          <Link href="/" className="hover:text-indigo-600">Trang chủ</Link>
          <span className="mx-2 text-slate-400">›</span>
          <Link href="/du-an" className="hover:text-indigo-600">Dự án</Link>
          <span className="mx-2 text-slate-400">›</span>
          <span className="text-slate-800 truncate max-w-[200px] sm:max-w-[400px]">{cleanTitle}</span>
        </nav>
      </div>

      <ProjectDetailContent project={item} currentUrl={canonicalUrl} />
    </main>
  );
}
