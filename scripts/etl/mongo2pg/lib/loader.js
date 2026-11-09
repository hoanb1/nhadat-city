'use strict';
// Generic batch loader: Mongo cursor (sorted by _id) -> mapper -> idempotent upsert -> checkpoint.
// Rows are shipped as ONE jsonb parameter and expanded with jsonb_to_recordset: a multi-row
// INSERT ... ON CONFLICT DO UPDATE without the 65535 bind-parameter limit (real_estates has ~50 cols).
const { ObjectId } = require('mongodb');
const { toJson, id: idOf, shortFromSeed } = require('./coerce');
const { prescan, applyRemap } = require('./shortid');

const q = (n) => `"${n}"`;

function buildUpsert(m) {
  const names = Object.keys(m.columns);
  const defs = names.map((n) => `${q(n)} ${m.columns[n]}`);
  const insertCols = names.slice();
  const sel = names.map((n) => {
    if (m.exprs && m.exprs[n]) return m.exprs[n];
    const d = m.defaults && m.defaults[n];
    return d ? `COALESCE(x.${q(n)}, ${d})` : `x.${q(n)}`;
  });
  if (m.geom) {
    defs.push('"_lng" double precision', '"_lat" double precision');
    insertCols.push('geom');
    sel.push('CASE WHEN x."_lng" IS NOT NULL AND x."_lat" IS NOT NULL THEN ST_SetSRID(ST_MakePoint(x."_lng", x."_lat"), 4326) END');
  }
  const key = Array.isArray(m.key) ? m.key : [m.key];
  const noUpd = new Set([...key, ...(m.noUpdate || [])]);
  const upd = insertCols.filter((c) => !noUpd.has(c)).map((c) => `${q(c)} = EXCLUDED.${q(c)}`);
  const sql = `INSERT INTO ${m.table} (${insertCols.map(q).join(', ')})
SELECT ${sel.join(', ')} FROM jsonb_to_recordset($1::jsonb) AS x(${defs.join(', ')})
ON CONFLICT (${key.map(q).join(', ')}) DO ${upd.length ? 'UPDATE SET ' + upd.join(', ') + (m.updateWhere ? ' WHERE ' + m.updateWhere : '') : 'NOTHING'}`;
  return sql;
}

function ckptToFilter(last) {
  if (!last) return null;
  const t = last.slice(0, 2), v = last.slice(2);
  if (t === 'o:') return { _id: { $gt: new ObjectId(v) } };
  // BSON order: strings sort before ObjectIds and $gt is type-bracketed -> include all ObjectIds.
  return { $or: [{ _id: { $gt: v } }, { _id: { $type: 'objectId' } }] };
}
function ckptOf(doc) { const i = doc._id; return (i && i._bsontype === 'ObjectId') ? 'o:' + i.toHexString() : 's:' + String(i); }

function dedupeByKey(rows, key, prefer) {
  const ks = Array.isArray(key) ? key : [key];
  const m = new Map();
  for (const r of rows) { const k = ks.map((x) => r[x]).join('\u0001'); const o = m.get(k); if (!o || !prefer || prefer(o, r)) m.set(k, r); }
  return [...m.values()];
}

async function logError(pg, collection, mongoId, error, doc) {
  try {
    await pg.query('INSERT INTO etl_errors (collection, mongo_id, error, doc) VALUES ($1,$2,$3,$4::jsonb)',
      [collection, mongoId, String(error).slice(0, 2000), doc === undefined ? null : toJson(doc)]);
  } catch (e) { console.error(`  (could not write etl_errors: ${e.message.slice(0, 100)})`); }
}

async function newShortId(pg, table, seed) {
  for (let c = 0; c < 20; c++) {
    const s = shortFromSeed(seed, 1000 + c);
    const r = await pg.query(`SELECT 1 FROM ${table} WHERE short_id = $1`, [s]);
    if (!r.rowCount) return s;
  }
  throw new Error('could not allocate short_id');
}

