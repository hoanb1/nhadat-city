import proj4 from 'proj4';

// ── 63 Provinces VN2000 3-degree Central Meridians (Kinh tuyến trục) ─────
export const PROVINCE_CENTRAL_MERIDIANS: Record<string, number> = {
  // Miền Bắc
  'ha_noi': 105.0,
  'hanoi': 105.0,
  'ha noi': 105.0,
  'ha_nam': 105.5,
  'ha nam': 105.5,
  'hai_duong': 105.5,
  'hai duong': 105.5,
  'hai_phong': 105.75,
  'hai phong': 105.75,
  'hung_yen': 105.5,
  'hung yen': 105.5,
  'nam_dinh': 106.0,
  'nam dinh': 106.0,
  'ninh_binh': 105.75,
  'ninh binh': 105.75,
  'thai_binh': 106.5,
  'thai binh': 106.5,
  'vinh_phuc': 105.0,
  'vinh phuc': 105.0,
  'bac_giang': 107.0,
  'bac giang': 107.0,
  'bac_kan': 105.75,
  'bac kan': 105.75,
  'cao_bang': 105.75,
  'cao bang': 105.75,
  'ha_giang': 105.0,
  'ha giang': 105.0,
  'lang_son': 107.25,
  'lang son': 107.25,
  'phu_tho': 104.75,
  'phu tho': 104.75,
  'quang_ninh': 107.75,
  'quang ninh': 107.75,
  'thai_nguyen': 105.75,
  'thai nguyen': 105.75,
  'tuyen_quang': 105.0,
  'tuyen quang': 105.0,
  'yen_bai': 104.75,
  'yen bai': 104.75,
  'dien_bien': 103.0,
  'dien bien': 103.0,
  'hoa_binh': 105.0,
  'hoa binh': 105.0,
  'lai_chau': 103.0,
  'lai chau': 103.0,
  'lao_cai': 104.0,
  'lao cai': 104.0,
  'son_la': 104.0,
  'son la': 104.0,
  'bac_ninh': 105.5,
  'bac ninh': 105.5,

  // Miền Trung & Tây Nguyên
  'thanh_hoa': 105.0,
  'thanh hoa': 105.0,
  'nghe_an': 104.75,
  'nghe an': 104.75,
  'ha_tinh': 105.5,
  'ha tinh': 105.5,
  'quang_binh': 106.0,
  'quang binh': 106.0,
  'quang_tri': 106.25,
  'quang tri': 106.25,
  'thua_thien_hue': 107.0,
  'thua thien hue': 107.0,
  'hue': 107.0,
  'da_nang': 107.75,
  'da nang': 107.75,
  'quang_nam': 107.75,
  'quang nam': 107.75,
  'quang_ngai': 108.5,
  'quang ngai': 108.5,
  'binh_dinh': 108.25,
  'binh dinh': 108.25,
  'phu_yen': 108.5,
  'phu yen': 108.5,
  'khanh_hoa': 108.25,
  'khanh hoa': 108.25,
  'ninh_thuan': 108.75,
  'ninh thuan': 108.75,
  'binh_thuan': 108.5,
  'binh thuan': 108.5,
  'kon_tum': 107.5,
  'kon tum': 107.5,
  'gia_lai': 108.5,
  'gia lai': 108.5,
  'dak_lak': 108.5,
  'dak lak': 108.5,
  'dac_lac': 108.5,
  'dak_nong': 108.5,
  'dak nong': 108.5,
  'lam_dong': 107.75,
  'lam dong': 107.75,

  // Miền Nam
  'tp_ho_chi_minh': 105.75,
  'ho_chi_minh': 105.75,
  'hcm': 105.75,
  'tphcm': 105.75,
  'sai_gon': 105.75,
  'ba_ria_vung_tau': 107.5,
  'vung_tau': 107.5,
  'binh_duong': 105.75,
  'binh duong': 105.75,
  'binh_phuoc': 106.25,
  'binh phuoc': 106.25,
  'dong_nai': 107.75,
  'dong nai': 107.75,
  'tay_ninh': 105.5,
  'tay ninh': 105.5,
  'an_giang': 104.5,
  'an giang': 104.5,
  'bac_lieu': 105.0,
  'bac lieu': 105.0,
  'ben_tre': 105.75,
  'ben tre': 105.75,
  'ca_mau': 104.5,
  'ca mau': 104.5,
  'can_tho': 105.5,
  'can tho': 105.5,
  'dong_thap': 105.0,
  'dong thap': 105.0,
  'hau_giang': 105.5,
  'hau giang': 105.5,
  'kien_giang': 104.5,
  'kien giang': 104.5,
  'long_an': 105.75,
  'long an': 105.75,
  'soc_trang': 105.3,
  'soc trang': 105.3,
  'tien_giang': 105.75,
  'tien giang': 105.75,
  'tra_vinh': 105.5,
  'tra vinh': 105.5,
  'vinh_long': 105.5,
  'vinh long': 105.5,
};

