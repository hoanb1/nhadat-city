'use strict';
// Env + safety guard. Never prints secrets.
const fs = require('fs');
const path = require('path');

function loadEnvFile(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (_) { /* optional */ }
}

function parseArgs(argv) {
  const a = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith('--')) {
      const k = t.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--') && !['allow-prod', 'fresh', 'resume', 'no-resolve', 'help', 'dry-run'].includes(k)) {
        a.flags[k] = next; i++;
      } else a.flags[k] = true;
    } else a._.push(t);
  }
  return a;
}

function swapDb(url, db) {
  const u = new URL(url);
  u.pathname = '/' + db;
  return u.toString();
}
function dbName(url) { return decodeURIComponent(new URL(url).pathname.replace(/^\//, '')); }

function resolveTargets(flags) {
  const root = path.join(__dirname, '..', '..', '..');
  loadEnvFile(path.join(root, 'nhadat-rs', '.env'));
  loadEnvFile(path.join(root, '.env.local'));
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI missing (set in .env.local or env)');
  let pgUrl = process.env.ETL_PG_URL || process.env.DATABASE_URL;
  if (!pgUrl) throw new Error('DATABASE_URL (or ETL_PG_URL) missing');
  const allowProd = !!flags['allow-prod'];
  if (!process.env.ETL_PG_URL && !allowProd) pgUrl = swapDb(pgUrl, 'nhadat_city_staging');
  const target = dbName(pgUrl);
  if (!target.endsWith('_staging')) {
    // Non-staging target: needs BOTH --allow-prod AND ETL_CONFIRM_PROD=<exact target db name>. Thrown before any connection is opened.
    if (!allowProd) throw new Error(`REFUSED: target db "${target}" is not *_staging. Pass --allow-prod and ETL_CONFIRM_PROD=${target} to override.`);
    if (process.env.ETL_CONFIRM_PROD !== target) throw new Error(`REFUSED: non-staging target "${target}" also requires env ETL_CONFIRM_PROD=${target} (exact db name).`);
  }
  return { mongoUri, pgUrl, pgDb: target, allowProd };
}

module.exports = { parseArgs, resolveTargets };
