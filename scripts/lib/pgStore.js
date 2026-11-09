'use strict';
/**
 * Shared Postgres access for the Node scripts (scraper, indexing runner, tran-nhung-agent, seo-monitor).
 * - postgres.js client from the root node_modules, DATABASE_URL from env / .env.local / nhadat-rs/.env
 * - real_estates / real_estate_images / projects / blog_posts writes REUSE the ETL mappers + upsert SQL
 *   (scripts/etl/mongo2pg) so scraper rows are identical to migrated rows.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');

function loadEnvFile(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (_) { /* optional */ }
}
loadEnvFile(path.join(ROOT, '.env.local'));
loadEnvFile(path.join(ROOT, 'nhadat-rs', '.env'));
loadEnvFile(path.join(ROOT, '.env'));

const postgres = require('postgres');
let _sql = null;
function getSql() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  _sql = postgres(url, { max: 4, idle_timeout: 20, onnotice: () => {} });
  return _sql;
}
const sql = new Proxy(function () {}, {
  apply: (_t, _this, args) => getSql()(...args),
  get: (_t, prop) => { const s = getSql(); const v = s[prop]; return typeof v === 'function' ? v.bind(s) : v; },
});
async function close() { if (_sql) { const s = _sql; _sql = null; await s.end({ timeout: 5 }); } }

const B62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function randomString(len) {
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, (b) => B62[b % B62.length]).join('');
}
/** Meteor-style 17-char id (same as lib/db/repo/userRepo.ts meteorId) for new mongo_id values. */
function meteorId(len = 17) { return randomString(len); }
function generateShortId(len = 6) { return randomString(len); }

// ── ETL mapper reuse ─────────────────────────────────────────────────────────
const ETL = path.join(__dirname, '..', 'etl', 'mongo2pg');
const { buildUpsert } = require(path.join(ETL, 'lib', 'loader'));
const coerce = require(path.join(ETL, 'lib', 'coerce'));
const MAPPERS = {
  realEstate: require(path.join(ETL, 'mappers', 'realEstate')),
  images: require(path.join(ETL, 'mappers', 'RealEstateImages')),
  projects: require(path.join(ETL, 'mappers', 'projects')),
  blog: require(path.join(ETL, 'mappers', 'blog')),
};
const UPSERT_SQL = {};
function upsertSql(name) { return UPSERT_SQL[name] || (UPSERT_SQL[name] = buildUpsert(MAPPERS[name])); }

let _ctx = null;
async function mapperCtx(name) {
  if (!_ctx) {
    _ctx = { seenSlugs: new Set(), pg: { query: async (text, params) => ({ rows: await sql.unsafe(text, params || []) }) } };
    if (MAPPERS.projects.prepare) await MAPPERS.projects.prepare(_ctx);
  }
  if (name === 'projects') _ctx.seenSlugs = new Set(); // uniqueness vs DB is handled by the conflict retry below
  return _ctx;
}

async function mapDoc(name, doc) {
  const m = MAPPERS[name];
  return m.map(doc, await mapperCtx(name));
}

/** Idempotent single-row upsert through the ETL SQL. Returns the mapped row. */
async function upsertRow(name, row) {
  await sql.unsafe(upsertSql(name), [sql.json(JSON.parse(coerce.toJson([row])))]);
  return row;
}

function conflictCol(e) {
  // 23505 unique_violation; constraint like real_estates_short_id_key / projects_slug_key / uq_projects_short_id
  if (!e || e.code !== '23505') return null;
  const c = String(e.constraint_name || e.detail || '');
  if (/short_id/.test(c)) return 'short_id';
  if (/slug/.test(c)) return 'slug';
  return 'other';
}

/** Insert a Mongo-shaped doc via mapper; retries with a fresh short_id (or fixConflict for slug). */
async function insertMapped(name, doc) {
  if (!doc._id) doc._id = meteorId();
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await mapDoc(name, doc);
    try {
      await upsertRow(name, row);
      return row;
    } catch (e) {
      const col = conflictCol(e);
      if (col === 'short_id') { doc.shortId = generateShortId(6 + (attempt > 3 ? 1 : 0)); continue; }
      if (col === 'slug') {
        if (name === 'projects') { doc.slug = `${row.slug}-${row.short_id || generateShortId()}`; continue; }
        if (MAPPERS[name].fixConflict && MAPPERS[name].fixConflict(row, 'slug')) { doc.slug = row.slug; continue; }
      }
      throw e;
    }
  }
  throw new Error(`insertMapped(${name}): could not find a unique short_id/slug`);
}


