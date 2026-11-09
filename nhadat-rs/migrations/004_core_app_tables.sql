-- 004: core app tables migrated from MongoDB (SDD 08 §3): users, real_estates, real_estate_images, projects (ALTER).
-- Run order: 004 -> 005 -> (ETL bulk load) -> 006 (heavy indexes). Idempotent (IF NOT EXISTS).
-- Conventions: mongo_id = original _id as text (Meteor string or ObjectId hex); NULL allowed for rows created natively in PG.
--              typed columns = fields the code filters/sorts/joins on; everything else -> extra jsonb.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- IMMUTABLE wrapper so unaccent() can be used in generated columns / expression indexes.
CREATE OR REPLACE FUNCTION public.f_unaccent(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- ===== users (Meteor accounts) =====
-- Login (app/api/auth/[...nextauth]/route.ts): lookup by email (lower-cased), then
--   bcrypt.compareSync( sha256hex(plainPassword), password_hash )   [Meteor client pre-hashes with SHA-256]
-- password_hash = Mongo services.password.bcrypt, copied verbatim (no re-hash, hash format is unchanged).
-- NEVER copy services.resume.loginTokens, services.*.accessToken/idToken, password reset/enroll tokens.
CREATE TABLE IF NOT EXISTS users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mongo_id      TEXT UNIQUE,
    short_id      TEXT,
    username      CITEXT UNIQUE,
    email         CITEXT UNIQUE,                    -- primary (emails[0].address)
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    emails        CITEXT[] NOT NULL DEFAULT '{}',   -- all addresses (Meteor emails[].address), GIN below
    password_hash TEXT,                             -- Meteor bcrypt of sha256hex(password); NULL for OAuth-only users
    name          TEXT,
    phone         TEXT,
    address       TEXT,
    avatar_url    TEXT,
    roles         TEXT[] NOT NULL DEFAULT '{user}', -- folded from Mongo role-assignment / users.roles ('admin','super-admin',...)
    google_id     TEXT UNIQUE,                      -- services.google.id
    facebook_id   TEXT UNIQUE,                      -- services.facebook.id
    oauth         JSONB NOT NULL DEFAULT '{}'::jsonb, -- services.google/facebook minus tokens (email, name, picture...)
    profile       JSONB NOT NULL DEFAULT '{}'::jsonb, -- consultant, followed, favorites, gender, activityType, isSubscribed...
    login_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    online        BOOLEAN,
    last_seen_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ,
    extra         JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_users_short_id ON users (short_id);
CREATE INDEX IF NOT EXISTS idx_users_emails   ON users USING GIN (emails);

-- ===== real_estates (Mongo realEstate, ~985k) =====
-- Only PK/UNIQUE here so bulk load is fast; secondary + GIN/GIST indexes are in 006.
-- Public listing predicate used everywhere in code: status >= 1 AND first_image IS NOT NULL.
CREATE TABLE IF NOT EXISTS real_estates (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mongo_id       TEXT UNIQUE,                    -- Meteor string id OR ObjectId hex (mixed in Mongo)
    short_id       TEXT UNIQUE,                    -- public URL id. NOTE: Mongo shortId was random & not unique -> ETL must de-dupe
    slug           TEXT,
    status         SMALLINT NOT NULL DEFAULT 1,    -- 0..4; public = >=1 (985,222 rows are 2)
    listing_mode   TEXT,                           -- 'ban' (default when NULL) / 'thue'
    property_type  TEXT,
    title          TEXT NOT NULL DEFAULT '',
    description    TEXT NOT NULL DEFAULT '',
    area           DOUBLE PRECISION,               -- max 7.8e7
    price          NUMERIC(20,2),                  -- max 8.9e14
    total_price    NUMERIC(20,2),                  -- code uses COALESCE(total_price, price)
    price_per_m2   NUMERIC(20,2),                  -- max 2.2e13
    legal_docs     TEXT,
    direction      TEXT,
    address        TEXT,
    province_slug  TEXT,                           -- adminunit.* (2025 admin units)
    district_slug  TEXT,
    ward_slug      TEXT,
    old_address    TEXT,
    old_province_slug TEXT,                        -- oldadminunit.* (pre-merge)
    old_district_slug TEXT,
    old_ward_slug  TEXT,
    longitude      DOUBLE PRECISION,
    latitude       DOUBLE PRECISION,
    geom           GEOMETRY(Point,4326),           -- ST_MakePoint(coordinates[0], coordinates[1]); NULL if empty/invalid
    images         TEXT[] NOT NULL DEFAULT '{}',   -- RealEstateImages ids; images[1] = thumbnail
    first_image    TEXT GENERATED ALWAYS AS (NULLIF(images[1], '')) STORED,
    thumbnail_url  TEXT,
    contact        JSONB NOT NULL DEFAULT '{}'::jsonb, -- name, phone, email, address, fullName, phones[]  (PII)
    user_id        BIGINT REFERENCES users(id) ON DELETE SET NULL,  -- NULL for orphans / unresolved
    user_mongo_id  TEXT,                           -- coalesce(userId, contact.userId); kept for orphans + ETL resolve
    source_mongo_id TEXT,                          -- source._id (same-seller query)
    source_url     TEXT,
    source_type    TEXT,
    source_code    BIGINT,
    user_type      TEXT,
    is_scraped     BOOLEAN NOT NULL DEFAULT FALSE,
    views          INTEGER NOT NULL DEFAULT 0,
    post_duration  INTEGER,
    dynamic_fields JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{_id:'bedrooms', value:3}, ...]
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ,
    posted_at      TIMESTAMPTZ,
    published_at   TIMESTAMPTZ,
    expire_at      TIMESTAMPTZ,                    -- ETL: map 1970-01-01 sentinel to NULL
    search_tsv     TSVECTOR GENERATED ALWAYS AS (
                     to_tsvector('simple', public.f_unaccent(coalesce(title,'') || ' ' || coalesce(description,'')))
                   ) STORED,
    extra          JSONB NOT NULL DEFAULT '{}'::jsonb  -- location{}, oldaddress extras, bedrooms.., priceLabel, importKey, advantages, ...
);