/** Resolve a unique violation on short_id for a single row (older created_at keeps the id). */
async function resolveShortIdConflict(pg, m, row, ctx) {
  const ex = await pg.query(`SELECT mongo_id, created_at FROM ${m.table} WHERE short_id = $1`, [row.short_id]);
  if (!ex.rowCount) return true; // vanished, just retry
  const e = ex.rows[0];
  const mine = row.created_at ? Date.parse(row.created_at) : Infinity;
  const theirs = e.created_at ? e.created_at.getTime() : Infinity;
  const iWin = mine < theirs || (mine === theirs && row.mongo_id < e.mongo_id);
  const old = row.short_id;
  if (iWin) {
    const next = await newShortId(pg, m.table, e.mongo_id);
    await pg.query(`UPDATE ${m.table} SET short_id = $1, extra = coalesce(extra,'{}'::jsonb) || jsonb_build_object('legacy_short_id', $2::text) WHERE mongo_id = $3`, [next, old, e.mongo_id]);
    await pg.query('INSERT INTO etl_short_id_remap (collection, mongo_id, old_short_id, new_short_id) VALUES ($1,$2,$3,$4) ON CONFLICT (collection, mongo_id) DO UPDATE SET new_short_id = EXCLUDED.new_short_id',
      [m.collection, e.mongo_id, old, next]);
  } else {
    const next = await newShortId(pg, m.table, row.mongo_id);
    row.extra = Object.assign({}, row.extra, { legacy_short_id: old });
    row.short_id = next;
    await pg.query('INSERT INTO etl_short_id_remap (collection, mongo_id, old_short_id, new_short_id) VALUES ($1,$2,$3,$4) ON CONFLICT (collection, mongo_id) DO UPDATE SET new_short_id = EXCLUDED.new_short_id',
      [m.collection, row.mongo_id, old, next]);
    ctx.remap.set(row.mongo_id, { old, next });
  }
  ctx.stats.shortIdRuntime++;
  return true;
}

async function upsertRows(pg, m, sql, rows, ctx) {
  if (!rows.length) return 0;
  if (m.beforeBatch) await m.beforeBatch(pg, rows, ctx);
  try {
    await pg.query('BEGIN');
    await pg.query(sql, [toJson(rows)]);
    await pg.query('COMMIT');
    return rows.length;
  } catch (e) {
    await pg.query('ROLLBACK').catch(() => {});
    if (rows.length === 1) throw e;
  }
  // batch failed -> per-row so one bad row cannot block the rest
  let ok = 0;
  for (const row of rows) {
    let attempts = 0;
    for (;;) {
      try { await pg.query(sql, [toJson([row])]); ok++; break; }
      catch (e) {
        attempts++;
        let fixed = false;
        if (e.code === '23505' && attempts <= 4) {
          const col = ((e.detail || '').match(/Key \(([^)]+)\)/) || [])[1] || (e.constraint || '');
          if (m.shortId && /short_id/.test(col + (e.constraint || ''))) fixed = await resolveShortIdConflict(pg, m, row, ctx);
          else if (m.fixConflict) fixed = !!m.fixConflict(row, col, e.constraint || '');
        }
        if (!fixed) {
          ctx.stats.errors++;
          await logError(pg, m.collection, row.__k, `${e.code || ''} ${e.message}`.trim(), ctx.docById.get(row.__k));
          break;
        }
      }
    }
  }
  return ok;
}

