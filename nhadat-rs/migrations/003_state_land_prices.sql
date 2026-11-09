-- 003: state_land_prices (drift fix).
-- Rust code (nhadat-rs/src/api.rs, db.rs::StateLandPrice) queries this table, but it was in neither
-- 001 nor the prod DB `nhadat_city` (verified read-only 2026-10-23: table absent; the API swallows the
-- error via unwrap_or_default so the street-price block is silently empty).
-- DDL derived from struct StateLandPrice + the two queries (province/ward lookup, unaccent street search).
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS state_land_prices (
    id           SERIAL PRIMARY KEY,
    province_slug TEXT NOT NULL,
    ward_slug     TEXT NOT NULL,
    street_name   TEXT NOT NULL,
    segment_from  TEXT NOT NULL DEFAULT '',
    segment_to    TEXT NOT NULL DEFAULT '',
    vt1_price     DOUBLE PRECISION NOT NULL DEFAULT 0,   -- trieu dong / m2
    vt2_price     DOUBLE PRECISION NOT NULL DEFAULT 0,
    vt3_price     DOUBLE PRECISION NOT NULL DEFAULT 0,
    vt4_price     DOUBLE PRECISION NOT NULL DEFAULT 0,
    market_vt1    DOUBLE PRECISION NOT NULL DEFAULT 0,
    k_ratio       DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_slp_prov_ward   ON state_land_prices (province_slug, ward_slug);
CREATE INDEX IF NOT EXISTS idx_slp_street_trgm ON state_land_prices USING GIN (street_name gin_trgm_ops);
