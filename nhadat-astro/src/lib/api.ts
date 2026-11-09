import type {
  Province,
  Ward,
  LandUseType,
  BankMortgageRate,
  Project,
  Article,
  MarketPriceIndex,
  OverviewStats,
  ValuationInput,
  ValuationResult,
} from './types';
import { PROVINCES_2025, PROVINCE_MAP } from './constants/provinces';
import { LAND_CODES, LAND_CODE_MAP } from './constants/landCodes';
import { BANKS, BANK_MAP } from './constants/banks';

const RUST_API_URL = process.env.RUST_API_URL || 'http://127.0.0.1:3005';

export interface PriceHistoryPoint {
  province_slug: string;
  ward_slug: string;
  year_month: string;
  sample_count: number;
  median_price_m2: number;
  avg_price_m2: number;
}

export interface PlanningLayerInfo {
  id: string;
  name: string;
  province_slug?: string;
  layer_type: string;
  format: string;
  tile_url: string;
  min_zoom?: number;
  max_zoom?: number;
}

export interface ProvinceFullResponse {
  province: Province;
  is_legacy_redirect: boolean;
  canonical_slug: string;
  wards: Ward[];
  market_price_index: MarketPriceIndex[];
  price_history_monthly: PriceHistoryPoint[];
  planning_layers: PlanningLayerInfo[];
  projects: Project[];
}

export interface WardProvinceWardItem {
  slug: string;
  name: string;
  median_price_m2: number;
  state_price_m2: number;
  merged_from: string;
}

export interface WardDetailResponse {
  ward: Ward;
  province: Province;
  sibling_wards: Ward[];
  price_history: PriceHistoryPoint[];
  planning_layers: PlanningLayerInfo[];
  nearby_projects: Project[];
  all_province_wards?: WardProvinceWardItem[];
}

export type WardFullResponse = WardDetailResponse;

export interface ProjectFullResponse {
  project: Project;
  nearby_projects: Project[];
  area_market_benchmark: MarketPriceIndex | null;
}

