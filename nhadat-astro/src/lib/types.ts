/**
 * NhaDat.City SSOT TypeScript Interfaces
 * Synchronized with PostgreSQL / PostGIS and Rust Axum Core Backend
 */

export interface Province {
  id: number;
  slug: string;
  name: string;
  ma_tinh?: string;
  ma_tinh_bnv?: string;
  area_km2: number;
  population: number;
  merged_from?: string;
  admin_center?: string;
  legacy_slugs: string[];
  central_meridian: number;
  lat: number;
  lon: number;
  ward_count: number;
  project_count: number;
  median_price_m2: number;
  sample_count: number;
}

export interface LegacyProvince {
  slug: string;
  name: string;
  new_province_slug: string;
  central_meridian: number;
  epsg_3deg: number;
  epsg_6deg: number;
  region: string;
  lat: number;
  lon: number;
}

export interface Ward {
  id: number;
  province_slug: string;
  province_name: string;
  slug: string;
  name: string;
  ma_xa?: string;
  ma_xa_bnv?: string;
  area_km2: number;
  population: number;
  resolution_no?: string;
  merged_from?: string;
  legacy_slugs: string[];
  lat: number;
  lon: number;
  median_price_m2: number;
  avg_price_m2: number;
  p25_price_m2: number;
  p75_price_m2: number;
  state_price_m2: number;
  sample_count: number;
}

export interface LandUseType {
  code: string;
  name: string;
  group_name: string;
  color_hex: string;
  is_residential: boolean;
  max_term_text: string;
  legal_summary: string;
  buildable_guide: string;
  conversion_fee_rule: string;
}

export interface BankMortgageRate {
  slug: string;
  bank_name: string;
  short_name: string;
  bank_group: 'Big4' | 'TMCP' | 'Foreign';
  promo_rate_6m: number;
  promo_rate_12m: number;
  promo_rate_24m: number;
  floating_rate: number;
  max_ltv_pct: number;
  max_term_years: number;
  early_repayment_fee: string;
  grace_period_months: number;
  notes: string;
}

export interface Project {
  id: number;
  slug: string;
  short_id?: string;
  title: string;
  trade_name?: string;
  province_slug: string;
  ward_slug?: string;
  address?: string;
  street_name?: string;
  investor_name?: string;
  investor_description?: string;
  project_type?: string;
  total_apartments?: string;
  total_buildings?: string;
  total_floors?: string;
  total_area_text?: string;
  building_density?: string;
  ownership?: string;
  status?: string;
  banner_url?: string;
  utilities_summary?: string;
  location_summary?: string;
  legal_summary?: string;
  ref_price_m2: number;
  lat: number;
  lon: number;
}

export interface Article {
  id: number;
  slug: string;
  title: string;
  category: string;
  summary: string;
  content_html: string;
  faqs: { q: string; a: string }[];
  tags: string[];
  word_count: number;
  published_at: string;
  updated_at?: string;
}

export interface MarketPriceIndex {
  province_slug: string;
  ward_slug: string;
  property_type: string;
  sample_count: number;
  median_price_m2: number;
  avg_price_m2: number;
  p25_price_m2: number;
  p75_price_m2: number;
  min_price_m2: number;
  max_price_m2: number;
  avg_total_price_billion: number;
  avg_area_m2: number;
  state_price_m2: number;
  yoy_change_pct: number;
}

export interface PriceHistoryPoint {
  year_month: string;
  median_price_m2: number;
  avg_price_m2: number;
  sample_count: number;
}

export interface OverviewStats {
  total_provinces: number;
  total_wards: number;
  total_projects: number;
  total_price_records: number;
  national_median_price_m2: number;
  last_updated: string;
}

// Tool calculation types
export interface Vn2000Point {
  x: number; // Northing (X) in VN
  y: number; // Easting (Y) in VN
}

export interface Wgs84Point {
  lat: number;
  lon: number;
}

export interface Vn2000Result {
  points: { vn2000: Vn2000Point; wgs84: Wgs84Point }[];
  polygon_area_m2?: number;
  polygon_perimeter_m?: number;
  geojson?: any;
}

export interface ValuationInput {
  province_slug: string;
  ward_slug?: string;
  property_type: 'nha_mat_pho' | 'nha_ngo_hem' | 'can_ho' | 'dat_nen' | 'biet_thu';
  area_m2: number;
  facade_width_m?: number;
  road_width_m?: number;
  floors?: number;
  has_red_book?: boolean;
}

export interface ValuationResult {
  estimated_price_m2: number;
  estimated_total_billion: number;
  lower_bound_billion: number;
  upper_bound_billion: number;
  confidence_pct: number;
  anomaly_status: 'fair' | 'undervalued' | 'overvalued';
  valuation_factors: { name: string; impact_pct: number; description: string }[];
  comparables_count: number;
}

export interface MortgageScheduleItem {
  month: number;
  principal_paid: number;
  interest_paid: number;
  total_payment: number;
  remaining_balance: number;
}

export interface MortgageResult {
  loan_amount: number;
  term_months: number;
  interest_rate_pct: number;
  first_month_payment: number;
  total_interest: number;
  total_payment: number;
  schedule: MortgageScheduleItem[];
}

export interface TaxFeeResult {
  property_value: number;
  personal_income_tax: number; // 2%
  registration_fee: number; // 0.5%
  notary_fee: number; // Tiered circular 257/2016
  cadastral_appraisal_fee: number;
  land_use_conversion_fee: number;
  total_fee: number;
}

export interface FengShuiResult {
  birth_year: number;
  gender: 'nam' | 'nu';
  lunar_year_name: string;
  can_chi: string;
  quai_so: number;
  cung_phi: string;
  group: 'Đông Tứ Mệnh' | 'Tây Tứ Mệnh';
  favorable_directions: { direction: string; star: string; score: number; meaning: string }[];
  unfavorable_directions: { direction: string; star: string; severity: string; warning: string }[];
  recommended_door_color: string;
  element: string;
}

export interface RentalYieldResult {
  property_purchase_price: number;
  monthly_rent: number;
  occupancy_rate_pct: number;
  annual_operating_costs: number;
  renovation_cost: number;
  gross_rental_yield_pct: number;
  net_rental_yield_pct: number;
  net_cap_rate_pct: number;
  cash_on_cash_roi_pct: number;
  payback_period_years: number;
}