/**
 * Get VN2000 Proj4 definition string for a given central meridian.
 */
export function getVN2000Proj4Def(centralMeridian: number): string {
  return `+proj=tmerc +lat_0=0 +lon_0=${centralMeridian} +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-191.9044,-39.3032,-111.4503,-0.00928836,0.00975456,-0.01170641,-0.0042736 +units=m +no_defs`;
}

/**
 * Get central meridian for a province string or default to 105.0 (Hanoi) / 105.75 (HCM).
 */
export function resolveCentralMeridian(provinceStr?: string | number): number {
  if (typeof provinceStr === 'number' && !isNaN(provinceStr)) {
    return provinceStr;
  }
  if (!provinceStr) return 105.0; // Default Hanoi/National

  const str = String(provinceStr);
  const normalized = str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .trim();

  for (const [key, cm] of Object.entries(PROVINCE_CENTRAL_MERIDIANS)) {
    if (normalized.includes(key)) {
      return cm;
    }
  }

  return 105.0;
}

export interface PointVN2000 {
  pointId?: string | number;
  x: number; // Northing (usually > 1,000,000 in VN)
  y: number; // Easting (usually ~300,000 - 700,000 in VN)
}

export interface PointWGS84 {
  pointId?: string | number;
  x: number; // original VN2000 X
  y: number; // original VN2000 Y
  lat: number;
  lng: number;
}

export interface ParsedVN2000Result {
  centralMeridian: number;
  points: PointWGS84[];
  centroid: { lat: number; lng: number };
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  geoJsonPolygon: {
    type: 'Polygon';
    coordinates: Array<Array<[number, number]>>;
  };
}

/**
 * Single point VN2000 to WGS84 conversion.
 */
export function vn2000ToWgs84(x: number, y: number, provinceOrMeridian?: string | number): { lat: number; lng: number } {
  // Normalize X and Y: In Vietnam Cadastral system, X is Northing (~1,000,000 to 2,500,000), Y is Easting (~300,000 to 700,000).
  // If X < 1,000,000 and Y > 1,000,000, user/OCR swapped X and Y.
  let northing = x;
  let easting = y;

  if (x < 1000000 && y > 1000000) {
    northing = y;
    easting = x;
  }

  const cm = resolveCentralMeridian(provinceOrMeridian);
  const vn2000Def = getVN2000Proj4Def(cm);
  const wgs84Def = 'EPSG:4326';

  const [lng, lat] = proj4(vn2000Def, wgs84Def, [easting, northing]);

  return { lat, lng };
}

/**
 * Convert a series of VN2000 points (polygon boundary) to WGS84 GeoJSON & centroid.
 */
export function vn2000PolygonToWgs84(
  points: PointVN2000[],
  provinceOrMeridian?: string | number
): ParsedVN2000Result {
  const cm = resolveCentralMeridian(provinceOrMeridian);

  const convertedPoints: PointWGS84[] = points.map(pt => {
    const { lat, lng } = vn2000ToWgs84(pt.x, pt.y, cm);
    return {
      pointId: pt.pointId,
      x: pt.x,
      y: pt.y,
      lat,
      lng,
    };
  });

  // Calculate centroid
  let sumLat = 0;
  let sumLng = 0;
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;

  convertedPoints.forEach(p => {
    sumLat += p.lat;
    sumLng += p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  });

  const count = convertedPoints.length || 1;
  const centroid = {
    lat: Number((sumLat / count).toFixed(6)),
    lng: Number((sumLng / count).toFixed(6)),
  };

  // Build closed ring coordinates for GeoJSON [lng, lat]
  const ringCoordinates: Array<[number, number]> = convertedPoints.map(p => [
    Number(p.lng.toFixed(6)),
    Number(p.lat.toFixed(6)),
  ]);

  if (ringCoordinates.length > 0) {
    const first = ringCoordinates[0];
    const last = ringCoordinates[ringCoordinates.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ringCoordinates.push([first[0], first[1]]);
    }
  }

  return {
    centralMeridian: cm,
    points: convertedPoints,
    centroid,
    bbox: [minLng, minLat, maxLng, maxLat],
    geoJsonPolygon: {
      type: 'Polygon',
      coordinates: [ringCoordinates],
    },
  };
}
