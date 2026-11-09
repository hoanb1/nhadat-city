'use strict';
// Resolve FK ids from *_mongo_id text columns, chunked by target-table id range (no giant UPDATE).
async function resolveFk(pg, { table, col, mongoCol, ref }, log, chunk = 100000) {
  const r = await pg.query(`SELECT min(id) lo, max(id) hi FROM ${table}`);
  if (r.rows[0].lo === null) return 0;
  const lo = BigInt(r.rows[0].lo), hi = BigInt(r.rows[0].hi);
  let total = 0;
  for (let a = lo; a <= hi; a += BigInt(chunk)) {
    const res = await pg.query(`UPDATE ${table} t SET ${col} = r.id FROM ${ref} r
      WHERE t.id >= $1 AND t.id < $2 AND t.${mongoCol} = r.mongo_id AND t.${col} IS DISTINCT FROM r.id`, [a.toString(), (a + BigInt(chunk)).toString()]);
    total += res.rowCount;
  }
  log(`  resolve ${table}.${col} <- ${ref}: ${total} rows linked`);
  return total;
}
module.exports = { resolveFk };
