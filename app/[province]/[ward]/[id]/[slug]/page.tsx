import { Metadata } from 'next';
import Image from 'next/image';
import { notFound, redirect, permanentRedirect } from 'next/navigation';
import { getRealEstateById, getSimilarRealEstates } from '@/lib/db/realEstate';
import { getImageUrl, formatMoney, makeUrlSlug, IMAGE_SIZES } from '@/lib/utils/utils';
import { JsonLd } from '@/components/JsonLd';
import MapOverlayUI from '@/components/Map/MapOverlayUI';
import { MapProvider } from '@/components/Map/MapContext';
import { slugToProvince } from '@/lib/utils/province';
import MainMapClientDeferred from '@/components/Map/MainMapClientDeferred';
import ProvinceLinks from '@/components/SEO/ProvinceLinks';
import ListingDetailContent from '@/components/ListingDetail/ListingDetailContent';
import { IconMapPin, IconChevronDown, IconMap } from '@tabler/icons-react';

// Revalidate every 1 hour
export const revalidate = 3600;

interface Props {
  params: Promise<{ province: string; ward: string; id: string; slug: string }>;
}

function wardSlugToName(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { province, ward, id } = await params;
  const item = await getRealEstateById(id);

  if (!item) {
    notFound();
  }

  const provinceName = slugToProvince(province);
  const wardName = wardSlugToName(ward);
  const cleanTitle = item.title.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, '').trim();

  // Price formatting
  const priceFormatted = item.price
    ? formatMoney(item.price)
    : item.totalPrice
    ? formatMoney(item.totalPrice)
    : 'Giá thỏa thuận';

  // Area formatting
  const areaFormatted = item.area ? `${item.area}m²` : '';

  // Feature pills for description
  const features: string[] = [];
  if (item.bedrooms) features.push(`${item.bedrooms}PN`);
  if (item.bathrooms) features.push(`${item.bathrooms}WC`);
  if (item.direction) features.push(`Hướng ${item.direction}`);
  const featureText = features.length > 0 ? ` (${features.join(', ')})` : '';

  // Clean description without HTML
  const rawDesc = item.description
    ? item.description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    : '';

  // High-CTR title: "Bán [Tên BĐS] [Diện tích] [Giá] tại [Xã/Phường], [Tỉnh/TP] | NhaDat.City"
  const priceSnippet = priceFormatted !== 'Giá thỏa thuận' ? ` – ${priceFormatted}` : '';
  const areaSnippet = areaFormatted ? ` ${areaFormatted}` : '';
  const title = `${cleanTitle}${areaSnippet}${priceSnippet} – ${wardName}, ${provinceName} | NhaDat.City`;

  // Rich description: key selling points + location + CTA (max ~155 chars)
  const descLead = `${cleanTitle} tại ${wardName}, ${provinceName}. ${priceFormatted ? `Giá ${priceFormatted}` : ''}${areaFormatted ? `, DT ${areaFormatted}` : ''}${featureText}.`.trim();
  const descTail = rawDesc
    ? ` ${rawDesc.slice(0, 155 - descLead.length - 25)}... Xem chi tiết trên NhaDat.City`
    : ' Thông tin chính chủ, sổ đỏ rõ ràng, xem vị trí trên bản đồ quy hoạch.';
  const description = (descLead + descTail).slice(0, 160);

  const imageUrl = getImageUrl(item.images?.[0], String(item._id), IMAGE_SIZES.CAROUSEL.width, IMAGE_SIZES.CAROUSEL.height);
  const canonicalUrl = `https://nhadat.city/${province}/${ward}/${id}/${makeUrlSlug(item.title)}`;

  return {
    title,
    description,
    keywords: `${cleanTitle}, mua bán nhà đất ${wardName}, nhà đất ${provinceName}, bất động sản ${wardName} ${provinceName}, bán nhà ${wardName}`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: cleanTitle,
        },
      ],
      type: 'article',
      url: canonicalUrl,
      siteName: 'NhaDat.City',
      locale: 'vi_VN',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function RealEstateDetailPage({ params }: Props) {
  const { province, ward, id, slug } = await params;
  const item = await getRealEstateById(id);

  if (!item) {
    notFound();
  }

  // Canonical URL enforcement (Short ID + Unified Slug)
  const canonicalSlug = makeUrlSlug(item.title);
  const targetPath = `/${province}/${ward}/${item.shortId || item._id}/${canonicalSlug}`;
  const currentPath = `/${province}/${ward}/${id}/${slug}`;

  if (targetPath !== currentPath) {
    permanentRedirect(targetPath);
  }

  const provinceName = slugToProvince(province);
  const wardName = wardSlugToName(ward);
  const cleanTitle = item.title.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, '').trim();
  const imageUrl = getImageUrl(item.images?.[0], String(item._id), IMAGE_SIZES.POPUP.width, IMAGE_SIZES.POPUP.height);
  const canonicalUrl = `https://nhadat.city/${province}/${ward}/${id}/${makeUrlSlug(item.title)}`;

  const similarListings = await getSimilarRealEstates(id, item, 12);

  // ── JSON-LD 1: RealEstateListing with nested mainEntity ──────────────────
  const propertyTypeSchema = item.propertyType === 'ChungCu' || item.title?.toLowerCase().includes('chung cư') || item.title?.toLowerCase().includes('căn hộ')
    ? 'Apartment'
    : item.propertyType === 'DatNen' || item.title?.toLowerCase().includes('đất nền')
    ? 'LandParcel'
    : 'SingleFamilyResidence';

  const priceValue = item.totalPrice || item.price || 0;
  const geoCoordinates = (item.lat && item.lng)
    ? { '@type': 'GeoCoordinates', latitude: item.lat, longitude: item.lng }
    : (item.coordinates?.length === 2)
    ? { '@type': 'GeoCoordinates', latitude: item.coordinates[1], longitude: item.coordinates[0] }
    : undefined;

  const mainEntity: Record<string, any> = {
    '@type': propertyTypeSchema,
    name: cleanTitle,
    description: item.description ? item.description.replace(/<[^>]*>/g, '').substring(0, 500) : cleanTitle,
    url: canonicalUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: item.address || undefined,
      addressLocality: wardName,
      addressRegion: provinceName,
      addressCountry: 'VN',
    },
    ...(geoCoordinates ? { geo: geoCoordinates } : {}),
    ...(item.bedrooms ? { numberOfRooms: item.bedrooms } : {}),
    ...(item.bathrooms ? { numberOfBathroomsTotal: item.bathrooms } : {}),
    ...(item.area ? {
      floorSize: {
        '@type': 'QuantitativeValue',
        value: item.area,
        unitCode: 'MTK',
      },
    } : {}),
    offers: {
      '@type': 'Offer',
      price: priceValue,
      priceCurrency: 'VND',
      availability: 'https://schema.org/InStock',
      url: canonicalUrl,
      priceSpecification: {
        '@type': 'PriceSpecification',
        price: priceValue,
        priceCurrency: 'VND',
        valueAddedTaxIncluded: true,
      },
    },
  };

  const listingJsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    '@id': canonicalUrl,
    name: cleanTitle,
    description: item.description ? item.description.replace(/<[^>]*>/g, '').substring(0, 500) : cleanTitle,
    url: canonicalUrl,
    image: item.images && item.images.length > 0 ? item.images.map((img: string) => getImageUrl(img, String(item._id), 1200, 800)) : undefined,
    datePosted: item.createdAt,
    dateModified: item.updatedAt || item.createdAt,
    mainEntity,
    offers: {
      '@type': 'Offer',
      price: priceValue,
      priceCurrency: 'VND',
      availability: 'https://schema.org/InStock',
      url: canonicalUrl,
      priceSpecification: {
        '@type': 'PriceSpecification',
        price: priceValue,
        priceCurrency: 'VND',
        valueAddedTaxIncluded: true,
      },
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: item.address || undefined,
      addressLocality: wardName,
      addressRegion: provinceName,
      addressCountry: 'VN',
    },
    ...(geoCoordinates ? { geo: geoCoordinates } : {}),
    seller: {
      '@type': 'Organization',
      name: 'NhaDat.City',
      url: 'https://nhadat.city',
    },
  };

  // ── JSON-LD 2: BreadcrumbList ─────────────────────────────────────────────
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'NhaDat.City', item: 'https://nhadat.city' },
      { '@type': 'ListItem', position: 2, name: provinceName, item: `https://nhadat.city/${province}` },
      { '@type': 'ListItem', position: 3, name: wardName, item: `https://nhadat.city/${province}/${ward}` },
      { '@type': 'ListItem', position: 4, name: cleanTitle, item: canonicalUrl },
    ],
  };

  // ── JSON-LD 3: Organization ───────────────────────────────────────────────
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'NhaDat.City',
    url: 'https://nhadat.city',
    logo: { '@type': 'ImageObject', url: 'https://nhadat.city/logo.png' },
    contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: 'support@nhadat.city' },
    sameAs: ['https://nhadat.city'],
  };

  // ── JSON-LD 4: FAQPage (auto-generated for rich snippets) ─────────────────
  const faqItems: { q: string; a: string }[] = [];
  const price = item.totalPrice || item.price;
  const pricePerM2 = item.area && price ? price / item.area : 0;

  if (price) {
    faqItems.push({
      q: `Giá bất động sản này là bao nhiêu?`,
      a: `Bất động sản có giá ${formatMoney(price)}${pricePerM2 ? `, tương đương ${formatMoney(pricePerM2)}/m²` : ''} tại ${wardName}, ${provinceName}.`,
    });
  }
  if (item.area) {
    let dims = `Diện tích ${item.area}m²`;
    if (item.facade) dims += `, mặt tiền ${item.facade}m`;
    if (item.depth) dims += `, chiều sâu ${item.depth}m`;
    faqItems.push({ q: 'Diện tích và kích thước bất động sản?', a: `${dims}${item.direction ? `. Hướng: ${item.direction}` : ''}.` });
  }
  if (item.legalPaper) {
    faqItems.push({
      q: 'Pháp lý bất động sản này thế nào?',
      a: `Tình trạng pháp lý: ${item.legalPaper}. Nên kiểm tra tại Văn phòng ĐKQSD đất trước khi giao dịch.`,
    });
  }
  if (price && price > 0) {
    const dp = price * 0.3;
    const la = price - dp;
    const mr = 0.08 / 12;
    const mo = 20 * 12;
    const mp = la * (mr * Math.pow(1 + mr, mo)) / (Math.pow(1 + mr, mo) - 1);
    faqItems.push({
      q: 'Chi phí vay mua nhà này hàng tháng khoảng bao nhiêu?',
      a: `Với trả trước 30%, vay 20 năm, lãi 8%/năm: khoảng ${formatMoney(mp)}/tháng. Dùng công cụ tính vay trên trang để điều chỉnh.`,
    });
  }

  const faqJsonLd = faqItems.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  } : null;

  return (
    <main className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col relative overflow-x-hidden">
      <JsonLd data={listingJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={orgJsonLd} />
      {faqJsonLd && <JsonLd data={faqJsonLd} />}

      {/* Preload hero image for LCP */}
      {imageUrl && (
        <link rel="preload" as="image" href={imageUrl} />
      )}

      <MapProvider 
        initialListingId={null}
        initialListing={item}
        initialProvince={province}
        initialWard={ward}
        initialCenter={item.coordinates ? [item.coordinates[0], item.coordinates[1]] : undefined}
        initialZoom={14}
      >
        {/* ── Top Hero Map Section (60vh so listing specs & photos are immediately visible below) ── */}
        <div className="w-full h-[60vh] min-h-[450px] relative flex flex-col border-b border-slate-800">
          <div className="w-full h-full relative flex flex-col">
            <div className="absolute inset-0 z-0 bg-slate-50">
              <MainMapClientDeferred />
            </div>
            <MapOverlayUI initialShowSidebar={false} />

            {/* Floating Pill: Quick jump to listing details */}
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
              <a
                href="#listing-detail-section"
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900/90 hover:bg-slate-900 text-white backdrop-blur-md border border-slate-700/80 shadow-2xl rounded-full text-xs font-bold cursor-pointer transition-all hover:scale-105 group no-underline"
              >
                <IconMapPin size={15} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>Xem chi tiết & hình ảnh căn nhà</span>
                <IconChevronDown size={15} className="text-emerald-400 animate-bounce" />
              </a>
            </div>
          </div>
        </div>

        {/* ── Full Webpage Content & Listing Details Section ── */}
        <section id="listing-detail-section" className="w-full bg-slate-950 py-8">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 w-full space-y-6">
            {/* Breadcrumbs Navigation */}
            <nav aria-label="Breadcrumb" className="text-xs text-slate-400">
              <ol className="flex items-center space-x-2 flex-wrap">
                <li><a href="/" className="hover:text-emerald-400">NhaDat.City</a></li>
                <li><span>/</span></li>
                <li><a href={`/${province}`} className="hover:text-emerald-400">Nhà đất {provinceName}</a></li>
                <li><span>/</span></li>
                <li><a href={`/${province}/${ward}`} className="hover:text-emerald-400">Nhà đất {wardName}</a></li>
                <li><span>/</span></li>
                <li className="text-emerald-400 font-semibold truncate max-w-[320px]">{cleanTitle}</li>
              </ol>
            </nav>

            {/* Listing Detail Card & Full Content */}
            <div className="bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
              <ListingDetailContent listing={item} currentUrl={canonicalUrl} similarListings={similarListings} />
            </div>

            {/* Visible Internal Links Matrix Footer */}
            <ProvinceLinks currentProvince={province} className="rounded-2xl border border-slate-800 bg-slate-900 text-slate-300 shadow-xl" />
          </div>

          {/* Back to top map button */}
          <div className="w-full flex justify-center pt-8 pb-4">
            <a
              href="#"
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-indigo-600 border border-slate-800 hover:border-indigo-500 text-slate-300 hover:text-white rounded-full text-xs font-semibold cursor-pointer transition-all shadow-lg no-underline"
            >
              <IconMap size={15} />
              <span>Quay lại xem bản đồ vị trí</span>
            </a>
          </div>
        </section>
      </MapProvider>
    </main>
  );
}
