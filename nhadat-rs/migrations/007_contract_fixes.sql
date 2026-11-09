-- 007: contract fixes found while aligning app code <-> schema <-> ETL. Idempotent (safe to re-run).
-- The 3 index statements at the bottom are heavy on real_estates: on a live prod DB run them one by one as
-- CREATE INDEX CONCURRENTLY (cannot run inside a transaction), same as 006.

-- districts.province_name: Mongo districts have no ProvinceName field (always NULL; consumers fall back to the slug,
-- exactly like the old `d.ProvinceName || d.ProvinceCodeName`).
ALTER TABLE districts ADD COLUMN IF NOT EXISTS province_name TEXT;

-- indexing_logs.success: one explicit representation shared by writer (indexingEngine), reader (adminIndexing) and ETL.
ALTER TABLE indexing_logs ADD COLUMN IF NOT EXISTS success BOOLEAN;
UPDATE indexing_logs
   SET success = COALESCE(
         CASE WHEN extra->>'success' IN ('true', 'false') THEN (extra->>'success')::boolean END,
         lower(coalesce(status, '')) IN ('success', 'ok', 'submitted', 'sent', 'done'))
 WHERE success IS NULL;

-- indexing_queue: lowercase status everywhere, url unique (enqueue = INSERT .. ON CONFLICT (url) DO UPDATE)
ALTER TABLE indexing_queue ALTER COLUMN status SET DEFAULT 'pending';
UPDATE indexing_queue SET status = lower(status) WHERE status <> lower(status);
DELETE FROM indexing_queue q
 USING indexing_queue k
 WHERE q.url = k.url AND q.id <> k.id
   AND (k.updated_at, k.id) > (q.updated_at, q.id);          -- keep the latest row per url
CREATE UNIQUE INDEX IF NOT EXISTS uq_indexing_queue_url ON indexing_queue (url);
DROP INDEX IF EXISTS idx_indexing_queue_url;                  -- superseded by the unique index

-- push_subscriptions lookup by user (lib/pushManager.ts)
CREATE INDEX IF NOT EXISTS idx_push_subs_user_mongo ON push_subscriptions (user_mongo_id) WHERE user_mongo_id IS NOT NULL;

-- ===== heavy real_estates indexes (run after bulk load; CONCURRENTLY on live prod) =====
-- app/api/user/listings: lower(contact->>'email') = $email
CREATE INDEX IF NOT EXISTS idx_re_contact_email ON real_estates (lower(contact->>'email')) WHERE contact->>'email' IS NOT NULL;
-- sitemap paging: ORDER BY created_at DESC, id DESC OFFSET n (status>=1 AND first_image IS NOT NULL)
CREATE INDEX IF NOT EXISTS idx_re_sitemap_page ON real_estates (created_at DESC, id DESC) WHERE status >= 1 AND first_image IS NOT NULL;
-- admin scraping dashboard: count(*) WHERE is_scraped
CREATE INDEX IF NOT EXISTS idx_re_is_scraped ON real_estates (id) WHERE is_scraped;