-- ===== real_estate_images (Mongo RealEstateImages, ~6.5M, metadata only; files stay on disk) =====
CREATE TABLE IF NOT EXISTS real_estate_images (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mongo_id       TEXT UNIQUE,                    -- Meteor-Files id (referenced by real_estates.images[])
    real_estate_mongo_id TEXT,                     -- meta.realEstateId
    real_estate_id BIGINT REFERENCES real_estates(id) ON DELETE SET NULL,  -- resolved in ETL pass 2 (NULL = orphan)
    name           TEXT,
    ext            TEXT,
    mime           TEXT,
    size_bytes     BIGINT,
    path           TEXT,                           -- raw/preprocess path
    original_path  TEXT,                           -- versions.original.path (served webp)
    original_width  INTEGER,
    original_height INTEGER,
    preprocess_path TEXT,
    processed      BOOLEAN,                        -- meta.processed
    source_url     TEXT,                           -- meta.source
    user_mongo_id  TEXT,
    upload_date    DATE,                           -- meta.uploadDate
    created_at     TIMESTAMPTZ,
    meta           JSONB NOT NULL DEFAULT '{}'::jsonb  -- importKey, importId, title, description, versions.*.size ...
);

-- ===== projects: already exists in 001 (4,551 rows, loaded by scripts/etl/04) -> add the missing columns =====
ALTER TABLE projects ADD COLUMN IF NOT EXISTS mongo_id TEXT;   -- backfill in ETL by matching short_id
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS district_slug TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS legacy_province_slug TEXT;  -- original adminunit.province (001 stores the 2025-mapped slug)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_types TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS investor_logo_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS original_images TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS property_type TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_scraped BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS completion_time TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_time TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS construction_progress JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sale_policy JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS juridical JSONB NOT NULL DEFAULT '{}'::jsonb;  -- 001 legal_summary kept for text
ALTER TABLE projects ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb;  -- price,totalPrice,area,originalTitle/Description ...
ALTER TABLE projects ADD COLUMN IF NOT EXISTS search_tsv TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', public.f_unaccent(
      coalesce(title,'') || ' ' || coalesce(trade_name,'') || ' ' || coalesce(address,'') || ' ' ||
      coalesce(investor_name,'') || ' ' || coalesce(description,'')))
) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_mongo_id ON projects (mongo_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_short_id ON projects (short_id);  -- prod verified: 4551 distinct short_id
CREATE INDEX IF NOT EXISTS idx_projects_district ON projects (district_slug);
CREATE INDEX IF NOT EXISTS idx_projects_created ON projects (published_at DESC NULLS LAST, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_investor_trgm ON projects USING GIN (investor_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_projects_tsv ON projects USING GIN (search_tsv);