/** Upsert a mapped row on a different unique column (e.g. blog slug). mongo_id/key/conflict col are not overwritten. */
async function upsertByColumn(name, row, conflictCol) {
  const m = MAPPERS[name];
  const cols = Object.keys(m.columns).filter((c) => row[c] !== undefined && !(row[c] === null && m.defaults && m.defaults[c]));
  const vals = cols.map((c) => {
    const t = m.columns[c], v = row[c] === undefined ? null : row[c];
    return t === 'jsonb' ? (v === null ? null : sql.json(JSON.parse(coerce.toJson(v)))) : v;
  });
  const ph = cols.map((c, i) => `$${i + 1}::${m.columns[c]}`);
  const upd = cols.filter((c) => row[c] !== null && !['mongo_id', conflictCol, m.key].includes(c)).map((c) => `"${c}" = EXCLUDED."${c}"`);
  const q = `INSERT INTO ${m.table} (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${ph.join(', ')})
    ON CONFLICT ("${conflictCol}") DO UPDATE SET ${upd.join(', ')} RETURNING id, mongo_id`;
  const r = await sql.unsafe(q, vals);
  return r[0];
}

// ── real estates / projects ──────────────────────────────────────────────────
const insertListing = (doc) => insertMapped('realEstate', doc);
const insertProject = (doc) => insertMapped('projects', doc);

async function insertImage({ id, filepath, createdAt }) {
  const doc = {
    _id: id, path: filepath, createdAt: createdAt || new Date(),
    versions: { original: { path: filepath, type: 'image/webp', extension: 'webp' } },
  };
  const row = await mapDoc('images', doc);
  await upsertRow('images', row);
  return row;
}

async function listingExistsBySourceUrl(url) {
  const r = await sql`SELECT 1 FROM real_estates WHERE source_url = ${url} LIMIT 1`; return r.length > 0;
}
async function listingExistsBySourceCode(code) {
  if (!/^\d+$/.test(String(code))) return false;
  const r = await sql`SELECT 1 FROM real_estates WHERE source_code = ${String(code)}::bigint LIMIT 1`; return r.length > 0;
}
async function listingExistsByContent(title, description) {
  const r = await sql`SELECT 1 FROM real_estates
    WHERE (extra->>'originalTitle' = ${title} AND extra->>'originalDescription' = ${description})
       OR (title = ${title} AND description = ${description}) LIMIT 1`;
  return r.length > 0;
}
async function projectExistsBySourceUrl(url) {
  const r = await sql`SELECT 1 FROM projects WHERE source_url = ${url} LIMIT 1`; return r.length > 0;
}
async function projectExistsByContent(title, description) {
  const r = await sql`SELECT 1 FROM projects
    WHERE (extra->>'originalTitle' = ${title} AND extra->>'originalDescription' = ${description})
       OR (title = ${title} AND description = ${description}) LIMIT 1`;
  return r.length > 0;
}
/** Meeyproject dedupe: slug in source_url, same short_id (meey), or same original content. Returns {id, mongo_id} | null */
async function findMeeyProject({ slug, shortId, title, description }) {
  const like = slug ? `%${String(slug).replace(/[\\%_]/g, '\\$&')}%` : null;
  const r = await sql`SELECT id, mongo_id FROM projects
    WHERE (${like}::text IS NOT NULL AND source_url ILIKE ${like})
       OR (${shortId ?? null}::text IS NOT NULL AND short_id = ${shortId == null ? null : String(shortId)})
       OR (extra->>'originalTitle' = ${title} AND extra->>'originalDescription' = ${description})
       OR (title = ${title} AND description = ${description})
    LIMIT 1`;
  return r[0] || null;
}

