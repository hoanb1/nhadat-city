-- 005: auxiliary / small app tables migrated from MongoDB (SDD 08 §3). Idempotent.
-- Depends on 004 (users, real_estates, f_unaccent).

-- ===== master data: propertyTypes, directions, legalDocumentTypes, roadTypes, dynamicFields =====
-- Admin "master-data/[collection]" API -> allow-list of kinds (property_type|direction|legal_doc_type|road_type|dynamic_field)
CREATE TABLE IF NOT EXISTS master_data (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind        TEXT NOT NULL,
    mongo_id    TEXT NOT NULL,            -- e.g. 'dat_dau_gia', 'tay_bac' (stable code used by listings)
    name        TEXT NOT NULL,
    description TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,   -- Mongo `order` (int or string)
    type        TEXT,                         -- 'all' / checkbox / ...
    fields      JSONB NOT NULL DEFAULT '[]'::jsonb,  -- propertyTypes.fields[], dynamicFields.values[]
    extra       JSONB NOT NULL DEFAULT '{}'::jsonb,  -- icon, unit, placeholder
    UNIQUE (kind, mongo_id)
);

-- ===== districts (read-only, quy-hoach + sitemap + geoService) =====
CREATE TABLE IF NOT EXISTS districts (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mongo_id           TEXT UNIQUE,
    code               INTEGER,
    type               TEXT,
    name               TEXT NOT NULL,
    code_name          TEXT NOT NULL,          -- slug
    province_code      INTEGER,
    province_code_name TEXT
);
CREATE INDEX IF NOT EXISTS idx_districts_province_code ON districts (province_code);
CREATE INDEX IF NOT EXISTS idx_districts_code_name     ON districts (code_name);
CREATE INDEX IF NOT EXISTS idx_districts_prov_slug     ON districts (province_code_name, code_name);

