import type { TaxFeeResult } from '../types';

/**
 * Notary fee calculation per Circular 257/2016/TT-BTC
 */
export function calculateNotaryFee(value: number): number {
  if (value <= 50_000_000) return 50_000;
  if (value <= 100_000_000) return 100_000;
  if (value <= 1_000_000_000) return Math.round(value * 0.001);
  if (value <= 3_000_000_000) return Math.round(1_000_000 + (value - 1_000_000_000) * 0.0006);
  if (value <= 5_000_000_000) return Math.round(2_200_000 + (value - 3_000_000_000) * 0.0005);
  if (value <= 10_000_000_000) return Math.round(3_200_000 + (value - 5_000_000_000) * 0.0004);
  const feeOver10B = 5_200_000 + (value - 10_000_000_000) * 0.0003;
  return Math.round(Math.min(feeOver10B, 70_000_000));
}

/**
 * Calculate all taxes and fees for real estate title transfer (Sang tên Sổ đỏ)
 */
export function calculateTaxFee(
  propertyValue: number,
  isFirstHome: boolean = false,
  isFamilyTransfer: boolean = false,
  conversionAreaM2: number = 0,
  conversionPriceDiffM2: number = 0
): TaxFeeResult {
  // 1. Personal income tax: 2% of transaction price (Exempt if family transfer or only house sold)
  const pit = isFamilyTransfer ? 0 : Math.round(propertyValue * 0.02);

  // 2. Registration fee (Lệ phí trước bạ): 0.5% (Max 500 million VND per property)
  const registrationFee = isFamilyTransfer
    ? 0
    : Math.min(Math.round(propertyValue * 0.005), 500_000_000);

  // 3. Notary fee per Circular 257/2016
  const notaryFee = calculateNotaryFee(propertyValue);

  // 4. Cadastral appraisal fee (Phí thẩm định hồ sơ cấp sổ): usually 0.15% capped at 5 million
  const cadastralFee = Math.min(Math.max(500_000, Math.round(propertyValue * 0.0015)), 5_000_000);

  // 5. Land conversion fee (CLN/ONT lên ODT nếu có): (Giá ODT - Giá CLN) * Diện tích
  const conversionFee = Math.round(conversionAreaM2 * conversionPriceDiffM2);

  const totalFee = pit + registrationFee + notaryFee + cadastralFee + conversionFee;

  return {
    property_value: propertyValue,
    personal_income_tax: pit,
    registration_fee: registrationFee,
    notary_fee: notaryFee,
    cadastral_appraisal_fee: cadastralFee,
    land_use_conversion_fee: conversionFee,
    total_fee: totalFee,
  };
}
