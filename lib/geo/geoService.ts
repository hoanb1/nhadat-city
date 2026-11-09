import {
  fetchGeoFeatureCollection,
  findDistrictBySlugs,
  findProvince,
  findWard,
  listWardNamesByProvince,
} from '@/lib/db/repo/publicGeo';

/**
 * Fetch geo features (GeoJSON) for province/ward
 * Replaces Meteor method `fetchGeoFeatures`
 */
export async function fetchGeoFeatures(province: string, ward?: string) {
  // Parity with the Mongo era: the legacy `geoFeatures` collection does not exist in prod Mongo (verified with
  // listCollections), so the old implementation always found 0 docs and returned null. Keep that contract
  // (callers fall back to centroid/bbox). To serve real polygons instead, return fetchGeoFeatureCollection(province, ward).
  void province; void ward;
  return null as Awaited<ReturnType<typeof fetchGeoFeatureCollection>>;
}

/**
 * Get province info by codename.
 * Supports both current CodeName and legacy slugs (pre-2025 merger) via oldcodename array.
 * Replaces Meteor `AddressNormalizer.getProvinceInfo`
 */
export async function getProvinceInfo(provinceCode: string) {
  // Current slug first, then legacy slug (pre-2025 merged provinces)
  return findProvince(provinceCode);
}

/**
 * Resolve a province slug to the current (post-2025-merger) CodeName.
 * Returns the same slug if it's already current, or the new CodeName if the slug is a legacy one.
 * Returns null if the slug is unknown.
 */
export async function resolveProvinceSlug(slug: string): Promise<string | null> {
  const p = await findProvince(slug);
  return p ? (p.CodeName as string) : null;
}


/**
 * Get ward info by codename.
 * Supports exact CodeName, stripped prefix (xa-, phuong-, thi-tran-), oldcodename, and district fallbacks.
 */
export async function getWardInfo(wardCode: string, provinceCode?: string) {
  // 1. Clean administrative prefixes (e.g. thanh-pho-vinh -> vinh, xa-quang-lap -> quang-lap)
  const cleanWard = wardCode.replace(/^(thanh-pho|thi-xa|thi-tran|quan|huyen|phuong|xa|tp|tx|tt|q|h|p|x)-/, '');
  const candidateCodes = Array.from(new Set([wardCode, cleanWard]));

  let resolvedProv: string | null = null;
  let provinceSlugs: string[] | undefined;
  if (provinceCode) {
    resolvedProv = await resolveProvinceSlug(provinceCode) || provinceCode;
    provinceSlugs = [provinceCode, resolvedProv];
  }

  const ward = await findWard(candidateCodes, provinceSlugs);
  if (ward) return ward;

  // 2. Fallback to district if user navigated to a district url or item only has district
  const district = await findDistrictBySlugs(candidateCodes, provinceCode && resolvedProv ? provinceSlugs : undefined);
  if (district) {
    return {
      ...district,
      Name: district.Name || district.tenHuyen,
      CodeName: district.CodeName,
      lat: district.lat,
      lon: district.lon
    };
  }

  return null;
}

/**
 * Get district info by codename
 */
export async function getDistrictInfo(districtCode: string) {
  return findDistrictBySlugs([districtCode]);
}

/**
 * Get full admin unit (province + ward)
 */
export async function getAdminUnit(province: string | null, ward: string | null) {
  const result: { province?: any; ward?: any } = {};

  if (province) {
    result.province = await getProvinceInfo(province);
  }
  if (province && ward) {
    result.ward = await getWardInfo(ward, province);
  }

  return Object.keys(result).length ? result : null;
}

/**
 * Get list of wards in a province for SEO navigation grid
 */
export async function getWardsByProvince(provinceCode: string, limit = 60) {
  const resolvedProv = await resolveProvinceSlug(provinceCode) || provinceCode;
  return listWardNamesByProvince([provinceCode, resolvedProv], limit);
}

/**
 * Generate breadcrumb data for a location
 */
export async function getBreadcrumbs(province: string, ward?: string) {
  const breadcrumbs = [{ label: 'Trang chủ', url: '/' }];

  const provinceInfo = await getProvinceInfo(province);
  if (provinceInfo) {
    breadcrumbs.push({
      label: provinceInfo.Name,
      url: `/${province}`,
    });
  }

  if (ward) {
    const wardInfo = await getWardInfo(ward, province);
    if (wardInfo) {
      breadcrumbs.push({
        label: wardInfo.Name,
        url: `/${province}/${ward}`,
      });
    }
  }

  return breadcrumbs;
}

/**
 * Extract geo center from GeoJSON FeatureCollection
 */
export function extractGeoCenter(geojson: any): { latitude: number; longitude: number } {
  try {
    const coords = geojson.features[0].geometry.coordinates[0];
    const lats = coords.map((c: number[]) => c[1]);
    const lngs = coords.map((c: number[]) => c[0]);
    return {
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    };
  } catch {
    return { latitude: 21.0245, longitude: 105.8412 }; // Hà Nội default
  }
}
