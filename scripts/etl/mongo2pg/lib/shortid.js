'use strict';
// short_id de-dupe. Mongo shortId is random & NOT unique; PG short_id is UNIQUE.
// Rule: row with older created_at keeps the id (tie: smaller mongo_id); others get a deterministic
// 6-char [A-Za-z0-9] id derived from their mongo_id; old value kept in extra.legacy_short_id and in etl_short_id_remap.
const { id: idOf, shortFromSeed } = require('./coerce');

/** Aggregate duplicate shortIds in Mongo; return Map<mongo_id, {old, next}> for the losers. */
async function prescan(mdb, collection, log = () => {}) {
  const coll = mdb.collection(collection);
  const dups = await coll.aggregate([
    { $match: { shortId: { $type: 'string' } } },
    { $group: { _id: '$shortId', n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ], { allowDiskUse: true, maxTimeMS: 20 * 60 * 1000 }).toArray();
  const losers = new Map();
  if (!dups.length) return { losers, dupValues: 0, dupDocs: 0 };
  const values = dups.map((d) => d._id);
  const valueSet = new Set(values);
  let dupDocs = 0;
  const byVal = new Map();
  for (let i = 0; i < values.length; i += 1000) {
    const docs = await coll.find({ shortId: { $in: values.slice(i, i + 1000) } }, { projection: { _id: 1, createdAt: 1, shortId: 1 } }).toArray();
    for (const d of docs) {
      dupDocs++;
      if (!byVal.has(d.shortId)) byVal.set(d.shortId, []);
      byVal.get(d.shortId).push({ id: idOf(d._id), t: d.createdAt instanceof Date ? d.createdAt.getTime() : Infinity });
    }
  }
  const taken = new Set(valueSet);
  for (const [sid, list] of byVal) {
    list.sort((a, b) => (a.t - b.t) || (a.id < b.id ? -1 : 1) || 0);
    for (const l of list.slice(1)) {
      let c = 0, next;
      do { next = shortFromSeed(l.id, c++); } while (taken.has(next));
      taken.add(next);
      losers.set(l.id, { old: sid, next });
    }
  }
  log(`short_id prescan ${collection}: ${dups.length} duplicated values, ${dupDocs} docs, ${losers.size} remapped`);
  return { losers, dupValues: dups.length, dupDocs };
}

/** Apply a known remap to a mapped row (mutates). Returns true if remapped. */
function applyRemap(row, remap) {
  const r = remap.get(row.mongo_id);
  if (!r) return false;
  if (row.short_id === r.old || !row.short_id) {
    row.extra = Object.assign({}, row.extra, { legacy_short_id: r.old });
    row.short_id = r.next;
    return true;
  }
  return false;
}

module.exports = { prescan, applyRemap };
