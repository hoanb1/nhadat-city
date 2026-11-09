'use strict';
// Type-coercion helpers shared by all mappers. Pure functions, no I/O.
const { ObjectId } = require('mongodb');

const NUL = /\u0000/g;

/** Mixed _id / FK ref (string | ObjectId | {$oid}) -> text or null. */
function id(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof ObjectId) return v.toHexString();
  if (typeof v === 'object') {
    if (v._bsontype === 'ObjectId' || typeof v.toHexString === 'function') return v.toHexString();
    if (v.$oid) return String(v.$oid);
    return null;
  }
  const s = String(v);
  return s === '' ? null : s;
}

/** text; strips NUL (PG rejects); objects are JSON-stringified rather than dropped. */
function str(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.replace(NUL, '');
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  if (v instanceof Date) return v.toISOString();
  if (v._bsontype === 'ObjectId') return v.toHexString();
  if (v._bsontype) return v.toString();
  try { return JSON.stringify(v).replace(NUL, ''); } catch (_) { return null; }
}
function strOr(v, d) { const s = str(v); return s === null ? d : s; }

/** number from int/long/double/decimal/numeric-string. Long & big values go out as numeric strings. */
function num(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'boolean') return null;
  if (typeof v === 'object') {
    if (v._bsontype === 'Long' || v._bsontype === 'Decimal128' || v._bsontype === 'Int32' || v._bsontype === 'Double') {
      const s = v.toString();
      return /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s) ? s : null;
    }
    return null;
  }
  const s = String(v).trim().replace(/,/g, '');
  return /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s) ? s : null;
}
/** numeric as JS number when finite (for double precision columns). */
function dbl(v) { const n = num(v); if (n === null) return null; const x = Number(n); return Number.isFinite(x) ? x : null; }
/** int4-safe integer or null. */
function int(v) {
  const n = dbl(v); if (n === null) return null;
  const t = Math.trunc(n);
  return t >= -2147483648 && t <= 2147483647 ? t : null;
}
/** bigint as string (exact) or null. */
function bigint(v) {
  const n = num(v); if (n === null) return null;
  if (/^-?\d+$/.test(n)) return n;
  const x = Number(n); return Number.isFinite(x) ? String(Math.trunc(x)) : null;
}
/** numeric(p,s) guard: returns [value, overflowFlag]. abs >= limit -> null + flag. */
function numericBounded(v, limit = 1e18) {
  const n = num(v); if (n === null) return [null, false];
  return Math.abs(Number(n)) >= limit ? [null, true] : [n, false];
}

function bool(v) {
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === '1' || v === 'true') return true;
  if (v === 0 || v === '0' || v === 'false') return false;
  return null;
}

/** timestamptz ISO string. Accepts Date | ISO/other string | epoch ms/sec. year<=1970 sentinel -> null. */
function date(v) {
  if (v === null || v === undefined || v === '') return null;
  let d;
  if (v instanceof Date) d = v;
  else if (typeof v === 'number') d = new Date(Math.abs(v) < 1e11 ? v * 1000 : v);
  else if (typeof v === 'object' && v._bsontype === 'Long') d = new Date(Number(v.toString()));
  else if (typeof v === 'string') {
    const s = v.trim(); if (!s) return null;
    d = /^-?\d{9,}$/.test(s) ? new Date(Math.abs(Number(s)) < 1e11 ? Number(s) * 1000 : Number(s)) : new Date(s);
  } else return null;
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  const y = d.getUTCFullYear();
  if (y <= 1970 || y > 2200) return null;
  return d.toISOString();
}
/** DATE 'YYYY-MM-DD' without tz shifting for already-formatted strings. */
function dateOnly(v) {
  if (typeof v === 'string') { const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`; }
  const iso = date(v); return iso ? iso.slice(0, 10) : null;
}

function strArr(v) {
  if (Array.isArray(v)) return v.map(str).filter((x) => x !== null && x !== '');
  const s = str(v); return s ? [s] : [];
}
function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) && !v._bsontype ? v : {}; }
function arr(v) { return Array.isArray(v) ? v : []; }

/** Validate [lng,lat] -> {lng,lat} or null (range check, not 0,0). Accepts array or (lng,lat) args. */
function lngLat(a, b) {
  let lng, lat;
  if (Array.isArray(a)) { lng = dbl(a[0]); lat = dbl(a[1]); } else { lng = dbl(a); lat = dbl(b); }
  if (lng === null || lat === null) return null;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  if (lng === 0 && lat === 0) return null;
  return { lng, lat };
}

/** top-level keys of doc not in `known` (Set|array) -> plain object (goes to extra). */
function rest(doc, known) {
  const k = known instanceof Set ? known : new Set(known);
  const out = {};
  for (const key of Object.keys(doc)) if (!k.has(key) && doc[key] !== undefined) out[key] = doc[key];
  return out;
}
function omit(o, keys) {
  const out = {}; const k = new Set(keys);
  for (const key of Object.keys(o || {})) if (!k.has(key) && o[key] !== undefined) out[key] = o[key];
  return out;
}
function isEmpty(o) { return !o || (typeof o === 'object' && Object.keys(o).length === 0); }

/** JSON.stringify replacer: BSON -> JSON, strips NUL from strings. */
function replacer(key, value) {
  const raw = this[key];
  if (raw && typeof raw === 'object') {
    const t = raw._bsontype;
    if (t === 'ObjectId') return raw.toHexString();
    if (t === 'Long') { const s = raw.toString(); return Math.abs(Number(s)) <= Number.MAX_SAFE_INTEGER ? Number(s) : s; }
    if (t === 'Decimal128') return raw.toString();
    if (t === 'Binary') return raw.toString('base64');
    if (t === 'Int32' || t === 'Double') return Number(raw.valueOf());
  }
  if (typeof value === 'string' && value.indexOf('\u0000') !== -1) return value.replace(NUL, '');
  if (typeof value === 'bigint') return value.toString();
  return value;
}
function toJson(v) { return JSON.stringify(v, replacer); }
/** Deep-strip keys that look like secrets (token/secret/password) from an object. */
function stripSecrets(o) {
  if (Array.isArray(o)) return o.map(stripSecrets);
  if (o && typeof o === 'object' && !o._bsontype && !(o instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(o)) if (!/token|secret|passw|bcrypt|expires/i.test(k)) out[k] = stripSecrets(v);
    return out;
  }
  return o;
}

const B62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
/** Deterministic 6-char [A-Za-z0-9] id from a seed string (+counter). */
function shortFromSeed(seed, counter = 0) {
  const h = require('crypto').createHash('sha256').update(`${seed}#${counter}`).digest();
  let out = ''; for (let i = 0; i < 6; i++) out += B62[h[i] % 62];
  return out;
}

function slugify(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

module.exports = { id, str, strOr, num, dbl, int, bigint, numericBounded, bool, date, dateOnly, strArr, obj, arr, lngLat, rest, omit, isEmpty, replacer, toJson, stripSecrets, shortFromSeed, slugify };
