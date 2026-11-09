-- 006: secondary indexes for real_estates / real_estate_images / users-adjacent lookups.
-- Separate from 004 so the ETL can bulk-load first (fast), then run this file. Idempotent.
-- Prod: run each statement with CREATE INDEX CONCURRENTLY if tables are live (cannot run inside a transaction).
-- Kept = only access paths used by lib/db/realEstate.ts, statistics.ts, sitemaps, scraper, image-api (28 Mongo indexes -> 16 below).

-- geo ($geoWithin / map clusters / nearby)
CREATE INDEX IF NOT EXISTS idx_re_geom ON real_estates USING GIST (geom);
-- default listing: status>=1 + image, ORDER BY created_at DESC LIMIT n (Mongo createdAt_-1 / status_1_createdAt_-1)
CREATE INDEX IF NOT EXISTS idx_re_public_created ON real_estates (created_at DESC) WHERE status >= 1 AND first_image IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_re_status_created ON real_estates (status, created_at DESC);
-- admin-unit filters (+ counts, sitemap group-by, statistics $match)
CREATE INDEX IF NOT EXISTS idx_re_prov      ON real_estates (province_slug, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_re_prov_type ON real_estates (province_slug, status, property_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_re_dist      ON real_estates (district_slug, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_re_dist_price ON real_estates (district_slug, property_type, status, total_price, created_at DESC);  -- similar listings by price band
CREATE INDEX IF NOT EXISTS idx_re_ward      ON real_estates (ward_slug, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_re_ward_type ON real_estates (ward_slug, property_type, created_at DESC) WHERE status >= 1;  -- same_area
-- ownership / seller
CREATE INDEX IF NOT EXISTS idx_re_user_id    ON real_estates (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_re_user_mongo ON real_estates (user_mongo_id) WHERE user_mongo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_re_source     ON real_estates (source_mongo_id, status, created_at DESC) WHERE source_mongo_id IS NOT NULL;
-- scraper dedupe
CREATE INDEX IF NOT EXISTS idx_re_source_url  ON real_estates (source_url) WHERE source_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_re_source_code ON real_estates (source_code) WHERE source_code IS NOT NULL;
-- sitemap delta (updatedAt/createdAt >= threshold)
CREATE INDEX IF NOT EXISTS idx_re_updated ON real_estates (updated_at DESC) WHERE status >= 1;
-- full text ($text replacement); query: search_tsv @@ plainto_tsquery('simple', f_unaccent(:q))
CREATE INDEX IF NOT EXISTS idx_re_tsv ON real_estates USING GIN (search_tsv);

-- images
CREATE INDEX IF NOT EXISTS idx_rei_re_mongo ON real_estate_images (real_estate_mongo_id);
CREATE INDEX IF NOT EXISTS idx_rei_re_id    ON real_estate_images (real_estate_id) WHERE real_estate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rei_unprocessed ON real_estate_images (id) WHERE processed IS NOT TRUE;  -- meta.processed_1 (scraper image worker)

-- re_comments / messages / notifications FK-style lookups live in 005.

-- short-query search fallback: f_unaccent(title) ILIKE f_unaccent('%q%')  (lib/db/realEstate.ts, lib/db/project.ts)
CREATE INDEX IF NOT EXISTS idx_re_title_unaccent_trgm ON real_estates USING GIN (public.f_unaccent(title) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_projects_title_unaccent_trgm ON projects USING GIN (public.f_unaccent(title) gin_trgm_ops);
