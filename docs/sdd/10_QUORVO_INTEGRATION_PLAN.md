# 10. Quorvo integration: inventory, mapping, phased plan

Status: **draft for owner review, nothing implemented** (2026-10-24). Pin: quorvo `v0.1.0-alpha.9`. Contract: quorvo `docs/CONSUMER_RULES.md`. Gaps: [../QUORVO_NEEDS.md](../QUORVO_NEEDS.md). Companion of SDD 09 (Rust-only R1..R8), which this plan amends: SDD 09 targets askama + vanilla JS; quorvo rule 22 requires one Vite multi-page build with SolidJS.

## 1. Inventory (facts from code and prod DB, 2026-10-24)

| Area | Today |
|---|---|
| Data | Postgres 16.15 + PostGIS 3.4.2, `nhadat_city` on .186, 14 GB. `real_estates` 984k rows (4.65 GB, 26 indexes, GiST geom, GIN tsvector, trigram), `real_estate_images` 6.5M rows (8.5 GB), `users` 60.5k (Meteor-legacy sha256+bcrypt), `notifications` 503k, `projects` 4.6k, `wards_2025` 3 322, `provinces_2025` 34, `blog_posts` 1 062, plus ~25 small tables. Mongo = read-only fallback (P7 removal pending). |
| Ids | `real_estates.id` int8 internal; `short_id` 6-char base62, unique, all rows; `mongo_id` 17-char legacy (still resolves, redirects). Slug not stored, derived from title. |
| Writes | ~155 new listings/day, 100% from the scraper cron; UGC 2 rows in 30 days; 18 new users in 30 days. Read-dominated. |
| Search | Plain SQL: `f_unaccent(title) ILIKE`, equality filters on slugs, bbox `&&` / `ST_Within`. No facets/engine. Redis = plain cache only (statistics, tiles). |
| Maps | GeoServer (.184, workspace `usermap`, parcels `current:ranhthua`) raster WMS/WMTS proxied; HMAC tile token 5 min; Nominatim .186; MapLibre client; no vector tiles. |
| Images | Originals on local disk of .241 (`/DATA/nhadat/uploads`, WebP 1280px via ImageMagick); `/image-api/v1/{w}/{h}/{id}` on-demand resize with disk cache (Rust now emits AVIF); CDN `cdn.nhadat.city`. |
| Auth | NextAuth v4: Google OAuth, Google One Tap, email+password. Roles: `admin` / `user` only. Admin = JWT; no API keys. In-memory rate limiter. |
| Jobs (PM2 on .241) | `nhadat-cron`: scrapers 02:00-05:30 (puppeteer-stealth, Node), ML retrain 06:00, Google Indexing 06:30; indexing worker (`indexing_queue`, Google Indexing + IndexNow, 441 rows); seo-monitor scripts (external cron, unverified); IMAP email sync; web push; `tran-nhung` AI agent (SDD 09: dropped). ML: `nhadat-ml` FastAPI (XGBoost/KNN) on :8001. |
| API (Next) | ~85 routes: admin ~30 (used by `admin-ui`, React 19 SPA), public listing/project/stat/geo/map, user (post-listing, upload, profile), AI chat, sitemaps. Web only; no mobile app or extension. |
| Prod serving | Cloudflare → HAProxy → Varnish 210-215. Since 2026-10-24: default → Rust `nhadat-web` (241:3005, askama, no JS) for `/`, `/mua-ban`, `/cho-thue`, `/{prov}[/{ward}[/{id}/{slug}]]`, sitemaps, image-api; Astro (192:3000) for gia-dat, quy-hoach, sap-nhap-hanh-chinh, du-an, cong-cu, phap-ly, ma-loai-dat, map-api, api. Next (241:3000) only behind legacy backend (admin.nhadat.city, ws). Repo VCL is stale vs prod. |
| Rust crate | single crate `nhadat-rs`: pages + `/api/v1` (search, overview, tools, geo, tiles proxy). Migrations 001-007 applied by hand. R1 code lives on `feat/rust-r1` (worktree), this checkout has different uncommitted work. |
| Astro | 37 pages; calls Rust API over HTTP; islands: cadastral map (748 lines vanilla), 6 calculators. |
| SEO | ~985k listing URLs `/{prov}/{ward}/{short_id}/{slug}`, ~200 sitemap files (listing chunks of 5 000). 3 322 ward + 34 province hubs, 83 project pages, 187 user pages, ~1 100 static. GSC 90 d: 1 601 URLs with impressions, 122 clicks, 4 307 impressions (tiny, long tail). Impressions: listing detail 77%, `/user` 7%, province hub 6%, ward hub 5%, du-an 4%, home 3%. Redirects: 5-seg → 4-seg (308), 3-seg → `/all/`, `/realestate/{id}`, mongo ids, api./map-api. hosts. |

