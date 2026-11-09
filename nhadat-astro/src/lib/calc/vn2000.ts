import proj4 from 'proj4';
import { LEGACY_PROVINCE_MAP } from '../constants/provinces';
import type { Vn2000Point, Wgs84Point, Vn2000Result } from '../types';

/**
 * VN2000 Ellipsoid & 7 Helmert Parameters to WGS84 (Bộ Tài nguyên & Môi trường SSOT)
 * Ellipsoid: Krasovsky 1940: a=6378245.0, 1/f=298.3
 * Helmert Parameters: dx=-191.90441429, dy=-39.30318279, dz=-111.45032835,
 * rx=-0.00928836", ry=0.01975479", rz=-0.00427372", s=0.000000252906278
 */
export function getVn2000Proj4String(centralMeridian: number): string {
  return `+proj=tmerc +lat_0=0 +lon_0=${centralMeridian} +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.000000252906278 +units=m +no_defs`;
}

/**
 * Convert VN2000 (X, Y) to WGS84 (Lat, Lon)
 * Note in VN cadastral maps: X is Northing (m), Y is Easting (m)
 */
export function vn2000ToWgs84(x: number, y: number, centralMeridian: number): Wgs84Point {
  const vn2000Def = getVn2000Proj4String(centralMeridian);
  // In Proj4: input is [easting, northing] -> [y, x]
  const [lon, lat] = proj4(vn2000Def, 'WGS84', [y, x]);
  return {
    lat: Number(lat.toFixed(7)),
    lon: Number(lon.toFixed(7)),
  };
}

/**
 * Convert WGS84 (Lat, Lon) to VN2000 (X, Y)
 */
export function wgs84ToVn2000(lat: number, lon: number, centralMeridian: number): Vn2000Point {
  const vn2000Def = getVn2000Proj4String(centralMeridian);
  const [y, x] = proj4('WGS84', vn2000Def, [lon, lat]);
  return {
    x: Number(x.toFixed(3)),
    y: Number(y.toFixed(3)),
  };
}

/**
 * Calculate polygon area using Shoelace formula on planar VN2000 coordinates
 */
export function calculatePolygonMetrics(points: Vn2000Point[]): { area_m2: number; perimeter_m: number } {
  if (points.length < 3) return { area_m2: 0, perimeter_m: 0 };

  let area = 0;
  let perimeter = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // Shoelace formula: (X_i * Y_j - X_j * Y_i)
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;

    // Euclidean distance
    const dx = points[j].x - points[i].x;
    const dy = points[j].y - points[i].y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }

  return {
    area_m2: Number(Math.abs(area / 2).toFixed(2)),
    perimeter_m: Number(perimeter.toFixed(2)),
  };
}

/**
 * Parse raw multi-line coordinate text from Sổ đỏ (GCN QSDĐ)
 * Formats supported:
 * 1. "X: 2321450.12, Y: 589230.45"
 * 2. "2321450.12 589230.45"
 * 3. "1  2321450.12  589230.45"
 */
export function parseSoDoCoordinates(rawText: string): Vn2000Point[] {
  const lines = rawText.split('\n');
  const points: Vn2000Point[] = [];

  for (const line of lines) {
    const clean = line.replace(/[,;:]/g, ' ').trim();
    if (!clean) continue;

    // Match numbers with possible decimals
    const matches = clean.match(/[-+]?[0-9]*\.?[0-9]+/g);
    if (!matches || matches.length < 2) continue;

    // If 3 numbers, usually: [PointNumber, X, Y]
    if (matches.length >= 3) {
      const num1 = parseFloat(matches[1]);
      const num2 = parseFloat(matches[2]);
      if (!isNaN(num1) && !isNaN(num2)) {
        // Northing X in Vietnam is typically ~900,000 - 2,500,000
        // Easting Y in Vietnam is typically ~300,000 - 700,000
        if (num1 > num2) {
          points.push({ x: num1, y: num2 });
        } else {
          points.push({ x: num2, y: num1 });
        }
      }
    } else if (matches.length === 2) {
      const num1 = parseFloat(matches[0]);
      const num2 = parseFloat(matches[1]);
      if (!isNaN(num1) && !isNaN(num2)) {
        if (num1 > num2) {
          points.push({ x: num1, y: num2 });
        } else {
          points.push({ x: num2, y: num1 });
        }
      }
    }
  }

  return points;
}
