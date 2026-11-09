# Needs for quorvo

Pinned: `v0.1.0-alpha.9`. Written 2026-10-24 from the inventory in [sdd/10_QUORVO_INTEGRATION_PLAN.md](sdd/10_QUORVO_INTEGRATION_PLAN.md). Generic wording only (CONSUMER_RULES §1.3). Checked against alpha.8 (alpha.9 adds only ErrorMapper, job retention, per-scope key usage; none of the needs below): cron schedules, job dedupe keys and the in-process runner are now covered and are not listed as needs.

## Crawler HTML for a very large number of record pages
- Need: a site with ~985 000 indexable record pages (growing ~150/day) lives on search traffic (77% of impressions are record pages). Each record URL must return a crawler-ready HTML document with the record's own title, description, canonical, structured data (JSON-LD), visible content and internal links, within a budget of ~12 KB compressed and TTFB < 100 ms on a cache hit. Build-time generation of every record is not feasible (size, daily churn); it needs on-demand render + HTTP cache, or incremental generation.
- Also needed from that layer: the **HTTP status is decided by the record**: 200, 301 to the canonical URL (stale slug, legacy id), 410 (removed), 404, and 200 with a "no longer available" state (noindex). ADR 0023's "one page document + rewrite" always answers 200 and turns every missing record into a soft-404.
- Also: paginated list pages (`?page=N`, numbered, with a total) as real crawlable documents for hubs (region → sub-region → records); sitemap index + chunks of 5 000 URLs generated from the database with real `lastmod`; a push of changed URLs to IndexNow / Google Indexing after create/update.
- Today: Rust askama server-rendered pages behind Varnish (live since 2026-10-24, no JS), outside quorvo. Cost: a second rendering stack that rule 22/25 does not allow long-term.
- Proposal: input to the quorvo SSR study (ADR 0009 / `quorvo-seo`): a render service in Rust (no Node) that is a client of the public API, templated HTML, cached by the HTTP cache with surrogate keys (`xkey`) for per-record purge. We do not propose a solution app-side.
- Scale note (2026-10-24): the owner reports Google treats the ~985k scraped listing URLs as junk. The app will shrink the indexable set (see plan Q7: index policy), so the need is per-record status + crawler HTML for a *curated, much smaller* set (hubs ~3.4k + selected records), not 985k. The status-code requirement is unchanged.
- Priority: soon (was blocker; drops once the indexable set is curated).
- Status: accepted as input to the quorvo SSR study (real per-record status required); interim: current askama pages keep serving crawlers, no new SEO renderer (2026-10-24, quorvo session).

## Flexible URL templates; `:id-:slug` only where required
- Need (owner decision 2026-10-24): quorvo must let the app design its URLs. The only mandatory part is the `:id-:slug` (or id) segment of a record URL, and only where a record page needs it. Everything else is app-defined: prefix segments (`/{region}/{subregion}/...`), `-` or `/` between id and slug, hub and list URLs, no resource-name segment. The server stays the canonical-path source of truth (ADR 0014), via an app-declared template instead of a fixed `/{resource}/{id}-{slug}`.
- Also: `PublicIdSpec` may adopt an existing column of shorter ids (6-char base62, ~985k rows, immutable) whose `LEN` is below `min_len`; new inserts keep the retry-on-conflict rule.
- Today: app keeps its own `short_id` column and builds paths itself; existing indexed URL is `/{region}/{subregion}/{id}/{slug}`.
- Priority: soon.
- Status: accepted (quorvo alpha.10, N5 + ADR 0024): app-declared URL template (only `:id-:slug` fixed); public id modes Random and Sequential (adopted column starts above the largest existing id, so 6-char ids are kept).

