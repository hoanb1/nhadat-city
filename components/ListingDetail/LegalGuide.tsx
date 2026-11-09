'use client';

import { useState } from 'react';
import { Scale, FileCheck, AlertTriangle, ChevronDown, ChevronRight, Receipt, ClipboardCheck, ShieldAlert, BookOpen } from 'lucide-react';
import { formatMoney } from '@/lib/utils/utils';

interface Props {
  listing: any;
}

// Knowledge base — static legal data
const LEGAL_CHECKLIST: Record<string, { title: string; items: string[] }> = {
  default: {
    title: 'Checklist pháp lý khi mua BĐS',
    items: [
      'Kiểm tra Giấy chứng nhận quyền sử dụng đất (Sổ đỏ/Sổ hồng) bản gốc',
      'Xác minh CCCD/CMND của bên bán khớp với tên trên sổ',
      'Kiểm tra tình trạng thế chấp, tranh chấp tại Văn phòng ĐKQSD đất',
      'Xác nhận BĐS không nằm trong quy hoạch giải tỏa',
      'Kiểm tra nghĩa vụ tài chính (thuế, phí) đã hoàn thành',
      'Lập hợp đồng mua bán có công chứng tại phòng công chứng',
      'Đăng ký biến động (sang tên) tại Văn phòng ĐKQSD đất',
    ],
  },
  dat: {
    title: 'Checklist pháp lý khi mua đất',
    items: [
      'Kiểm tra mục đích sử dụng đất (đất ở, đất nông nghiệp, đất thương mại)',
      'Xác minh ranh giới thửa đất khớp với bản đồ địa chính',
      'Kiểm tra diện tích thực tế so với sổ đỏ',
      'Xác nhận đất không thuộc hành lang bảo vệ (đê, điện, đường)',
      'Kiểm tra quy hoạch sử dụng đất tại UBND quận/huyện',
      'Đảm bảo đủ điều kiện tách thửa (nếu mua một phần)',
      'Lập hợp đồng chuyển nhượng có công chứng',
    ],
  },
  can_ho: {
    title: 'Checklist pháp lý khi mua căn hộ',
    items: [
      'Kiểm tra chủ đầu tư có giấy phép xây dựng',
      'Xác minh dự án đã được nghiệm thu đưa vào sử dụng',
      'Kiểm tra sổ hồng chung cư (riêng từng căn)',
      'Xem xét hợp đồng mua bán mẫu của chủ đầu tư',
      'Kiểm tra phí quản lý, bảo trì chung cư (2%)',
      'Xác nhận bảo lãnh ngân hàng cho dự án',
      'Kiểm tra diện tích thông thủy vs diện tích tim tường',
    ],
  },
};

const RISKS: Record<string, string[]> = {
  default: [
    'Mua đất quy hoạch: Không được cấp phép xây dựng, giá trị giảm',
    'Đất tranh chấp: Giao dịch bị tuyên vô hiệu, mất tiền',
    'Hợp đồng viết tay: Không có giá trị pháp lý từ 2004',
    'Sổ đỏ giả: Kiểm tra tại Văn phòng ĐKQSD đất trước khi giao dịch',
  ],
  'Giấy tờ hợp lệ': ['BĐS có giấy tờ hợp lệ nhưng chưa có Sổ đỏ/Sổ hồng chính thức → khó vay ngân hàng, rủi ro khi chuyển nhượng'],
  'Không có giấy tờ': ['Rủi ro cao: Giao dịch BĐS không có giấy tờ sẽ không được pháp luật bảo vệ'],
};

const PROCESS_STEPS = [
  { step: 1, title: 'Thỏa thuận & Đặt cọc', desc: 'Ký hợp đồng đặt cọc, thường 5-10% giá trị BĐS' },
  { step: 2, title: 'Công chứng hợp đồng', desc: 'Hai bên ra phòng công chứng ký HĐMB chính thức' },
  { step: 3, title: 'Nộp thuế & phí', desc: 'Nộp thuế TNCN, lệ phí trước bạ, phí thẩm định' },
  { step: 4, title: 'Sang tên sổ', desc: 'Nộp hồ sơ đăng ký biến động tại Văn phòng ĐKQSD đất' },
  { step: 5, title: 'Nhận sổ mới', desc: 'Thời gian xử lý: 10-30 ngày làm việc' },
];

