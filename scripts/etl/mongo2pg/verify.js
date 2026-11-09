#!/usr/bin/env node
'use strict';
// usage: node verify.js [collection|all] [--limit N] [--sample 200] [--allow-prod]
// 1) Mongo count vs PG count   2) random sample: re-map each Mongo doc and compare EVERY mapped column with the PG row.
// --limit N: verify a sample load (expects min(N, mongoCount) rows from the first N docs by _id).
const path = require('path');
const { MongoClient } = require('mongodb');
const { Client, types } = require('pg');
const { parseArgs, resolveTargets } = require('./config');
const c = require('./lib/coerce');
types.setTypeParser(1082, (v) => v);

const ORDER = ['users', 'realEstate', 'RealEstateImages', 'projects', 'blog', 'districts', 'mapLayerTypes', 'mapLayers', 'propertyTypes', 'directions', 'legalDocumentTypes', 'roadTypes', 'dynamicFields',
  'indexing_queue', 'indexing_logs', 'scraping_logs', 'ai_logs', 'analytics_daily', 'analytics_overview', 'seo_keywords', 'notifications', 'push_subscriptions', 'chat_sessions', 'helpRequests', 'reports', 'campaigns', 'messages', 'comments'];

const canon = (v) => {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v).sort()) if (v[k] !== undefined) o[k] = canon(v[k]); return o; }
  return v;
};
const j = (v) => JSON.stringify(canon(JSON.parse(c.toJson(v === undefined ? null : v))));