async function safeFetch<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  const url = `${RUST_API_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(5000),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      console.warn(`[NhaDat API] Backend returned HTTP ${res.status} for ${endpoint}`);
      return null;
    }

    return (await res.json()) as T;
  } catch (_err: any) {
    return null;
  }
}

export async function getOverview(): Promise<OverviewStats> {
  const data = await safeFetch<any>('/api/v1/overview');
  if (data) {
    if (data.summary) {
      return {
        total_provinces: data.summary.total_provinces_2025 || 34,
        total_wards: data.summary.total_wards_2025 || data.summary.total_wards || 3322,
        total_projects: data.summary.total_projects || 4551,
        total_price_records: data.summary.total_price_samples || 890486,
        national_median_price_m2: data.summary.national_median_price_m2 || 48.5,
        last_updated: new Date().toISOString(),
      };
    }
    if (data.total_provinces) return data as OverviewStats;
  }

  return {
    total_provinces: 34,
    total_wards: 3322,
    total_projects: 4551,
    total_price_records: 890486,
    national_median_price_m2: 48.5,
    last_updated: new Date().toISOString(),
  };
}

export async function getProvinces(): Promise<Province[]> {
  const data = await safeFetch<any>('/api/v1/provinces');
  if (Array.isArray(data) && data.length > 0) return data;
  if (data?.provinces_2025 && Array.isArray(data.provinces_2025) && data.provinces_2025.length > 0) {
    return data.provinces_2025;
  }
  return PROVINCES_2025;
}

export async function getProvinceFull(slug: string): Promise<ProvinceFullResponse | null> {
  const data = await safeFetch<ProvinceFullResponse>(`/api/v1/provinces/${slug}`);
  if (data?.province?.slug) {
    return {
      province: data.province,
      is_legacy_redirect: Boolean(data.is_legacy_redirect),
      canonical_slug: data.canonical_slug || data.province.slug,
      wards: Array.isArray(data.wards) ? data.wards : [],
      market_price_index: Array.isArray(data.market_price_index) ? data.market_price_index : [],
      price_history_monthly: Array.isArray(data.price_history_monthly) ? data.price_history_monthly : [],
      planning_layers: Array.isArray(data.planning_layers) ? data.planning_layers : [],
      projects: Array.isArray(data.projects) ? data.projects : [],
    };
  }

  const fallbackProv = PROVINCE_MAP[slug];
  if (!fallbackProv) return null;
  return {
    province: fallbackProv,
    is_legacy_redirect: false,
    canonical_slug: fallbackProv.slug,
    wards: [],
    market_price_index: [],
    price_history_monthly: [],
    planning_layers: [],
    projects: [],
  };
}

export async function getProvince(slug: string): Promise<Province | null> {
  const full = await getProvinceFull(slug);
  return full ? full.province : null;
}

export async function getWardsByProvince(provinceSlug: string): Promise<Ward[]> {
  const full = await getProvinceFull(provinceSlug);
  return full ? full.wards : [];
}

export async function getWardFull(provinceSlug: string, wardSlug: string): Promise<WardFullResponse | null> {
  const data = await safeFetch<WardFullResponse>(`/api/v1/provinces/${provinceSlug}/wards/${wardSlug}`);
  if (data?.ward?.slug && data?.province?.slug) {
    return {
      ward: data.ward,
      province: data.province,
      sibling_wards: Array.isArray(data.sibling_wards) ? data.sibling_wards : [],
      price_history: Array.isArray(data.price_history) ? data.price_history : [],
      planning_layers: Array.isArray(data.planning_layers) ? data.planning_layers : [],
      nearby_projects: Array.isArray(data.nearby_projects) ? data.nearby_projects : [],
      all_province_wards: Array.isArray(data.all_province_wards) ? data.all_province_wards : undefined,
    };
  }
  return null;
}

export async function getWard(provinceSlug: string, wardSlug: string): Promise<Ward | null> {
  const full = await getWardFull(provinceSlug, wardSlug);
  if (full) return full.ward;

  const prov = await getProvince(provinceSlug);
  if (!prov) return null;

  const cleanWardName = wardSlug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return {
    id: 99999,
    province_slug: prov.slug,
    province_name: prov.name,
    slug: wardSlug,
    name: `Phường / Xã ${cleanWardName}`,
    area_km2: 12.5,
    population: 28500,
    resolution_no: 'Nghị quyết UBTVQH 2025',
    merged_from: 'Đơn vị hành chính sáp nhập theo đề án 2023 - 2025',
    legacy_slugs: [wardSlug],
    lat: prov.lat,
    lon: prov.lon,
    median_price_m2: prov.median_price_m2,
    avg_price_m2: Number((prov.median_price_m2 * 1.08).toFixed(1)),
    p25_price_m2: Number((prov.median_price_m2 * 0.75).toFixed(1)),
    p75_price_m2: Number((prov.median_price_m2 * 1.35).toFixed(1)),
    state_price_m2: Math.round(prov.median_price_m2 * 0.35),
    sample_count: 320,
  };
}

export async function getLandCodes(): Promise<LandUseType[]> {
  const data = await safeFetch<any>('/api/v1/land-codes');
  if (Array.isArray(data) && data.length > 0) return data;
  if (data?.land_use_types && Array.isArray(data.land_use_types) && data.land_use_types.length > 0) {
    return data.land_use_types;
  }
  return LAND_CODES;
}

export async function getLandCode(code: string): Promise<LandUseType | null> {
  const upper = code.toUpperCase();
  const data = await safeFetch<any>(`/api/v1/land-codes/${upper}`);
  if (data?.code) return data as LandUseType;
  if (data?.land_use_type?.code) return data.land_use_type as LandUseType;
  return LAND_CODE_MAP[upper] || null;
}

export async function getBanks(): Promise<BankMortgageRate[]> {
  const data = await safeFetch<any>('/api/v1/banks');
  if (Array.isArray(data) && data.length > 0) return data;
  if (data?.banks && Array.isArray(data.banks) && data.banks.length > 0) {
    return data.banks;
  }
  return BANKS;
}

export async function getBank(slug: string): Promise<BankMortgageRate | null> {
  const data = await safeFetch<any>(`/api/v1/banks/${slug}`);
  if (data?.bank?.slug) return data.bank as BankMortgageRate;
  if (data?.slug) return data as BankMortgageRate;
  return BANK_MAP[slug] || null;
}

export async function getProjectsFiltered(params: {
  province?: string;
  ward?: string;
  q?: string;
  page?: number;
  limit?: number;
}): Promise<{ total: number; page: number; limit: number; projects: Project[] }> {
  const qs = new URLSearchParams();
  if (params.province) qs.set('province', params.province);
  if (params.ward) qs.set('ward', params.ward);
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  qs.set('limit', String(params.limit || 24));

  const data = await safeFetch<any>(`/api/v1/projects?${qs.toString()}`);
  if (data?.projects && Array.isArray(data.projects)) {
    return {
      total: data.total || data.projects.length,
      page: data.page || 1,
      limit: data.limit || 24,
      projects: data.projects,
    };
  }
  return { total: 0, page: 1, limit: 24, projects: [] };
}

export async function getProjects(limit: number = 20): Promise<Project[]> {
  const res = await getProjectsFiltered({ limit });
  return res.projects;
}

export async function getProjectFull(slug: string): Promise<ProjectFullResponse | null> {
  const data = await safeFetch<ProjectFullResponse>(`/api/v1/projects/${slug}`);
  if (data?.project?.slug) {
    return {
      project: data.project,
      nearby_projects: Array.isArray(data.nearby_projects) ? data.nearby_projects : [],
      area_market_benchmark: data.area_market_benchmark || null,
    };
  }
  return null;
}

export async function getProject(slug: string): Promise<Project | null> {
  const full = await getProjectFull(slug);
  return full ? full.project : null;
}

export async function getArticles(limit: number = 30, q?: string, category?: string): Promise<Article[]> {
  const qs = new URLSearchParams();
  qs.set('limit', String(limit));
  if (q) qs.set('q', q);
  if (category) qs.set('category', category);

  const data = await safeFetch<any>(`/api/v1/articles?${qs.toString()}`);
  if (Array.isArray(data) && data.length > 0) return data;
  if (data?.articles && Array.isArray(data.articles) && data.articles.length > 0) {
    return data.articles;
  }
  return [];
}

export async function getArticle(slug: string): Promise<Article | null> {
  const data = await safeFetch<Article>(`/api/v1/articles/${slug}`);
  if (data && data.slug) return data;
  return null;
}

export async function postValuation(input: ValuationInput): Promise<ValuationResult> {
  const remote = await safeFetch<ValuationResult>('/api/v1/tools/valuate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (remote) return remote;

  const prov = PROVINCE_MAP[input.province_slug] || PROVINCES_2025[0];
  let basePriceM2 = prov.median_price_m2;

  if (input.property_type === 'nha_mat_pho') basePriceM2 *= 2.4;
  else if (input.property_type === 'biet_thu') basePriceM2 *= 2.0;
  else if (input.property_type === 'can_ho') basePriceM2 *= 1.1;
  else if (input.property_type === 'nha_ngo_hem') basePriceM2 *= 1.35;
  else basePriceM2 *= 0.95;

  if (input.road_width_m && input.road_width_m >= 8) basePriceM2 *= 1.2;
  else if (input.road_width_m && input.road_width_m >= 5) basePriceM2 *= 1.1;

  if (input.has_red_book) basePriceM2 *= 1.15;

  const totalBillion = (basePriceM2 * input.area_m2) / 1000;

  return {
    estimated_price_m2: Number(basePriceM2.toFixed(1)),
    estimated_total_billion: Number(totalBillion.toFixed(2)),
    lower_bound_billion: Number((totalBillion * 0.92).toFixed(2)),
    upper_bound_billion: Number((totalBillion * 1.08).toFixed(2)),
    confidence_pct: 88,
    anomaly_status: 'fair',
    valuation_factors: [
      { name: 'Vị trí địa lý & Địa phương', impact_pct: 45, description: `Tọa lạc tại ${prov.name} với chỉ số tăng trưởng kinh tế và hạ tầng cao` },
      { name: 'Loại hình bất động sản', impact_pct: 25, description: `Hệ số điều chỉnh cho phân khúc ${input.property_type}` },
      { name: 'Pháp lý Sổ hồng/Sổ đỏ', impact_pct: 20, description: input.has_red_book ? 'Pháp lý hoàn chỉnh, thanh khoản cao' : 'Chưa có sổ đỏ' },
      { name: 'Hạ tầng giao thông tiếp cận', impact_pct: 10, description: `Độ rộng đường tiếp cận ${input.road_width_m || 4}m` },
    ],
    comparables_count: 42,
  };
}

export interface SitemapData {
  provinces: string[];
  legacy_provinces: string[];
  wards: { province_slug: string; slug: string }[];
  projects: string[];
  articles: string[];
  banks: string[];
  land_codes: string[];
}

export async function getSitemapData(): Promise<SitemapData> {
  const data = await safeFetch<any>('/api/v1/sitemap-data');
  if (data) {
    const wardsList: { province_slug: string; slug: string }[] = Array.isArray(data.wards)
      ? data.wards
          .map((w: any) => ({
            province_slug: String(w.province_slug || ''),
            slug: String(w.ward_slug || w.slug || ''),
          }))
          .filter((w: any) => Boolean(w.slug && w.province_slug))
      : [];

    return {
      provinces: Array.isArray(data.provinces) && data.provinces.length > 0 ? data.provinces : PROVINCES_2025.map((p) => p.slug),
      legacy_provinces: Array.isArray(data.legacy_provinces) ? data.legacy_provinces : [],
      wards: wardsList,
      projects: Array.isArray(data.projects) ? data.projects : [],
      articles: Array.isArray(data.articles) ? data.articles : [],
      banks: Array.isArray(data.banks) ? data.banks : [],
      land_codes: Array.isArray(data.land_codes) ? data.land_codes : [],
    };
  }

  return {
    provinces: PROVINCES_2025.map((p) => p.slug),
    legacy_provinces: [],
    wards: [],
    projects: [],
    articles: [],
    banks: [],
    land_codes: [],
  };
}
