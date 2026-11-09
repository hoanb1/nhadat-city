#!/usr/bin/env node
'use strict';
// usage: node run.js <collection|all> [--limit N] [--since ISODate] [--batch 5000] [--fresh] [--resume] [--no-resolve] [--allow-prod]
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { Client, types } = require('pg');
const { parseArgs, resolveTargets } = require('./config');
const { runCollection } = require('./lib/loader');
const { resolveFk } = require('./lib/resolve');

types.setTypeParser(1082, (v) => v); // DATE as string

const ORDER = ['users', 'realEstate', 'RealEstateImages', 'projects',
  'blog', 'districts', 'mapLayerTypes', 'mapLayers', 'propertyTypes', 'directions', 'legalDocumentTypes', 'roadTypes', 'dynamicFields',
  'indexing_queue', 'indexing_logs', 'scraping_logs', 'ai_logs', 'analytics_daily', 'analytics_overview', 'seo_keywords',
  'notifications', 'push_subscriptions', 'chat_sessions', 'helpRequests', 'reports', 'campaigns', 'messages', 'comments'];
const SKIPPED = { api_cache: 'rebuildable cache', 'role-assignment': 'merged into users.roles', province2025: 'loaded by scripts/etl/01', ward2025: 'loaded by scripts/etl/02' };

function loadMapper(name) {
  const m = require(path.join(__dirname, 'mappers', name + '.js'));
  m.key = m.key || 'mongo_id';
  return m;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = args._[0];
  if (!target || args.flags.help) { console.log(fs.readFileSync(__filename, 'utf8').split('\n')[2]); console.log('collections: ' + ORDER.join(', ')); process.exit(target ? 0 : 1); }
  const t = resolveTargets(args.flags);
  const limit = args.flags.limit ? parseInt(args.flags.limit, 10) : 0;
  const since = args.flags.since ? new Date(args.flags.since) : null;
  if (since && Number.isNaN(since.getTime())) throw new Error('bad --since');
  const batch = parseInt(args.flags.batch || '5000', 10);
  // checkpoint/resume only for full loads (no --limit/--since) unless --resume is passed explicitly
  const resume = args.flags.resume === true || (!limit && !since);
  const opts = { limit, since, batch, resume, fresh: !!args.flags.fresh };
  const list = target === 'all' ? ORDER : [target];
  for (const n of list) if (!ORDER.includes(n)) throw new Error(`unknown collection "${n}"${SKIPPED[n] ? ' (skipped: ' + SKIPPED[n] + ')' : ''}`);

  const log = (s) => console.log(s);
  log(`target pg db: ${t.pgDb}${t.allowProd ? ' (allow-prod)' : ''} | mode: ${since ? 'delta since ' + since.toISOString() : limit ? 'sample limit=' + limit : 'full'} | resume=${resume} batch=${batch}`);
  const mc = new MongoClient(t.mongoUri, { readPreference: 'secondaryPreferred', appName: 'mongo2pg-readonly' });
  await mc.connect();
  const mdb = mc.db();
  const pg = new Client({ connectionString: t.pgUrl });
  await pg.connect();
  await pg.query("SET statement_timeout = 0; SET synchronous_commit = off");
  await pg.query(fs.readFileSync(path.join(__dirname, 'etl_schema.sql'), 'utf8'));

  const summary = [];
  const done = new Set();
  const doResolves = async (m) => { if (!args.flags['no-resolve']) for (const r of m.resolves || []) await resolveFk(pg, r, log); };
  for (const name of list) {
    const m = loadMapper(name); m.collection = m.collection || name;
    log(`\n=== ${name} -> ${m.table} ===`);
    const st = await runCollection({ pg, mdb, log }, m, opts);
    await doResolves(m);
    done.add(name);
    const un = [...st.unmapped].map(([k, v]) => `${k}(${v.n})`).join(',');
    summary.push({ name, table: m.table, read: st.read, rows: st.rows, errors: st.errors, skipped: st.skipped, secs: +st.secs.toFixed(1), rps: Math.round(st.rows / Math.max(st.secs, 0.001)),
      shortIdDup: st.shortIdDupValues, shortIdRemapped: st.shortIdRemapped, shortIdRuntime: st.shortIdRuntime, unmapped: un });
    log(`  done: read=${st.read} rows=${st.rows} errors=${st.errors} skipped=${st.skipped} ${st.secs.toFixed(1)}s ${Math.round(st.rows / Math.max(st.secs, 0.001))} rows/s` +
      (st.shortIdDupValues !== undefined ? ` | shortId dup values=${st.shortIdDupValues} docs=${st.shortIdDupDocs} remapped=${st.shortIdRemapped} runtime=${st.shortIdRuntime}` : '') + (un ? ` | unmapped: ${un}` : ''));
  }
  if (target === 'all') { // second pass: FKs whose target was loaded after the source
    log('\n=== final FK resolve pass ===');
    for (const name of list) await doResolves(loadMapper(name));
  }
  console.log('\nSUMMARY ' + JSON.stringify(summary));
  await mc.close(); await pg.end();
}
main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
