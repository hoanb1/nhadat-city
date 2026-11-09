/**
 * Schema.org JSON-LD Structured Data Generators for NhaDat.City
 */

export function generateBreadcrumbSchema(items: { name: string; url: string }[], siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${siteUrl}${item.url}`,
    })),
  };
}

export function generateWebApplicationSchema(
  name: string,
  description: string,
  url: string,
  applicationCategory: string = 'RealEstateApplication',
  siteUrl: string
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    description,
    url: url.startsWith('http') ? url : `${siteUrl}${url}`,
    applicationCategory,
    operatingSystem: 'All',
    browserRequirements: 'Requires JavaScript for interactive calculations. Full SSR HTML provided.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'VND',
    },
    provider: {
      '@type': 'Organization',
      name: 'NhaDat.City',
      url: siteUrl,
    },
  };
}

export function generateFinancialProductSchema(
  bankName: string,
  productName: string,
  ratePct: number,
  url: string,
  siteUrl: string
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FinancialProduct',
    name: productName,
    provider: {
      '@type': 'BankOrCreditUnion',
      name: bankName,
    },
    annualPercentageRate: ratePct,
    feesAndCommissionsSpecification: 'Phí trả nợ trước hạn theo quy định từng thời kỳ của ngân hàng.',
    url: url.startsWith('http') ? url : `${siteUrl}${url}`,
  };
}

export function generateDatasetSchema(
  name: string,
  description: string,
  url: string,
  siteUrl: string,
  temporalCoverage: string = '2020/2026'
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name,
    description,
    url: url.startsWith('http') ? url : `${siteUrl}${url}`,
    temporalCoverage,
    spatialCoverage: {
      '@type': 'Place',
      name: 'Việt Nam',
    },
    creator: {
      '@type': 'Organization',
      name: 'NhaDat.City - Trung Tâm Dữ Liệu Bất Động Sản & Quy Hoạch',
      url: siteUrl,
    },
  };
}

export function generateArticleSchema(
  title: string,
  description: string,
  url: string,
  publishedAt: string,
  updatedAt: string | undefined,
  siteUrl: string
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url: url.startsWith('http') ? url : `${siteUrl}${url}`,
    datePublished: publishedAt,
    dateModified: updatedAt || publishedAt,
    author: {
      '@type': 'Organization',
      name: 'Ban Pháp Lý NhaDat.City',
      url: siteUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'NhaDat.City',
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/favicon.svg`,
      },
    },
  };
}

export function generateFAQSchema(faqs: { q?: string; a?: string; question?: string; answer?: string }[]) {
  if (!faqs || !Array.isArray(faqs) || faqs.length === 0) return null;
  const valid = faqs
    .map((faq) => ({
      q: faq.q || faq.question || '',
      a: faq.a || faq.answer || '',
    }))
    .filter((f) => f.q && f.a);
  if (valid.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: valid.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  };
}


export function generateProjectSchema(
  title: string,
  description: string,
  address: string,
  lat: number,
  lon: number,
  url: string,
  siteUrl: string
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ApartmentComplex',
    name: title,
    description,
    address: {
      '@type': 'PostalAddress',
      streetAddress: address,
      addressCountry: 'VN',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: lat,
      longitude: lon,
    },
    url: url.startsWith('http') ? url : `${siteUrl}${url}`,
  };
}

export function generateWardFAQSchema(
  ward: { name: string; slug: string; median_price_m2?: number; state_price_m2?: number; merged_from?: string; province_name?: string },
  province?: { name: string; slug?: string }
) {
  const provName = province?.name || ward.province_name || 'tỉnh/thành phố';
  const medianPrice = ward.median_price_m2 ? `${ward.median_price_m2} triệu VNĐ/m²` : 'đang cập nhật';
  const statePrice = ward.state_price_m2
    ? `${ward.state_price_m2} triệu VNĐ/m²`
    : ward.median_price_m2
      ? `${Math.round(ward.median_price_m2 * 0.35)} triệu VNĐ/m²`
      : 'theo bảng giá nhà nước';

  const faqs = [
    {
      q: `Giá đất trung bình tại ${ward.name}, ${provName} hiện nay là bao nhiêu?`,
      a: `Theo dữ liệu tổng hợp thị trường mới nhất năm 2026 trên NhaDat.City, giá đất thị trường trung bình tại ${ward.name} đạt khoảng ${medianPrice}. Mức giá nhà nước theo bảng giá đất quy định vào khoảng ${statePrice}.`,
    },
    {
      q: `Tình trạng sáp nhập đơn vị hành chính của ${ward.name} ra sao?`,
      a: ward.merged_from
        ? `${ward.name} thuộc ${provName}, được hình thành/sắp xếp lại từ các đơn vị hành chính cũ: ${ward.merged_from} theo Nghị quyết của UBTVQH.`
        : `${ward.name} là đơn vị hành chính trực thuộc ${provName}, đã được chuẩn hóa theo quy hoạch phân loại hành chính 2025 - 2026.`,
    },
    {
      q: `Làm thế nào để tra cứu bản đồ quy hoạch và ranh thửa đất tại ${ward.name}?`,
      a: `Người dùng có thể tra cứu trực tiếp bản đồ quy hoạch xây dựng, ranh giới hành chính và thông số địa chính thửa đất số của ${ward.name} thông qua bản đồ số hóa GIS VN2000 trên cổng thông tin NhaDat.City.`,
    },
  ];

  return generateFAQSchema(faqs);
}

export function generateProjectFAQSchema(project: {
  title?: string;
  name?: string;
  address?: string;
  ward_name?: string;
  province_name?: string;
  investor_name?: string;
  ref_price_m2?: number;
  price_m2?: number;
  project_type?: string;
  ownership?: string;
  legal_summary?: string;
}) {
  const projTitle = project.title || project.name || 'Dự án';
  const address = project.address || `${project.ward_name || ''}, ${project.province_name || ''}`.replace(/^,\s*/, '') || 'Việt Nam';
  const investor = project.investor_name || 'Chủ đầu tư uy tín';
  const price = project.ref_price_m2
    ? `${project.ref_price_m2} triệu VNĐ/m²`
    : project.price_m2
      ? `${project.price_m2} triệu VNĐ/m²`
      : 'thỏa thuận theo thị trường';

  const faqs = [
    {
      q: `Dự án ${projTitle} tọa lạc ở đâu?`,
      a: `Dự án ${projTitle} tọa lạc tại địa chỉ: ${address}. Vị trí kết nối giao thông đồng bộ và thuận tiện tiếp cận các tiện ích khu vực.`,
    },
    {
      q: `Mức giá bán tham chiếu tại ${projTitle} là bao nhiêu?`,
      a: `Mức giá tham chiếu tại dự án ${projTitle} hiện dao động quanh ${price}, tùy thuộc vào loại hình căn hộ, diện tích, tầng cao và chính sách bán hàng từng thời kỳ.`,
    },
    {
      q: `Chủ đầu tư và hồ sơ pháp lý dự án ${projTitle} như thế nào?`,
      a: `Dự án ${projTitle} được đầu tư phát triển bởi ${investor}. ${project.legal_summary || `Dự án sở hữu hình thức sở hữu: ${project.ownership || 'Sổ hồng lâu dài'}, đầy đủ phê duyệt quy hoạch 1/500 và giấy phép xây dựng theo luật định.`}`,
    },
  ];

  return generateFAQSchema(faqs);
}
