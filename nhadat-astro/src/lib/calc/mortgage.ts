import type { MortgageResult, MortgageScheduleItem } from '../types';

export function calculateMortgage(
  loanAmount: number,
  termMonths: number,
  annualInterestRatePct: number,
  method: 'decreasing' | 'annuity' = 'decreasing'
): MortgageResult {
  const monthlyRate = annualInterestRatePct / 100 / 12;
  const schedule: MortgageScheduleItem[] = [];
  let remainingBalance = loanAmount;
  let totalInterest = 0;

  if (method === 'decreasing') {
    const monthlyPrincipal = loanAmount / termMonths;
    for (let month = 1; month <= termMonths; month++) {
      const interest = remainingBalance * monthlyRate;
      const totalPayment = monthlyPrincipal + interest;
      remainingBalance = Math.max(0, remainingBalance - monthlyPrincipal);
      totalInterest += interest;

      schedule.push({
        month,
        principal_paid: Math.round(monthlyPrincipal),
        interest_paid: Math.round(interest),
        total_payment: Math.round(totalPayment),
        remaining_balance: Math.round(remainingBalance),
      });
    }
  } else {
    // Annuity method
    const monthlyPayment =
      (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths))) /
      (Math.pow(1 + monthlyRate, termMonths) - 1);

    for (let month = 1; month <= termMonths; month++) {
      const interest = remainingBalance * monthlyRate;
      const principal = monthlyPayment - interest;
      remainingBalance = Math.max(0, remainingBalance - principal);
      totalInterest += interest;

      schedule.push({
        month,
        principal_paid: Math.round(principal),
        interest_paid: Math.round(interest),
        total_payment: Math.round(monthlyPayment),
        remaining_balance: Math.round(remainingBalance),
      });
    }
  }

  const firstMonthPayment = schedule.length > 0 ? schedule[0].total_payment : 0;

  return {
    loan_amount: loanAmount,
    term_months: termMonths,
    interest_rate_pct: annualInterestRatePct,
    first_month_payment: firstMonthPayment,
    total_interest: Math.round(totalInterest),
    total_payment: Math.round(loanAmount + totalInterest),
    schedule,
  };
}
