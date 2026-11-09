'use client';

import { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { formatMoney, formatArea } from '@/lib/utils/utils';

interface Props {
  listing: any;
  areaName?: string;
}

interface FAQItem {
  q: string;
  a: string;
}

function generateFAQs(listing: any, areaName: string): FAQItem[] {
  const faqs: FAQItem[] = [];
  const title = listing.title || 'bất động sản này';
  const area = listing.area;
  const price = listing.totalPrice || listing.price;
  const pricePerM2 = area && price ? price / area : 0;
  const bedrooms = listing.bedrooms;
  const direction = listing.direction;
  const legalPaper = listing.legalPaper;
  const facade = listing.facade;
  const depth = listing.depth;
  const advantages = listing.advantages || [];

  // Price FAQ
  if (price) {
    faqs.push({
      q: `Giá bất động sản "${title.substring(0, 60)}" là bao nhiêu?`,
      a: `Bất động sản này có giá ${formatMoney(price)}${pricePerM2 ? `, tương đương ${formatMoney(pricePerM2)}/m²` : ''}. Giá có thể thương lượng trực tiếp với ${listing.contact?.fullName || 'người bán'}.`,
    });
  }

  // Area & Dimensions FAQ
  if (area) {
    let dims = `Diện tích ${formatArea(area)}`;
    if (facade) dims += `, mặt tiền ${facade}m`;
    if (depth) dims += `, chiều sâu ${depth}m`;
    faqs.push({
      q: `Diện tích và kích thước bất động sản này như thế nào?`,
      a: `${dims}. ${bedrooms ? `Nhà có ${bedrooms} phòng ngủ.` : ''} ${direction ? `Hướng nhà: ${direction}.` : ''}`,
    });
  }

  // Legal FAQ
  if (legalPaper) {
    const isGood = legalPaper.includes('Sổ');
    faqs.push({
      q: `Pháp lý bất động sản này thế nào? Có sổ đỏ/sổ hồng không?`,
      a: `Tình trạng pháp lý: ${legalPaper}. ${isGood
        ? 'Bất động sản có giấy tờ hợp lệ, đủ điều kiện giao dịch, sang tên và vay ngân hàng.'
        : 'Nên kiểm tra kỹ giấy tờ pháp lý trước khi giao dịch.'} Luôn kiểm tra tại Văn phòng ĐKQSD đất trước khi mua.`,
    });
  }

  // Location FAQ
  faqs.push({
    q: `Bất động sản này ở khu vực nào?`,
    a: `Bất động sản tọa lạc tại ${listing.address || areaName}. ${advantages.length > 0
      ? `Khu vực có các ưu điểm: ${advantages.join(', ')}.`
      : 'Hãy xem phần "Tiện ích xung quanh" để biết thêm về trường học, bệnh viện, chợ gần đây.'}`,
  });

  // Monthly cost FAQ
  if (price && price > 0) {
    const downPayment = price * 0.3;
    const loanAmount = price - downPayment;
    const monthlyRate = 0.08 / 12;
    const months = 20 * 12;
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
    faqs.push({
      q: `Chi phí vay mua nhà này hàng tháng là bao nhiêu?`,
      a: `Với trả trước 30% (${formatMoney(downPayment)}), vay ${formatMoney(loanAmount)} trong 20 năm, lãi suất 8%/năm, bạn trả khoảng ${formatMoney(monthlyPayment)}/tháng. Dùng công cụ "Tính toán vay mua nhà" trên trang để điều chỉnh theo nhu cầu.`,
    });
  }

  // Tax FAQ
  if (price) {
    const tax = price * 0.02;
    const fee = price * 0.005;
    faqs.push({
      q: `Thuế phí khi mua bất động sản này là bao nhiêu?`,
      a: `Ước tính: Thuế TNCN ${formatMoney(tax)} (2%, bên bán nộp), Lệ phí trước bạ ${formatMoney(fee)} (0.5%, bên mua nộp). Tổng chi phí phát sinh khoảng ${formatMoney(tax + fee + 500000)}. Chi tiết xem tại phần "Hướng dẫn pháp lý".`,
    });
  }

  return faqs;
}

export default function AutoFAQ({ listing, areaName = '' }: Props) {
  const faqs = generateFAQs(listing, areaName);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (faqs.length === 0) return null;

  return (
    <div className="bg-white sm:rounded-2xl sm:border border-slate-200 p-5 sm:p-7 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white">
          <HelpCircle size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Câu hỏi thường gặp</h2>
          <p className="text-xs text-slate-500">Thông tin hữu ích cho người mua</p>
        </div>
      </div>

      <div className="space-y-2">
        {faqs.map((faq, i) => (
          <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="flex items-center justify-between w-full p-4 text-left hover:bg-slate-50 transition-colors"
            >
              <span className="text-sm font-semibold text-slate-800 pr-4">{faq.q}</span>
              {openIndex === i ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
            </button>
            {openIndex === i && (
              <div className="px-4 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Export FAQ generator for JSON-LD use in server components
export { generateFAQs };