function same(type, a, b) {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  const t = type.replace(/\[\]$/, '');
  if (type.endsWith('[]')) return j(a) === j(b.map ? b : [b]);
  if (/^(integer|smallint|double precision|numeric|bigint)$/.test(type)) {
    const x = Number(a), y = Number(b);
    if (/^-?\d+$/.test(String(a)) && /^-?\d+$/.test(String(b))) return BigInt(a) === BigInt(b);
    return Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));
  }
  if (type === 'timestamptz') return Date.parse(a) === (b instanceof Date ? b.getTime() : Date.parse(b));
  if (type === 'date') return String(a) === String(b);
  if (type === 'jsonb') return j(a) === j(b);
  if (type === 'boolean') return a === b;
  return String(a).replace(/\u0000/g, '') === String(b);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = args._[0] || 'all';
  const t = resolveTargets(args.flags);
  const limit = args.flags.limit ? parseInt(args.flags.limit, 10) : 0;
  const sampleN = parseInt(args.flags.sample || '200', 10);
  const mc = new MongoClient(t.mongoUri, { readPreference: 'secondaryPreferred' }); await mc.connect();
  const mdb = mc.db();
  const pg = new Client({ connectionString: t.pgUrl }); await pg.connect();
  await pg.query('SET statement_timeout = 0');
  console.log(`verify -> pg db ${t.pgDb} | ${limit ? 'sample load limit=' + limit : 'full'} | sample=${sampleN}`);
  const out = [];
  for (const name of target === 'all' ? ORDER : [target]) {
    const m = require(path.join(__dirname, 'mappers', name + '.js')); m.key = m.key || 'mongo_id'; m.collection = m.collection || name;
    const keys = Array.isArray(m.key) ? m.key : [m.key];
    const coll = mdb.collection(m.collection);
    const mcount = limit ? Math.min(limit, await coll.countDocuments({})) : await coll.countDocuments({});
    let where = keys.includes('mongo_id') ? 'mongo_id IS NOT NULL' : 'TRUE';
    if (m.table === 'master_data') where = `kind = '${m.kind}'`;
    if (m.table === 'app_config') where = "key = 'global_overview'";
    if (m.table === 'planning_layers') { const ids = (await coll.find({}, { projection: { _id: 1 } }).toArray()).map((x) => c.id(x._id)); where = `id = ANY(ARRAY[${ids.map((x) => `'${x.replace(/'/g, "''")}'`).join(',') || "''"}])`; }
    const pcount = Number((await pg.query(`SELECT count(*) n FROM ${m.table} WHERE ${where}`)).rows[0].n);
    // sample
    const pipe = limit ? [{ $sort: { _id: 1 } }, { $limit: limit }, { $sample: { size: sampleN } }] : [{ $sample: { size: sampleN } }];
    const docs = await coll.aggregate(pipe, { allowDiskUse: true }).toArray();
    const ctx = { pg, mdb, args: {}, remap: new Map(), unmapped() {}, stats: {}, log() {} };
    if (m.prepare) await m.prepare(ctx);
    const rem = await pg.query('SELECT mongo_id, old_short_id, new_short_id FROM etl_short_id_remap WHERE collection=$1', [m.collection]);
    for (const r of rem.rows) ctx.remap.set(r.mongo_id, { old: r.old_short_id, next: r.new_short_id });
    const rows = []; for (const d of docs) { try { const r = m.map(d, ctx); if (r) rows.push(r); } catch (_) { /* counted in etl_errors */ } }
    const cols = Object.keys(m.columns);
    const sel = cols.map((x) => (m.columns[x] === 'citext[]' ? `"${x}"::text[] AS "${x}"` : m.columns[x] === 'citext' ? `"${x}"::text AS "${x}"` : `"${x}"`)).join(', ') + (m.geom ? ', ST_X(geom) AS "_glng", ST_Y(geom) AS "_glat"' : '');
    const pgRows = new Map();
    if (rows.length) {
      const kcol = keys.includes('mongo_id') ? 'mongo_id' : keys[0];
      const cond = m.table === 'master_data' ? `kind='${m.kind}' AND mongo_id = ANY($1)` : `"${kcol}" = ANY($1)`;
      const kv = rows.map((r) => String(r[kcol]));
      const res = await pg.query(`SELECT ${sel} FROM ${m.table} WHERE ${cond}`, [kv]);
      for (const r of res.rows) pgRows.set(String(r[kcol]), r);
    }
    const mism = []; let missing = 0, checked = 0;
    for (const r of rows) {
      const kcol = keys.includes('mongo_id') ? 'mongo_id' : keys[0];
      const p = pgRows.get(String(r[kcol]));
      if (!p) { missing++; continue; }
      checked++;
      const conflicts = (p.extra && p.extra.etl_conflicts) || {};
      for (const col of cols) {
        if (m.defaults && m.defaults[col] && (r[col] === null || r[col] === undefined)) continue;
        if (col === 'slug' && (m.noUpdate || []).includes('slug')) continue;
        if (col === 'short_id' && ctx.remap.has(r.mongo_id)) continue;
        if (col === 'extra' && ctx.remap.has(r.mongo_id)) { const { legacy_short_id, ...rest } = p.extra || {}; if (!same('jsonb', r.extra, rest)) mism.push([r[kcol], col, '(extra differs)', '']); continue; }
        if (col in conflicts) continue;
        if (!same(m.columns[col], r[col], p[col])) mism.push([r[kcol], col, String(j(r[col])).slice(0, 40), String(j(p[col])).slice(0, 40)]);
      }
      if (m.geom) {
        const a = r._lng === null || r._lng === undefined ? null : r._lng, b = p._glng;
        if (!same('double precision', a, b) || !same('double precision', r._lat ?? null, p._glat)) mism.push([r[kcol], 'geom', `${a},${r._lat}`, `${b},${p._glat}`]);
      }
    }
    const res = { collection: m.collection, mongo: mcount, pg: pcount, countOk: mcount === pcount, sampled: docs.length, checked, missing, mismatches: mism.length };
    out.push(res);
    console.log(`${res.countOk ? 'OK  ' : 'DIFF'} ${m.collection.padEnd(20)} mongo=${mcount} pg=${pcount} sample=${docs.length} checked=${checked} missingInPg=${missing} fieldMismatches=${mism.length}`);
    const hide = m.collection === 'users';
    for (const x of mism.slice(0, 5)) console.log(`     ${String(x[0]).slice(0, 24)} ${x[1]}${hide ? '' : ` mongo=${x[2]} pg=${x[3]}`}`);
  }
  if (target === 'all' || target === 'realEstate') {
    const r = await pg.query(`SELECT count(*) FILTER (WHERE user_mongo_id IS NOT NULL) has_ref, count(*) FILTER (WHERE user_id IS NOT NULL) resolved,
      count(*) FILTER (WHERE geom IS NOT NULL) with_geom, count(*) total FROM real_estates`);
    console.log('real_estates FK/geom:', JSON.stringify(r.rows[0]));
  }
  console.log('\nVERIFY_SUMMARY ' + JSON.stringify(out));
  await mc.close(); await pg.end();
  process.exit(out.every((x) => x.countOk && x.mismatches === 0 && x.missing === 0) ? 0 : 2);
}
main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