async function runCollection(env, m, opts) {
  const { pg, mdb, log } = env;
  const t0 = Date.now();
  const stats = { read: 0, rows: 0, errors: 0, skipped: 0, shortIdRuntime: 0, unmapped: new Map(), batches: 0 };
  const ctx = {
    pg, mdb, stats, args: opts, remap: new Map(), docById: new Map(), log,
    unmapped(collection, mongoId, restObj) {
      for (const k of Object.keys(restObj || {})) {
        const e = stats.unmapped.get(k) || { n: 0, first: mongoId, sample: undefined };
        e.n++; stats.unmapped.set(k, e);
      }
    },
  };
  const sql = buildUpsert(m);
  const resume = opts.resume;
  let last = null;
  if (resume && !opts.fresh) {
    const r = await pg.query('SELECT last_id, rows FROM etl_checkpoints WHERE collection=$1', [m.collection]);
    if (r.rowCount) { last = r.rows[0].last_id; stats.prevRows = Number(r.rows[0].rows); }
  } else if (!resume) {
    await pg.query('DELETE FROM etl_errors WHERE collection=$1', [m.collection]);
  }
  if (m.shortId) {
    const ps = await prescan(mdb, m.collection, log);
    for (const [k, v] of ps.losers) ctx.remap.set(k, v);
    stats.shortIdDupValues = ps.dupValues; stats.shortIdDupDocs = ps.dupDocs; stats.shortIdRemapped = ps.losers.size;
    // reuse persisted remaps (keeps ids stable across runs)
    const pr = await pg.query('SELECT mongo_id, old_short_id, new_short_id FROM etl_short_id_remap WHERE collection=$1', [m.collection]);
    for (const r of pr.rows) ctx.remap.set(r.mongo_id, { old: r.old_short_id, next: r.new_short_id });
    // log prescan remaps
    const vals = [...ps.losers].map(([mid, v]) => ({ collection: m.collection, mongo_id: mid, old_short_id: v.old, new_short_id: v.next }));
    if (vals.length) {
      await pg.query(`INSERT INTO etl_short_id_remap (collection, mongo_id, old_short_id, new_short_id)
        SELECT collection, mongo_id, old_short_id, new_short_id FROM jsonb_to_recordset($1::jsonb) AS x(collection text, mongo_id text, old_short_id text, new_short_id text)
        ON CONFLICT (collection, mongo_id) DO NOTHING`, [JSON.stringify(vals)]);
    }
  }
  if (m.prepare) await m.prepare(ctx);
  stats.prescanSecs = (Date.now() - t0) / 1000;
  const tLoad = Date.now();

  const clauses = [];
  const ck = ckptToFilter(last); if (ck) clauses.push(ck);
  if (opts.since) {
    const f = m.sinceFields === undefined ? ['updatedAt', 'createdAt'] : m.sinceFields;
    if (f.length) clauses.push({ $or: f.map((k) => ({ [k]: { $gte: opts.since } })) });
  }
  const filter = clauses.length ? (clauses.length === 1 ? clauses[0] : { $and: clauses }) : {};
  let cursor = mdb.collection(m.collection).find(filter, m.projection ? { projection: m.projection } : {}).sort({ _id: 1 }).batchSize(Math.min(opts.batch, 2000));
  if (opts.limit) cursor = cursor.limit(opts.limit);
  cursor = cursor.maxTimeMS(0).addCursorFlag('noCursorTimeout', true);

  let buf = [];
  const flush = async () => {
    if (!buf.length) return;
    const docs = buf; buf = [];
    let rows = [];
    ctx.docById.clear();
    for (const doc of docs) {
      try {
        const row = m.map(doc, ctx);
        if (!row) { stats.skipped++; continue; }
        row.__k = row.mongo_id || row[Array.isArray(m.key) ? m.key[0] : m.key];
        if (m.shortId) applyRemap(row, ctx.remap);
        rows.push(row);
        ctx.docById.set(row.__k, m.safeDoc ? m.safeDoc(doc) : doc);
      } catch (e) {
        stats.errors++;
        await logError(pg, m.collection, idOf(doc._id), `map: ${e.message}`, m.safeDoc ? m.safeDoc(doc) : doc);
      }
    }
    rows = dedupeByKey(rows, m.key, m.prefer);
    const ok = await upsertRows(pg, m, sql, rows, ctx);
    stats.rows += ok;
    stats.batches++;
    if (resume) {
      await pg.query(`INSERT INTO etl_checkpoints (collection, last_id, rows, updated_at) VALUES ($1,$2,$3,now())
        ON CONFLICT (collection) DO UPDATE SET last_id = EXCLUDED.last_id, rows = etl_checkpoints.rows + $3, updated_at = now()`,
        [m.collection, ckptOf(docs[docs.length - 1]), ok]);
    }
    if (stats.batches % 10 === 0) {
      const s = (Date.now() - tLoad) / 1000;
      log(`  ${m.collection}: read=${stats.read} rows=${stats.rows} err=${stats.errors} ${(stats.rows / s).toFixed(0)} rows/s`);
    }
  };
  for await (const doc of cursor) {
    stats.read++;
    buf.push(doc);
    if (buf.length >= opts.batch) await flush();
  }
  await flush();
  stats.secs = (Date.now() - tLoad) / 1000;
  // unmapped-field summary for tables without an `extra` column
  for (const [k, v] of stats.unmapped) {
    await logError(pg, m.collection, v.first, `UNMAPPED_FIELD ${k} (${v.n} docs): table has no extra column`, undefined);
  }
  return stats;
}

module.exports = { runCollection, buildUpsert };
