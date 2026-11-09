# mongo2pg - MongoDB -> PostgreSQL ETL (SDD 08, P2)

Idempotent, resumable, delta-capable. Mongo is **read-only**. Target = `nhadat_city_staging` by default
(DATABASE_URL from `nhadat-rs/.env` with the db name swapped); refuses any db not named `*_staging` unless `--allow-prod`.
`ETL_PG_URL` overrides the target URL (still guarded). `MONGODB_URI` from env / `.env.local`.

## Setup
    cd scripts/etl/mongo2pg && NODE_OPTIONS=--max-old-space-size=512 npm install
    # schema first: sqlx migrate run  (migrations 001..005; NOT 006 before the bulk load)

## Usage (always: NODE_OPTIONS=--max-old-space-size=512 timeout -k 5 <sec> ...)
    node run.js <collection|all> [--limit N] [--since ISODate] [--batch 5000] [--fresh] [--resume] [--no-resolve] [--allow-prod]
    node verify.js [collection|all] [--limit N] [--sample 200]

* Order for `all`: users (+role-assignment merged into roles) -> realEstate -> RealEstateImages -> projects -> rest
  (blog, districts, map layers, master data x5, indexing_*, scraping_logs, ai_logs, analytics, seo_keywords, notifications,
  push_subscriptions, chat_sessions, helpRequests, reports, campaigns, messages, comments). `api_cache` skipped (rebuildable).
* One mapper per Mongo collection: `mappers/<collection>.js` (`map(doc) -> row`, column types, conflict key, FK resolves).
* Batches (default 5000, sorted by `_id`) are sent as one jsonb param and expanded with `jsonb_to_recordset` into
  `INSERT ... ON CONFLICT (mongo_id | natural key) DO UPDATE` (no 65535 bind limit). A failing batch falls back to row-by-row;
  bad rows go to `etl_errors(collection, mongo_id, error, doc)` and the run continues.
* After loading, `*_user_id`, `real_estate_id`, sender/receiver ids are resolved by chunked `UPDATE ... FROM` on `*_mongo_id`.
* Unknown fields -> `extra` jsonb. Tables with no `extra` column log `UNMAPPED_FIELD x (n docs)` to `etl_errors`.
* Secrets never copied: users.services.resume/password.reset/enroll/email tokens, OAuth access/id/refresh tokens
  (only the bcrypt hash is kept as `password_hash`). Error docs for users have `services` removed.
* Bookkeeping tables (created by run.js from `etl_schema.sql`): `etl_checkpoints`, `etl_short_id_remap`, `etl_errors`.
* **Checkpoint/resume**: full runs (no `--limit/--since`) write `etl_checkpoints.last_id` after every committed batch and
  resume after it on rerun. `--fresh` ignores it. `--limit`/`--since` runs never use it (so a sample can be re-run to prove idempotency).
* **short_id dedupe** (`realEstate`, `projects`): a Mongo aggregate pre-scan finds duplicated `shortId`s. The older `createdAt` keeps it
  (tie: smaller _id); the others get a deterministic 6-char `[A-Za-z0-9]` id, `extra.legacy_short_id = old`, and a row in
  `etl_short_id_remap`. A run-time fallback handles collisions against rows already in PG (delta runs).
* projects: rows from `scripts/etl/04` (mongo_id NULL) are adopted by `short_id`, then upserted by `mongo_id`; `slug` is never overwritten.

## Cutover delta (P6)
1. Bulk load while Mongo is live: `run.js all` (resumable; re-run after interruption).
2. Run `006_listing_indexes.sql` (below) and `verify.js all`.
3. Stop writers (scraper, indexing cron, app writes). Note T0 = time of the bulk start minus a safety margin (e.g. 1h).
4. `run.js all --since <T0>` : re-upserts docs with `updatedAt >= T0 OR createdAt >= T0` (collections with other timestamp
   fields use them; static lookup tables are reloaded fully). Cost note: `realEstate.updatedAt` is not indexed in Mongo, so this is a scan.
   **Deletes are not propagated** - compare counts in verify and delete orphans manually if any.
5. `verify.js all`, switch env, start app, smoke test.

## Index migration 006 after bulk load
Load first with only PK/UNIQUE (fast), then build secondary indexes. Staging/maintenance window:
`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f nhadat-rs/migrations/006_listing_indexes.sql`
On live prod, run each statement as `CREATE INDEX CONCURRENTLY IF NOT EXISTS ...` one at a time (outside a transaction, so not via
`psql -1`/sqlx): `sed 's/CREATE INDEX IF NOT EXISTS/CREATE INDEX CONCURRENTLY IF NOT EXISTS/' 006_listing_indexes.sql | psql -v ON_ERROR_STOP=0 "$DATABASE_URL"`.
Check for `INVALID` indexes afterwards (`\d+ real_estates`) and drop/recreate them. Then `ANALYZE real_estates, real_estate_images, users;`.
The FK resolve step is fastest before `idx_re_*` exist on write-heavy columns; if resolving images later, `idx_rei_re_mongo` helps.
