import type { RentalYieldResult } from '../types';

export function calculateRentalYield(
  purchasePrice: number,
  monthlyRent: number,
  occupancyRatePct: number = 95,
  annualOperatingCosts: number = 0,
  renovationCost: number = 0
): RentalYieldResult {
  const totalInvestment = purchasePrice + renovationCost;
  const annualGrossRent = monthlyRent * 12 * (occupancyRatePct / 100);
  const annualNetRent = Math.max(0, annualGrossRent - annualOperatingCosts);

  const grossYieldPct = totalInvestment > 0 ? (annualGrossRent / totalInvestment) * 100 : 0;
  const netYieldPct = totalInvestment > 0 ? (annualNetRent / totalInvestment) * 100 : 0;
  const netCapRatePct = purchasePrice > 0 ? (annualNetRent / purchasePrice) * 100 : 0;

  // Payback period
  const paybackYears = annualNetRent > 0 ? totalInvestment / annualNetRent : 0;

  return {
    property_purchase_price: purchasePrice,
    monthly_rent: monthlyRent,
    occupancy_rate_pct: occupancyRatePct,
    annual_operating_costs: annualOperatingCosts,
    renovation_cost: renovationCost,
    gross_rental_yield_pct: Number(grossYieldPct.toFixed(2)),
    net_rental_yield_pct: Number(netYieldPct.toFixed(2)),
    net_cap_rate_pct: Number(netCapRatePct.toFixed(2)),
    cash_on_cash_roi_pct: Number(netYieldPct.toFixed(2)),
    payback_period_years: Number(paybackYears.toFixed(1)),
  };
}
