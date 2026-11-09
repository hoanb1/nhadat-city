/**
 * SEO Content & Keyword Enhancer Helper
 * Provides automated LSI keyword expansion, FAQ content generator, and Schema Builders for nhadat.city
 */

export interface FAQItem {
  question: string;
  answer: string;
}

export interface NicheContentArticle {
  title: string;
  metaDescription: string;
  h1: string;
  sections: Array<{
    heading: string;
    content: string;
  }>;
  faqs: FAQItem[];
  lsiKeywords: string[];
}

export class ContentEnhancer {
  /**
   * Generates rich LSI keywords for Real Estate Micro-Niches
   */
  static getLSIKeywords(topic: string, location?: string): string[] {
    const loc = location || 'TP.HCM';
    return [
      `mua bán ${topic} ${loc} giá rẻ`,
      `pháp lý ${topic} sổ đỏ chính chủ`,
      `quy hoạch ${topic} mới nhất 2026`,
      `kinh nghiệm mua ${topic} không lo tranh chấp`,
      `giá đất ${topic} cập nhật hàng ngày`,
      `thủ tục sang tên ${topic} mới nhất`,
    ];
  }

  /**
   * Generates automated FAQs for Real Estate Legal & Property Pages
   */
  static generatePropertyFAQs(topic: string): FAQItem[] {
    return [
      {
        question: `Mua bán ${topic} cần những giấy tờ pháp lý gì?`,
        answer: `Khi thực hiện giao dịch liên quan đến ${topic}, người mua cần kiểm tra Giấy chứng nhận quyền sử dụng đất (Sổ đỏ/Sổ hồng), CCCD chính chủ, giấy xác nhận tình trạng hôn nhân và bản vẽ nội chính quy hoạch mới nhất.`,
      },
      {
        question: `Giá ${topic} hiện nay có biến động nhiều không?`,
        answer: `Giá ${topic} được cập nhật liên tục theo bảng giá đất thị trường năm 2026. Bạn có thể tra cứu chi tiết thông tin quy hoạch và biến động giá trực tiếp tại nhadat.city.`,
      },
      {
        question: `Làm sao để kiểm tra quy hoạch ${topic} không bị vướng giải tỏa?`,
        answer: `Bạn có thể tra cứu trực tiếp bản đồ quy hoạch 1/500 trên nhadat.city hoặc liên hệ Văn phòng Đăng ký Đất đai cấp Quận/Huyện để kiểm tra thông tin chính xác trước khi đặt cọc.`,
      },
    ];
  }

  /**
   * Builds FAQPage JSON-LD Schema
   */
  static buildFAQSchema(faqs: FAQItem[]) {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    };
  }
}