export default function LegalGuide({ listing }: Props) {
  const [showProcess, setShowProcess] = useState(false);
  const [showRisks, setShowRisks] = useState(false);

  const totalPrice = listing.totalPrice || listing.price || 0;
  const propertyType = listing.propertyType || 'default';
  const legalPaper = listing.legalPaper || '';

  // Get appropriate checklist
  const checklistKey = LEGAL_CHECKLIST[propertyType] ? propertyType : 'default';
  const checklist = LEGAL_CHECKLIST[checklistKey];

  // Calculate taxes
  const thueTNCN = totalPrice * 0.02; // 2% for individuals
  const lePhiTruocBa = totalPrice * 0.005; // 0.5%
  const phiCongChung = Math.min(totalPrice * 0.001, 10_000_000); // 0.1%, cap 10M
  const phiThamDinh = 500_000;
  const totalTax = thueTNCN + lePhiTruocBa + phiCongChung + phiThamDinh;

  // Risks
  const riskItems = [
    ...(RISKS[legalPaper] || []),
    ...RISKS.default,
  ];

  return (
    <div className="bg-white sm:rounded-2xl sm:border border-slate-200 p-5 sm:p-7 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white">
          <Scale size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Hướng dẫn pháp lý</h2>
          <p className="text-xs text-slate-500">Thông tin cần biết khi mua bất động sản này</p>
        </div>
      </div>

      {/* Legal Status Badge */}
      {legalPaper && (
        <div className={`flex items-center gap-2 p-3 rounded-xl mb-5 ${
          legalPaper.includes('Sổ') ? 'bg-emerald-50 border border-emerald-200' :
          legalPaper.includes('Không') ? 'bg-red-50 border border-red-200' :
          'bg-amber-50 border border-amber-200'
        }`}>
          <FileCheck size={18} className={
            legalPaper.includes('Sổ') ? 'text-emerald-600' :
            legalPaper.includes('Không') ? 'text-red-600' :
            'text-amber-600'
          } />
          <span className="text-sm font-semibold">{legalPaper}</span>
        </div>
      )}

      {/* Checklist */}
      <div className="mb-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-3">
          <ClipboardCheck size={16} className="text-blue-600" />
          {checklist.title}
        </h3>
        <div className="space-y-2">
          {checklist.items.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
              <div className="w-5 h-5 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">{i + 1}</div>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tax Calculator */}
      {totalPrice > 0 && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100 p-4 mb-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-3">
            <Receipt size={16} className="text-amber-600" />
            Ước tính thuế & phí khi mua BĐS này
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Thuế TNCN (2% — bên bán nộp)</span>
              <span className="font-semibold text-slate-800">{formatMoney(thueTNCN)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Lệ phí trước bạ (0.5%)</span>
              <span className="font-semibold text-slate-800">{formatMoney(lePhiTruocBa)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Phí công chứng (~0.1%)</span>
              <span className="font-semibold text-slate-800">{formatMoney(phiCongChung)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Phí thẩm định hồ sơ</span>
              <span className="font-semibold text-slate-800">{formatMoney(phiThamDinh)}</span>
            </div>
            <div className="border-t border-amber-200 pt-2 mt-2 flex justify-between">
              <span className="font-bold text-slate-900">Tổng chi phí ước tính</span>
              <span className="font-extrabold text-amber-700">{formatMoney(totalTax)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Process Steps (collapsible) */}
      <button
        onClick={() => setShowProcess(v => !v)}
        className="flex items-center justify-between w-full py-3 px-4 bg-slate-50 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors border border-slate-200 mb-3"
      >
        <span className="flex items-center gap-2"><BookOpen size={15} /> Quy trình mua bán BĐS</span>
        {showProcess ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {showProcess && (
        <div className="pl-4 mb-4">
          {PROCESS_STEPS.map((s) => (
            <div key={s.step} className="flex gap-3 pb-4 last:pb-0 relative">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">{s.step}</div>
                {s.step < PROCESS_STEPS.length && <div className="w-0.5 flex-1 bg-blue-200 mt-1" />}
              </div>
              <div className="pb-2">
                <div className="text-sm font-semibold text-slate-800">{s.title}</div>
                <div className="text-xs text-slate-500">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Risk Warnings (collapsible) */}
      <button
        onClick={() => setShowRisks(v => !v)}
        className="flex items-center justify-between w-full py-3 px-4 bg-red-50 rounded-xl text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors border border-red-200"
      >
        <span className="flex items-center gap-2"><ShieldAlert size={15} /> Cảnh báo rủi ro pháp lý</span>
        {showRisks ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {showRisks && (
        <div className="mt-3 space-y-2 pl-1">
          {riskItems.map((risk, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-red-800">
              <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <span>{risk}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