## `quorvo-geo`: PostGIS helpers and vector tiles
- Need (optional module already planned in DESIGN §3.1): (1) typed query helpers on `quorvo-db`: bbox filter, radius filter (geography), polygon contains, point-in-polygon lookup against a polygon table, `ST_AsGeoJSON` output with simplification by zoom; (2) MVT endpoint: `/api/v1/tiles/{layer}/{z}/{x}/{y}.pbf` from a registered layer (table or query, geometry column, attribute allow-list, min/max zoom, simplification), ETag + long `Cache-Control`; (3) server-side clustering of points per tile / zoom for ~1M points (bbox query returns clusters, then points at high zoom); (4) token-gated tiles: short-TTL (minutes) HMAC token, per-layer "token required" flag; (5) a pass-through of a raster tile service (WMS/WMTS from an external GeoServer) with the same token gate and cache headers.
- Today: raster tiles proxied from GeoServer through Next/Rust, bbox/polygon SQL written by hand, no vector tiles, clusters computed in SQL per request.
- Proposal: `quorvo-geo` crate as described above; data stays in the app's PostGIS tables.
- Priority: soon (blocks the map phase; not the first phases).
- Status: accepted as planned optional module with its own ADR; quorvo asks for tile QPS and points per zoom (not measured yet, see plan Q6) (2026-10-24, quorvo session).

## Instant, on-demand image variants for a large existing corpus
- Need: alpha.8 produces AVIF variants as an async job after upload (`202`). The app needs (a) `GET` of a variant by `(image key, width, height)` that renders on first request and serves from a disk cache afterwards (6.5 M existing images; pre-generating every size is not wanted), restricted to an allow-list of sizes, `immutable` caching; (b) adopting an existing directory of originals as a `quorvo-files` disk store (keys derived from existing ids, no copy); (c) fallbacks for legacy URLs with a different extension.
- Today: ImageMagick `convert` spawned per request, results cached on disk (`/image-api/v1/{w}/{h}/{id}.avif`).
- Proposal: a sync, cached variant route in `quorvo-images` / `quorvo-http`, using the pure-Rust encoder on a blocking pool with a concurrency cap.
- Priority: soon.
- Status: accepted: adopting an existing image tree = Track H of N5 (alpha.10, flat-key/tree namespace on disk and S3, range reads, no copy); on-demand cached AVIF GET comes later on top of it (2026-10-24, quorvo session).

## Search over free text and filters
- Need: Postgres text search with Vietnamese diacritics: `unaccent` + trigram (`pg_trgm`) title search and an existing `tsvector` column, combined with equality / range filters (region, type, price, area) and a stable sort that is not unique (newest, price). Keyset cursors over such sorts, and an optional declared **total** (exact or estimated) for list endpoints, because list pages show counts. DESIGN §4 says "no totals unless declared"; this is the declaration.
- Today: raw SQL in the app (`f_unaccent(title) ILIKE`, partial indexes); works.
- Proposal: `quorvo-db` keyset helper that takes an ordered list of sort columns with tie-breaker, and a documented pattern for declared totals; unaccent/trigram helpers can stay app-side.
- Priority: nice to have.
- Status: accepted, folded into page-total docs (declared totals + non-unique-sort keyset) (2026-10-24, quorvo session).

## Edge purge by surrogate key
- Need: DESIGN §4 emits `xkey` surrogate keys; the app runs Varnish (6 nodes) and Cloudflare. A documented/shipped hook that turns a write (record changed, removed, region re-aggregated) into a ban/purge request for the keys of the affected pages (record page, its list pages, sitemap chunk).
- Today: manual bans and TTLs (`s-maxage` 60 s to 1 h).
- Proposal: a purge port in `quorvo-cache`/`quorvo-http` with an HTTP-ban implementation, fed from the same transaction as the write (like events).
- Priority: nice to have.
- Status: accepted as planned CDN surrogate-key purge, later (2026-10-24, quorvo session).

## Web push (VAPID)
- Need: send browser web-push notifications (VAPID keys, subscription store) from a job. `quorvo-notify` is email only.
- Today: `web-push` in Node; 503k notification rows exist, usage unknown.
- Priority: nice to have (may be dropped by the owner).
- Status: accepted as planned quorvo-notify channel, later (2026-10-24, quorvo session).

## Not needs (stay in the app)
Listing domain, price/valuation rules, moderation, scraping (headless browser), indexing queue logic, ML client, importing 60 k legacy users (matched by verified email at first sign-in; legacy password hashes are not migrated, quorvo stores none).

## To verify with the quorvo session
- PostgreSQL 16.15 + PostGIS 3.4.2: quorvo uses no 17/18-only SQL; will run its suite once on 16 and document the minimum. No upgrade planned for quorvo.
