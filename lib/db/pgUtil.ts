import type postgres from 'postgres';
import { sql } from './pg';

export type Frag = postgres.PendingQuery<postgres.Row[]>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Doc = Record<string, any> & { _id?: any };

export interface GeoPolygonLike {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][];
}

/** AND-join parameterized condition fragments. */
export function and(conds: Frag[]): Frag {
  return conds.reduce((acc, c) => sql`${acc} AND ${c}`, sql`TRUE`);
}

/** Escape LIKE wildcards in user input. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => '\\' + m);
}

/** $geoWithin equivalent on a geometry column named `geom`. */
export function polygonCond(polygon: GeoPolygonLike | null): Frag | null {
  if (polygon && (polygon.type === 'Polygon' || polygon.type === 'MultiPolygon')) {
    return sql`ST_Within(geom, ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(polygon)}::text), 4326))`;
  }
  return null;
}

/** Set key only when value is neither null nor undefined (Mongo docs simply lacked missing fields). */
export function put(o: Doc, k: string, v: unknown) {
  if (v !== null && v !== undefined) o[k] = v;
}
