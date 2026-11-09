'use client';

import { useState, useMemo } from 'react';
import { Calculator, TrendingDown, DollarSign, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { formatMoney } from '@/lib/utils/utils';

interface Props {
  totalPrice: number;
}

export default function MortgageCalculator({ totalPrice }: Props) {
  const [downPaymentPct, setDownPaymentPct] = useState(30);
  const [loanYears, setLoanYears] = useState(20);
  const [interestRate, setInterestRate] = useState(8);
  const [showSchedule, setShowSchedule] = useState(false);

  const calc = useMemo(() => {
    const downPayment = totalPrice * (downPaymentPct / 100);
    const loanAmount = totalPrice - downPayment;
    const monthlyRate = interestRate / 100 / 12;
    const totalMonths = loanYears * 12;

    if (monthlyRate === 0 || totalMonths === 0 || loanAmount <= 0) {
      return { downPayment, loanAmount, monthlyPayment: 0, totalInterest: 0, totalPayment: 0, schedule: [] };
    }

    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
    const totalPayment = monthlyPayment * totalMonths;
    const totalInterest = totalPayment - loanAmount;

    // Amortization schedule (yearly summary)
    const schedule: { year: number; principal: number; interest: number; remaining: number }[] = [];
    let remaining = loanAmount;
    for (let y = 1; y <= loanYears; y++) {
      let yearPrincipal = 0;
      let yearInterest = 0;
      for (let m = 0; m < 12; m++) {
        const interestPay = remaining * monthlyRate;
        const principalPay = monthlyPayment - interestPay;
        yearPrincipal += principalPay;
        yearInterest += interestPay;
        remaining -= principalPay;
      }
      schedule.push({ year: y, principal: yearPrincipal, interest: yearInterest, remaining: Math.max(0, remaining) });
    }

    return { downPayment, loanAmount, monthlyPayment, totalInterest, totalPayment, schedule };
  }, [totalPrice, downPaymentPct, loanYears, interestRate]);

  const interestPct = calc.totalPayment > 0 ? (calc.totalInterest / calc.totalPayment * 100) : 0;
  const principalPct = 100 - interestPct;

  return (
    <div className="bg-white sm:rounded-2xl sm:border border-slate-200 p-5 sm:p-7 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
          <Calculator size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Tính toán vay mua nhà</h2>
          <p className="text-xs text-slate-500">Ước tính chi phí trả góp hàng tháng</p>
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-5">
        {/* Down Payment */}
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">Trả trước</label>
            <span className="text-sm font-bold text-blue-600">{downPaymentPct}% — {formatMoney(calc.downPayment)}</span>
          </div>
          <input type="range" min={10} max={90} step={5} value={downPaymentPct}
            onChange={e => setDownPaymentPct(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
          <div className="flex justify-between text-[11px] text-slate-400 mt-1"><span>10%</span><span>50%</span><span>90%</span></div>
        </div>

        {/* Loan Term */}
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">Kỳ hạn vay</label>
            <span className="text-sm font-bold text-blue-600">{loanYears} năm</span>
          </div>
          <input type="range" min={5} max={30} step={5} value={loanYears}
            onChange={e => setLoanYears(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
          <div className="flex justify-between text-[11px] text-slate-400 mt-1"><span>5 năm</span><span>15 năm</span><span>30 năm</span></div>
        </div>

        {/* Interest Rate */}
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">Lãi suất /năm</label>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={20} step={0.5} value={interestRate}
                onChange={e => setInterestRate(Number(e.target.value))}
                className="w-16 text-right text-sm font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1" />
              <span className="text-sm text-slate-500">%</span>
            </div>
          </div>
          <input type="range" min={3} max={15} step={0.5} value={interestRate}
            onChange={e => setInterestRate(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
          <div className="flex justify-between text-[11px] text-slate-400 mt-1"><span>3%</span><span>8%</span><span>15%</span></div>
        </div>
      </div>

      {/* Results */}
      <div className="mt-6 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
        <div className="text-center mb-4">
          <div className="text-sm text-slate-600 mb-1">Trả hàng tháng</div>
          <div className="text-3xl font-extrabold text-blue-700">{formatMoney(calc.monthlyPayment)}</div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-white/70 rounded-lg p-3">
            <DollarSign size={16} className="mx-auto text-emerald-500 mb-1" />
            <div className="text-[11px] text-slate-500">Số tiền vay</div>
            <div className="text-sm font-bold text-slate-800">{formatMoney(calc.loanAmount)}</div>
          </div>
          <div className="bg-white/70 rounded-lg p-3">
            <TrendingDown size={16} className="mx-auto text-amber-500 mb-1" />
            <div className="text-[11px] text-slate-500">Tổng lãi</div>
            <div className="text-sm font-bold text-amber-700">{formatMoney(calc.totalInterest)}</div>
          </div>
          <div className="bg-white/70 rounded-lg p-3">
            <Calendar size={16} className="mx-auto text-indigo-500 mb-1" />
            <div className="text-[11px] text-slate-500">Tổng trả</div>
            <div className="text-sm font-bold text-slate-800">{formatMoney(calc.totalPayment)}</div>
          </div>
        </div>

        {/* Principal vs Interest bar */}
        <div className="mt-4">
          <div className="flex h-3 rounded-full overflow-hidden">
            <div className="bg-blue-500 transition-all" style={{ width: `${principalPct}%` }} />
            <div className="bg-amber-400 transition-all" style={{ width: `${interestPct}%` }} />
          </div>
          <div className="flex justify-between text-[11px] mt-1.5">
            <span className="text-blue-600 font-medium">● Gốc {principalPct.toFixed(0)}%</span>
            <span className="text-amber-600 font-medium">● Lãi {interestPct.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Amortization Schedule Toggle */}
      <button
        onClick={() => setShowSchedule(v => !v)}
        className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-slate-50 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition-colors border border-slate-200"
      >
        {showSchedule ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        {showSchedule ? 'Ẩn lịch trả nợ' : 'Xem lịch trả nợ theo năm'}
      </button>

      {showSchedule && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs">
                <th className="py-2 px-3 text-left rounded-tl-lg">Năm</th>
                <th className="py-2 px-3 text-right">Gốc</th>
                <th className="py-2 px-3 text-right">Lãi</th>
                <th className="py-2 px-3 text-right rounded-tr-lg">Còn nợ</th>
              </tr>
            </thead>
            <tbody>
              {calc.schedule.map(row => (
                <tr key={row.year} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 px-3 font-medium text-slate-800">{row.year}</td>
                  <td className="py-2 px-3 text-right text-blue-700">{formatMoney(row.principal)}</td>
                  <td className="py-2 px-3 text-right text-amber-600">{formatMoney(row.interest)}</td>
                  <td className="py-2 px-3 text-right text-slate-600">{formatMoney(row.remaining)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