-- ===== blog =====
CREATE TABLE IF NOT EXISTS blog_posts (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mongo_id         TEXT UNIQUE,
    slug             TEXT NOT NULL UNIQUE,
    title            TEXT NOT NULL,
    author           TEXT,
    summary          TEXT,
    content          TEXT,                 -- HTML
    status           TEXT NOT NULL DEFAULT 'published',
    category         TEXT,
    tags             TEXT[] NOT NULL DEFAULT '{}',
    faqs             JSONB NOT NULL DEFAULT '[]'::jsonb,
    source           TEXT,
    target_keyword   TEXT,
    meta_title       TEXT,
    meta_description TEXT,
    views            INTEGER NOT NULL DEFAULT 0,
    word_count       INTEGER,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ,
    extra            JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_created ON blog_posts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category       ON blog_posts (category);

-- ===== map layers: mapLayers -> planning_layers (001, id = Mongo _id, 32 rows) + map_layer_types =====
ALTER TABLE planning_layers ADD COLUMN IF NOT EXISTS mongo_id TEXT;
ALTER TABLE planning_layers ADD COLUMN IF NOT EXISTS type_id TEXT;            -- mapLayers.type -> map_layer_types.mongo_id
ALTER TABLE planning_layers ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE planning_layers ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE planning_layers ADD COLUMN IF NOT EXISTS opacity INTEGER NOT NULL DEFAULT 100;
ALTER TABLE planning_layers ADD COLUMN IF NOT EXISTS saturation INTEGER;
ALTER TABLE planning_layers ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE planning_layers ADD COLUMN IF NOT EXISTS geoserver_layer TEXT;
ALTER TABLE planning_layers ADD COLUMN IF NOT EXISTS auto_load BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE planning_layers ADD COLUMN IF NOT EXISTS visible BOOLEAN;
ALTER TABLE planning_layers ADD COLUMN IF NOT EXISTS active_type BOOLEAN;
ALTER TABLE planning_layers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;   -- ETL: mapLayers.createdAt is date OR string
ALTER TABLE planning_layers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE planning_layers ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb;
UPDATE planning_layers SET mongo_id = id WHERE mongo_id IS NULL;               -- 001/06 ETL stored Mongo _id in id
CREATE UNIQUE INDEX IF NOT EXISTS uq_planning_layers_mongo_id ON planning_layers (mongo_id);
CREATE INDEX IF NOT EXISTS idx_planning_layers_type ON planning_layers (type_id);

CREATE TABLE IF NOT EXISTS map_layer_types (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mongo_id   TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    parent_id  TEXT,
    active     BOOLEAN NOT NULL DEFAULT TRUE,
    auto_show  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ
);

-- ===== indexing =====
CREATE TABLE IF NOT EXISTS indexing_queue (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mongo_id            TEXT UNIQUE,
    url                 TEXT NOT NULL,
    type                TEXT,                         -- URL_UPDATED ...
    status              TEXT NOT NULL DEFAULT 'PENDING',
    priority            INTEGER NOT NULL DEFAULT 1,
    retry_count         INTEGER NOT NULL DEFAULT 0,
    attempts            INTEGER NOT NULL DEFAULT 0,
    next_attempt_at     TIMESTAMPTZ,
    google_submitted_at TIMESTAMPTZ,
    source              TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    extra               JSONB NOT NULL DEFAULT '{}'::jsonb
);
-- worker: SELECT ... WHERE status='PENDING' AND (next_attempt_at IS NULL OR next_attempt_at<=now()) ORDER BY priority, created_at FOR UPDATE SKIP LOCKED
CREATE INDEX IF NOT EXISTS idx_indexing_queue_poll ON indexing_queue (status, next_attempt_at, priority);
CREATE INDEX IF NOT EXISTS idx_indexing_queue_url  ON indexing_queue (url);   -- not UNIQUE: Mongo url_1 was not unique

CREATE TABLE IF NOT EXISTS indexing_logs (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mongo_id    TEXT UNIQUE,
    url         TEXT,
    engine      TEXT,                              -- GOOGLE / BING / INDEXNOW
    provider    TEXT,
    status      TEXT,
    http_status INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- Mongo `timestamp`
    extra       JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_indexing_logs_created  ON indexing_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_indexing_logs_provider ON indexing_logs (provider, created_at DESC);

-- ===== scraping / AI logs =====
CREATE TABLE IF NOT EXISTS scraping_logs (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mongo_id       TEXT UNIQUE,
    target         TEXT,
    status         TEXT,
    started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at       TIMESTAMPTZ,
    items_scraped  INTEGER NOT NULL DEFAULT 0,
    errors         INTEGER NOT NULL DEFAULT 0,
    duration_limit INTEGER,
    extra          JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_scraping_logs_started ON scraping_logs (started_at DESC);

CREATE TABLE IF NOT EXISTS ai_logs (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mongo_id    TEXT UNIQUE,
    action      TEXT,
    provider    TEXT,
    model       TEXT,
    tokens_used INTEGER,
    session_id  TEXT,
    prompt      TEXT,
    response    TEXT,
    tools_used  TEXT[] NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created ON ai_logs (created_at DESC);

-- ===== analytics / config =====
CREATE TABLE IF NOT EXISTS analytics_daily (
    day      DATE PRIMARY KEY,                   -- Mongo _id 'YYYY-MM-DD'
    views    INTEGER NOT NULL DEFAULT 0,
    visitors INTEGER NOT NULL DEFAULT 0
);
-- app_config: analytics_overview ('global_overview'), ai_config ('ai_config:router'), future key/value settings
CREATE TABLE IF NOT EXISTS app_config (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS seo_keywords (        -- 0 docs in Mongo, code reads it (sort by volume)
    id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mongo_id  TEXT UNIQUE,
    keyword   TEXT NOT NULL,
    volume    INTEGER NOT NULL DEFAULT 0,
    extra     JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_seo_keywords_volume ON seo_keywords (volume DESC);

-- ===== cache (rebuildable; ETL may skip data) =====
CREATE TABLE IF NOT EXISTS api_cache (
    key        TEXT PRIMARY KEY,                 -- e.g. nearby_16.5492_107.4161_2000
    data       JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- Mongo updatedAt = epoch ms double
    expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache (expires_at);

-- ===== user-facing =====
CREATE TABLE IF NOT EXISTS notifications (       -- ~503k email-notification records
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mongo_id         TEXT UNIQUE,
    real_estate_mongo_id TEXT,
    email_address    TEXT,                       -- PII
    subject          TEXT,
    content          TEXT,
    email_sent       BOOLEAN NOT NULL DEFAULT FALSE,
    opened_count     INTEGER NOT NULL DEFAULT 0,
    clicked_count    INTEGER NOT NULL DEFAULT 0,
    last_view_count  INTEGER,
    tracking_id      TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- coalesce(timestamp, createdAt)
    extra            JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_notifications_created  ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_tracking ON notifications (tracking_id);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mongo_id        TEXT UNIQUE,
    endpoint        TEXT NOT NULL UNIQUE,
    keys            JSONB NOT NULL,              -- {p256dh, auth}  (secret-ish)
    expiration_time TIMESTAMPTZ,
    user_id         BIGINT REFERENCES users(id) ON DELETE CASCADE,
    user_mongo_id   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mongo_id      TEXT UNIQUE,
    user_id       BIGINT REFERENCES users(id) ON DELETE CASCADE,
    user_mongo_id TEXT,
    title         TEXT,
    messages      JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{id, role, content, image?}] (images are base64: large)
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions (user_mongo_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_uid  ON chat_sessions (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS user_ai_preferences (   -- code-only (0 docs in Mongo); key = session.user.id or email
    user_key    TEXT PRIMARY KEY,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- re_comments: merges Mongo `comments` (legacy, 11) + `reComments` (code-only, anonymous comments on listings)
CREATE TABLE IF NOT EXISTS re_comments (
    id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mongo_id                 TEXT UNIQUE,
    real_estate_mongo_id     TEXT NOT NULL,        -- listingId / realEstateId (route param = mongo_id or short_id)
    real_estate_id           BIGINT REFERENCES real_estates(id) ON DELETE CASCADE,
    user_id                  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    user_mongo_id            TEXT,
    name                     TEXT,
    content                  TEXT NOT NULL,
    parent_comment_mongo_id  TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_re_comments_listing ON re_comments (real_estate_mongo_id, created_at DESC);

CREATE TABLE IF NOT EXISTS messages (            -- Mongo `messages` (109 user<->user chat; admin interactions)
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mongo_id             TEXT UNIQUE,
    real_estate_mongo_id TEXT,
    sender_mongo_id      TEXT NOT NULL,
    receiver_mongo_id    TEXT NOT NULL,
    sender_id            BIGINT REFERENCES users(id) ON DELETE SET NULL,
    receiver_id          BIGINT REFERENCES users(id) ON DELETE SET NULL,
    message              TEXT NOT NULL,
    read                 BOOLEAN NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()   -- Mongo `timestamp`
);
CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages (receiver_mongo_id, sender_mongo_id);

CREATE TABLE IF NOT EXISTS reports (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mongo_id      TEXT UNIQUE,
    post_mongo_id TEXT NOT NULL,                 -- reported listing (mongo_id)
    reported_by   TEXT,
    reason        TEXT,
    details       TEXT,
    client_info   JSONB NOT NULL DEFAULT '{}'::jsonb,   -- ip, userAgent (PII)
    reviewed      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports (created_at DESC);

CREATE TABLE IF NOT EXISTS help_requests (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mongo_id        TEXT UNIQUE,
    name            TEXT,
    description     TEXT,
    location        TEXT,
    longitude       DOUBLE PRECISION,
    latitude        DOUBLE PRECISION,
    requester       JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Mongo `user` {id,name}
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiration_date TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_help_requests_created ON help_requests (created_at DESC);

CREATE TABLE IF NOT EXISTS campaigns (           -- Mongo stored fields nested under `name.*`; ETL flattens
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mongo_id    TEXT UNIQUE,
    name        TEXT,
    location    TEXT,
    description TEXT,
    start_date  DATE,                            -- stored as string in Mongo
    end_date    DATE,
    status      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    extra       JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_campaigns_created ON campaigns (created_at DESC);

CREATE TABLE IF NOT EXISTS emails (              -- admin mailbox cache (lib/emailSync.ts), code-only (not in Mongo dump)
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mongo_id    TEXT UNIQUE,
    folder      TEXT NOT NULL,                   -- inbox | sent
    uid         BIGINT NOT NULL,
    message_id  TEXT,
    subject     TEXT,
    from_addrs  JSONB NOT NULL DEFAULT '[]'::jsonb,
    to_addrs    JSONB NOT NULL DEFAULT '[]'::jsonb,
    date        TIMESTAMPTZ,
    text        TEXT,
    html        TEXT,
    synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    extra       JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (folder, uid)                         -- upsert key used by syncEmailsForFolder
);
CREATE INDEX IF NOT EXISTS idx_emails_folder_date ON emails (folder, date DESC);
