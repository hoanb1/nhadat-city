# nhadat-rs migrations

Plain SQL, applied **manually in filename order** with psql. `sqlx::migrate!` is intentionally NOT wired into
`main.rs`: the prod DB (`nhadat_city`) was created by hand, so it has no `_sqlx_migrations` table and sqlx would try to re-run 001.

| File | Content | Re-runnable |
|---|---|---|
| 001_init_schema.sql | reference tables (provinces, wards, projects, planning_layers, ...) | yes (IF NOT EXISTS) |
| 002_seed_data.sql | seed data | yes (verified on staging) |
| 003_state_land_prices.sql | `state_land_prices` (was missing in prod) | yes |
| 004_core_app_tables.sql | extensions, `f_unaccent`, `users`, `real_estates`, `real_estate_images`, ALTER `projects` | yes |
| 005_aux_app_tables.sql | blog_posts, districts, master_data, indexing_*, logs, notifications, chat, comments, ... ; ALTER `planning_layers` | yes |
| 006_listing_indexes.sql | heavy secondary/GIN/GIST indexes on real_estates / real_estate_images | yes |
| 007_contract_fixes.sql | `districts.province_name`, `indexing_logs.success`, `indexing_queue` lowercase status + UNIQUE(url), push_subscriptions / contact-email / sitemap-paging / is_scraped indexes (last 3 are heavy: CONCURRENTLY on live prod) | yes |

## Apply
```bash
export DATABASE_URL=postgres://USER:PASS@HOST:5432/DBNAME     # never commit
for f in nhadat-rs/migrations/00*.sql; do
  timeout -k 5 600 psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$f" || break
done
```
- Staging first (`nhadat_city_staging`), then prod. Needs a superuser (or pre-installed extensions) for `CREATE EXTENSION`.
- On prod 001/002 are already applied: run from 003 on. 003 creates a table the Rust API already queries.
- **Bulk ETL order**: 004, 005 -> load data (users, then real_estates, then real_estate_images) -> 006. 007 must be applied before the ETL (columns/unique index it needs); for a 985k-row bulk load, run only the part of 007 above the `heavy real_estates indexes` marker first and the 3 trailing indexes after load.
  Loading before 006 avoids maintaining 16 indexes + a GIN tsvector during 985k/6.5M inserts. For live tables, run the 006
  statements one by one as `CREATE INDEX CONCURRENTLY`.
- `real_estates.search_tsv` and `first_image` are generated columns: do not insert into them.
- Auth note: `users.password_hash` holds the Meteor bcrypt of `sha256hex(password)`; verify with
  `bcrypt.compare(sha256hex(plain), password_hash)` exactly as `app/api/auth/[...nextauth]/route.ts` does today.
