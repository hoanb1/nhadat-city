/**
 * Shared helper: resolve admin unit (ward/district/province) from coordinates
 * using internal GeoServer WFS layers, then find URL slugs from Postgres.
 */

import { findWardByMaXaBnv } from '@/lib/db/repo/publicGeo';
import { GEOSERVER_URL, GEOSERVER_WORKSPACE } from '@/lib/config/server';

const LAYER_COMMUNES  = `adminunit:communes2025fixed`;
const LAYER_DISTRICTS = `adminunit:districts`;

export interface ParcelAdminUnit {
  wardName: string;
  districtName: string;
  provinceName: string;
  address: string;       // "Phường X, Quận Y, TP Z"
  wardSlug: string;      // e.g. "hoa-cuong-bac"
  provinceSlug: string;  // e.g. "da-nang"
}

/** Query a GeoServer WFS layer at a point, return feature properties or null */
async function queryLayer(layer: string, lng: number, lat: number): Promise<Record<string, any> | null> {
  try {
    const url =
      `${GEOSERVER_URL}/wfs?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature` +
      `&TYPENAME=${encodeURIComponent(layer)}&OUTPUTFORMAT=application/json` +
      `&CQL_FILTER=INTERSECTS(geom,POINT(${lng}%20${lat}))&MAXFEATURES=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.features?.[0]?.properties || null;
  } catch {
    return null;
  }
}

/** Compute centroid [lng, lat] from GeoJSON geometry (Polygon or MultiPolygon) */
export function computeCentroid(geometry: any): [number, number] | null {
  try {
    let coords: number[][] = [];
    if (geometry.type === 'MultiPolygon') {
      coords = geometry.coordinates[0][0];
    } else if (geometry.type === 'Polygon') {
      coords = geometry.coordinates[0];
    }
    if (!coords.length) return null;
    const lngs = coords.map((c: number[]) => c[0]);
    const lats  = coords.map((c: number[]) => c[1]);
    return [
      (Math.min(...lngs) + Math.max(...lngs)) / 2,
      (Math.min(...lats) + Math.max(...lats)) / 2,
    ];
  } catch {
    return null;
  }
}

/**
 * Main lookup: given WGS84 coords, return admin unit names + URL slugs.
 * Returns null if GeoServer is unreachable.
 */
export async function getAdminUnitByCoords(lng: number, lat: number): Promise<ParcelAdminUnit | null> {
  try {
    const [commune, district] = await Promise.all([
      queryLayer(LAYER_COMMUNES, lng, lat),
      queryLayer(LAYER_DISTRICTS, lng, lat),
    ]);

    const wardName     = commune?.tenXa          || '';
    const districtName = district?.level2_name   || commune?.tenHuyen || '';
    const provinceName = commune?.tenTinh        || district?.level1_name || '';
    const maXaBnv      = commune?.maXa_BNV       || '';  // integer-like string e.g. "20257"

    const parts  = [wardName, districtName, provinceName].filter(Boolean);
    const address = parts.join(', ');

    let wardSlug     = '';
    let provinceSlug = '';
    if (maXaBnv) {
      try {
        const wardDoc = await findWardByMaXaBnv(String(maXaBnv));
        if (wardDoc) {
          wardSlug     = wardDoc.CodeName         || '';
          provinceSlug = wardDoc.ProvinceCodeName || '';
        }
      } catch { /* ignore — slugs remain empty */ }
    }

    return { wardName, districtName, provinceName, address, wardSlug, provinceSlug };
  } catch {
    return null;
  }
}