// Mongo field -> project columns (values come from the ETL mapper so conversions are identical)
const PROJECT_KEYCOLS = {
  tradeName: ['trade_name'], investorName: ['investor_name'], investorDescription: ['investor_description'], investorLogo: ['investor_logo_url'],
  projectTypes: ['project_types', 'project_type'], totalApartment: ['total_apartments'], totalBuilding: ['total_buildings'], totalFloor: ['total_floors'],
  totalArea: ['total_area_text'], buildingDensity: ['building_density'], ownership: ['ownership'], status: ['status'], completionTime: ['completion_time'],
  startTime: ['start_time'], utilitiesDescription: ['utilities_summary'], locationDescription: ['location_summary'], constructionProgress: ['construction_progress'],
  salePolicy: ['sale_policy'], juridical: ['juridical', 'legal_summary'], banner: ['banner_url'], logo: ['logo_url'], streetName: ['street_name'],
  coordinates: ['lat', 'lon', 'geom'], adminunit: ['province_slug', 'district_slug', 'ward_slug', 'legacy_province_slug'],
  // slug intentionally NOT updated (published SEO URLs stay stable; mapper has noUpdate:['slug'])
};
const JSONB_COLS = new Set(['construction_progress', 'sale_policy', 'juridical']);
/** Update an existing project (by id) with Mongo-shaped fields. Returns number of fields applied. */
async function updateProjectFields(id, fields) {
  const row = await mapDoc('projects', { _id: 'tmp', title: 'x', ...fields });
  const sets = []; const vals = [];
  const push = (col, val, cast = '') => { vals.push(val); sets.push(`"${col}" = $${vals.length}${cast}`); };
  for (const k of Object.keys(fields)) {
    for (const col of PROJECT_KEYCOLS[k] || []) {
      if (col === 'geom') {
        if (row._lng != null && row._lat != null) { vals.push(row._lng, row._lat); sets.push(`geom = ST_SetSRID(ST_MakePoint($${vals.length - 1}, $${vals.length}), 4326)`); }
      } else if (JSONB_COLS.has(col)) push(col, sql.json(row[col]), '::jsonb');
      else if (col === 'project_types') push(col, row[col], '::text[]');
      else push(col, row[col]);
    }
  }
  if (!sets.length) return 0;
  sets.push('updated_at = now()');
  vals.push(id);
  await sql.unsafe(`UPDATE projects SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
  return Object.keys(fields).length;
}

// ── scraping_logs jobs: numeric id (admin) or legacy mongo_id ────────────────
function jobWhere(jobId) {
  const s = String(jobId);
  return /^\d+$/.test(s) ? sql`id = ${s}::bigint` : sql`mongo_id = ${s}`;
}
async function getJobStatus(jobId) {
  if (!jobId || jobId === 'local-test') return undefined;
  const r = await sql`SELECT status FROM scraping_logs WHERE ${jobWhere(jobId)} LIMIT 1`;
  return r[0] ? r[0].status : null; // null => job row missing
}
/** fields: itemsScraped, errors, status, endedAt (Date) + anything else -> merged into extra */
async function updateJob(jobId, fields = {}) {
  if (!jobId || jobId === 'local-test') return;
  const { itemsScraped, errors, status, endedAt, ...rest } = fields;
  const extra = JSON.parse(JSON.stringify({ lastActivity: new Date(), ...rest }));
  await sql`UPDATE scraping_logs SET
      items_scraped = COALESCE(${itemsScraped ?? null}::int, items_scraped),
      errors        = COALESCE(${errors ?? null}::int, errors),
      status        = COALESCE(${status ?? null}::text, status),
      ended_at      = COALESCE(${endedAt ?? null}::timestamptz, ended_at),
      extra         = extra || ${sql.json(extra)}
    WHERE ${jobWhere(jobId)}`;
}

module.exports = {
  sql, close, meteorId, generateShortId, coerce, mapDoc, upsertRow, insertMapped, MAPPERS,
  upsertByColumn, insertListing, insertProject, insertImage, updateProjectFields,
  listingExistsBySourceUrl, listingExistsBySourceCode, listingExistsByContent,
  projectExistsBySourceUrl, projectExistsByContent, findMeeyProject,
  getJobStatus, updateJob,
};
