import { sql } from '@/lib/db/pg';
import type { Doc, Frag } from '@/lib/db/pgUtil';

/** snake_case -> camelCase */
export function camel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Generic row -> legacy Mongo-shaped doc: `extra` jsonb spread first, columns camelCased on top,
 * `_id` = mongo_id ?? String(id). `id`/`mongo_id`/`extra` are not emitted as keys.
 */
export function outRow(r: Doc, drop: string[] = []): Doc {
  const o: Doc = {};
  if (r.mongo_id !== undefined || r.id !== undefined) o._id = r.mongo_id ?? String(r.id);
  if (r.extra && typeof r.extra === 'object') Object.assign(o, r.extra);
  for (const [k, v] of Object.entries(r)) {
    if (k === 'extra' || k === 'id' || k === 'mongo_id' || drop.includes(k)) continue;
    if (v === null || v === undefined) continue;
    o[camel(k)] = v;
  }
  return o;
}

/** Match a bigint-PK table row by mongo_id OR numeric id. */
export function idCond(id: string): Frag {
  const num = /^\d{1,18}$/.test(id) ? id : null;
  return sql`(mongo_id = ${id} OR id = ${num}::bigint)`;
}

export function pageParams(sp: URLSearchParams, defLimit: number, maxLimit = 500) {
  const p = parseInt(sp.get('page') || '1');
  const l = parseInt(sp.get('limit') || String(defLimit));
  const page = Number.isFinite(p) && p > 0 ? p : 1;
  const limit = Number.isFinite(l) && l > 0 ? Math.min(l, maxLimit) : defLimit;
  return { page, limit, offset: (page - 1) * limit };
}

/** 'YYYY-MM-DD' (first 10 chars) or null. */
export function dateOnly(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /^\d{4}-\d{2}-\d{2}/.exec(v);
  return m ? m[0] : null;
}

/** Parse a Date-ish input to ISO string or null. */
export function isoOrNull(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(v as any);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Split a body into known column values and the remainder (goes to `extra`). */
export function splitBody(
  body: Doc,
  map: Record<string, string>,
  skip: string[] = ['_id', 'id', 'createdAt'],
): { cols: Doc; rest: Doc } {
  const cols: Doc = {};
  const rest: Doc = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (skip.includes(k)) continue;
    if (map[k]) cols[map[k]] = v;
    else rest[k] = v;
  }
  return { cols, rest };
}
