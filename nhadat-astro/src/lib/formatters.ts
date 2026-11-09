/**
 * High-precision Vietnamese typography and financial formatters
 */

export function formatNumber(num: number, decimals: number = 0): string {
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(num);
}

export function formatVND(amount: number, compact: boolean = false): string {
  if (isNaN(amount) || amount === 0) return '0 đ';

  if (compact) {
    if (amount >= 1_000_000_000) {
      const billions = amount / 1_000_000_000;
      return `${formatNumber(billions, billions >= 10 ? 1 : 2)} tỷ`;
    }
    if (amount >= 1_000_000) {
      const millions = amount / 1_000_000;
      return `${formatNumber(millions, millions >= 10 ? 0 : 1)} triệu`;
    }
  }

  return `${new Intl.NumberFormat('vi-VN').format(Math.round(amount))} đ`;
}

export function formatPricePerM2(millionPerM2: number): string {
  if (isNaN(millionPerM2) || millionPerM2 === 0) return 'Đang cập nhật';
  return `${formatNumber(millionPerM2, 1)} tr/m²`;
}

export function formatArea(areaM2: number): string {
  if (isNaN(areaM2) || areaM2 === 0) return '0 m²';
  return `${formatNumber(areaM2, 1)} m²`;
}

export function formatPercent(pct: number): string {
  if (isNaN(pct)) return '0%';
  return `${formatNumber(pct, 2)}%`;
}

export function formatDateVi(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}