## 2. Mapping to quorvo

| Part | Target | Note |
|---|---|---|
| HTTP API, errors, ETag, rate limits, metrics | `quorvo-http` `/api/v1`, camelCase, cursors, views (`card`, `detail`) | replaces Next API + `nhadat-rs/api.rs`. Contract-first `openapi.json`. |
| Ids | `short_id` becomes `public_id` of listing (no internal id/mongo id on wire) | needs the id/URL-shape answer (NEEDS). Legacy mongo ids resolve in the SEO/redirect layer only. |
| DB | same `nhadat_city`; app tables untouched; quorvo tables additive (`quorvo_*`) through merged migrator | back up before each migration deploy (rule 17). PG 16 vs "18 tested" to verify. Hand-applied SQL migrations 001-007 move into the app migrator. |
| Auth | `quorvo-auth`: Google OIDC + email codes; roles `admin`, `editor`; API keys for the scraper/service principals | passwords not migrated; users matched by verified email at first sign-in (app-side link table). One Tap = a client of the same OIDC flow, to verify. |
| Jobs/cron | `quorvo-jobs` (alpha.8 cron + dedupe + in-process runner): scraper schedule, ML retrain trigger, indexing submission, sitemap refresh, image backfill | covered by alpha.8, no need filed. Dedupe key = listing source URL. |
| Scraper | worker over the HTTP worker contract | puppeteer needs Node/Chrome: conflicts with rule 14 (see Q3). |
| ML | `nhadat-ml` stays a separate Python HTTP service called by the API/worker | allowed (rule 13 spirit); no change. |
| Files/images | `quorvo-files` disk backend adopting existing tree; variants | gap: on-demand variants (NEEDS). |
| Events/SSE | not needed initially (maybe admin dashboards, scrape progress) | |
| Cache | `quorvo-cache` replaces Redis (rule 11); Varnish stays at the edge | Redis removed after statistics/tiles move. |
| Maps | `quorvo-geo` (planned) + GeoServer raster stays | NEEDS. Until then tile/parcel/cluster routes stay in app code. |
| Web (rule 22) | one Vite multi-page build, SolidJS islands, `quorvo-client/-sync/-ui`, Paraglide (vi only), handlebars partials, Tauri not needed | replaces Next pages, Astro, `admin-ui`. |
| Crawler pages (rule 25) | see Q1 | gap: SSR (NEEDS #1). |
| Search | app SQL (unaccent/trigram/tsvector) behind `?q=` filters | works; nice-to-have helpers. |
| Push, email, IMAP sync | `quorvo-notify` email; web push app-side or dropped; IMAP sync dropped/ask | |
| tran-nhung agent, chat widget | dropped (SDD 09 R7) | |

## 3. Phased plan (old and new side by side; indexed URLs never change; cutover last)

Every phase: Varnish path-by-path routing, parity check on the GSC 150 + sitemap sample, rollback = `vcl.use` previous. No phase starts without the owner's go; migrations/ETL/deploys need explicit approval.

- **Q0 Decisions** (this document): answer §4.
- **Q1 Foundation (no traffic).** New Cargo workspace (`domain`, `api`, `worker`, `web`), quorvo alpha.8 git deps, `.env.example`, merged migrator, hardened systemd unit on a new port next to `nhadat-web`, AGENTS.md quorvo snippet. DB: add `public_id` (= `short_id` copy, unique) and quorvo tables on a **clone first** (staging DB from `nhadat_city` dump), then prod after backup. Done when: `openapi.json` committed, health + readiness, CI gate.
- **Q2 Read API.** Resources: listings (`card`, `detail`), regions (province/ward), projects, articles, stats, land codes, banks. Reuse the SQL of `nhadat-rs/web/repo`. Public-facing: `/api/v1` served by quorvo app. R1 Rust pages keep running, unchanged. Done when: API results equal R1 page data on sampled URLs; load test at current peak.
- **Q3 Tools + content pages as Vite/Solid MPA.** Replace Astro: calculators (`cong-cu`, 6 islands + VN2000), then `gia-dat`/`quy-hoach`/`sap-nhap`/`ma-loai-dat`/`phap-ly`/`du-an` (pages are a finite set: 34 provinces + 3 322 wards × a few types → generated from page data at build time with data baked into the handlebars context, i.e. real HTML, per ADR 0023). Routed from Varnish path by path; Astro retired when all are served. Measure per ADR 0009 (GSC coverage, URL Inspection) 4 weeks per batch, canary on provinces first.
- **Q4 Jobs/worker.** Cron + workers: scrapers, indexing (Google/IndexNow), sitemap data refresh, ML retrain trigger, image variant backfill/cache. Old PM2 cron stays until each job has run in parallel (dry-run/idempotent via dedupe keys) and compared. Scraper answer Q3 first.
- **Q5 Auth + user features.** `quorvo-auth`, post-listing + image upload (Solid pages), profile, my listings, admin as Solid pages (replace `admin-ui`), roles, audit. Legacy-user email linking. Low traffic → low risk.
- **Q6 Maps.** After `quorvo-geo` (NEEDS): main map, project map, address picker, parcel lookup on MapLibre islands (lazy import), tokens, clusters; GeoServer remains.
- **Q6b Index policy (before Q7; owner: Google treats the 985k listings as junk).** Stop treating 985k URLs as an asset. Decide, with the owner, an explicit policy and apply it by page state, not by deleting data: `index` only listings with a unique value block, enough content and recent activity, plus all hubs and content pages; `noindex,follow` for scraped duplicates/old; `410` for dead/junk; sitemaps list only indexable URLs (the 150 GSC URLs and every URL with clicks are always kept). Measure on GSC "crawled, not indexed" and indexed-page count over 4-8 weeks per batch. This replaces SDD 09's "keep all 985k indexed URLs"; 301 rules for legacy ids stay. Needs owner approval of the policy and each batch (prod-facing); nothing applied yet.
- **Q7 Record + hub pages (curated set after Q6b, previously 985k).** Depends on quorvo SSR. Until then R1 askama pages serve them unchanged (interim, frozen). When quorvo ships SSR (or the owner accepts the CSR measurement window of ADR 0009), parity-test and switch by path (provinces → wards → records in the same order as SDD 09). Never 301 a record to a hub; sold = 200; junk = 410; sitemaps unchanged.
- **Q8 Data & infra cutover, decommission.** Files adoption/copy off .241 local disk (to S3 or a shared disk), Redis removed, Mongo removed (SDD 08 P7), Next/Astro/PM2 stopped one by one after 2-4 weeks of zero traffic, repo VCL committed to match prod. Final step, last.

Quorvo sequencing (2026-10-24, quorvo session): the SSR study waits until quorvo's CSR client work is done. The next alpha delivers the multi-page catalog, island helpers, native login, flexible URL templates (ADR 0014 amendment) and declared totals. So: Q1/Q2/Q4 (API, jobs) can start on alpha.9; **Q3, Q5, Q6 web parts wait for that alpha** (no island helpers before); Q7 (SSR) is last, askama stays frozen as the interim crawler source until then.

Rough order of risk-to-value: Q1 → Q2 → Q4/Q3 in parallel → Q5 → Q6 → Q7 → Q8. Q6b/Q7 are the only phases that can hurt SEO and is deliberately last and gated.

## 4. Owner decision (2026-10-24): comply with quorvo

Owner: "tuân thủ quorvo để có web sạch". The target web is exactly the quorvo stack: one Vite multi-page build, SolidJS islands, no Astro, no askama/Rust-rendered HTML, no Node in production, no exceptions. Consequences:
- Q1 (askama) is answered by this: askama pages are **interim only**, kept so crawlers keep getting HTML until quorvo's SSR ruling, then retired. They get no new features and no new pages.
- SEO evidence (GSC 90 d 122 clicks; Googlebot ~0.2% of pages/day; GA4 empty) means little traffic is at risk by following the rule; the real checks are indexed-page count and AI/Bing crawlers, which do not run JS well.
- Record pages (Q7) use the ADR 0023 record-page pattern; the soft-404 gap (always 200) is quorvo's open SSR item and a gating risk for Q7 only.
- Scraper: Chrome driven from a Rust or Python worker over the HTTP worker contract (quorvo-confirmed allowed), no Node/puppeteer.

Remaining questions (1 is answered above):

1. **Rust askama pages vs the Solid-only rule (rule 22/25).** Rule 25 allows server-rendered crawler pages only from a "separate SEO client of the public API" and quorvo has no SSR yet; the Rust R1 pages (live, 0 KB JS) serve 77% of impressions and 985k URLs. Options: **A (recommended)** keep askama as the app's SEO client (own crate/binary, Rust, no Node), move its data access to the public API, use it until quorvo ships SSR, then replace; **B** replace by Solid CSR pages now (high SEO risk on 985k URLs, no measurement baseline); **C** keep askama permanently (needs an exception to rule 25 from the quorvo session). Which?
2. ~~URL shape~~ Answered: quorvo to support fully app-defined URL templates; only `:id-:slug` is mandatory where a record page needs it. Keep current URLs for the curated indexable set.
3. **Scraper** (quorvo: a Chrome-driving worker in Rust or Python over the HTTP worker contract is allowed; Node/puppeteer in production is not). It needs a real headless browser (puppeteer-stealth, Node). Rule 14 bans Node in production. Allow an exception, replace with a Rust browser driver (e.g. chromiumoxide, still Chrome), or drop puppeteer-based sources and keep API-only ones?
4. **Legacy users (60k).** OK to drop password login and link accounts by verified Google/email sign-in?
5. **Web push, IMAP sync, AI chat widget**: drop?
6. ~~PostgreSQL 16~~ quorvo says 16 should work and will test it; no upgrade needed. Resolved.
7. Start Q1 with a staging DB clone on .186 (read from prod dump), OK?

## 4b. Lowercased legacy ids (quorvo ruling: new public ids are lowercase base36; parsing accepts mixed case)

Measured on prod (read-only, 2026-10-24): 984k legacy `short_id` (mixed-case base62). **341 lowercase-collision groups (682 rows)** where two ids differ only by case; 36 262 ids are already all-lowercase. Quorvo's adopted-column lookup tries exact match first, then `lower(id)`: one hit = 301 to canonical, several = "ambiguous", the app decides.

Policy (owner ruling relayed by the quorvo session, 2026-10-24; replaces the earlier proposal):
1. An exact-case match wins and resolves to its own record.
2. A case-insensitive match that hits several records answers **410**. No ranking, no redirect target.
3. New records get lowercase ids only.
4. The 682 colliding legacy listings *may* be retired (unpublish or delete). This is a production data change: nothing is run now. Before it: backup of `real_estates` rows involved, and the owner confirms the actual run in this session. Retiring them also makes rule 2 moot for those ids.
Quorvo's helper returns all candidates and does no tie-break; the rule above lives in the app.

## 5. Risks

- quorvo alpha: breaking changes each tag; stay ≤ 2 alphas behind (rule 20).
- SSR gap makes Q7 depend on another team; mitigation = option A.
- Quorvo `public_id` on a 984k table + 26 indexes: add as a nullable column copied from `short_id`, then unique index concurrently.
- GSC baseline is tiny (122 clicks / 90 d): measurement windows (ADR 0009) are noisy; rely on indexed-page count and coverage, not clicks.
- GA4 was removed in R1 (no analytics); measurement needs server logs or a replacement.
