-- ETL bookkeeping tables (not app tables; created by run.js, safe to re-run).
CREATE TABLE IF NOT EXISTS etl_checkpoints (
    collection text PRIMARY KEY,
    last_id    text,                 -- 's:<string id>' | 'o:<objectid hex>'
    rows       bigint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS etl_short_id_remap (
    collection   text NOT NULL,
    mongo_id     text NOT NULL,
    old_short_id text NOT NULL,
    new_short_id text NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (collection, mongo_id)
);
CREATE TABLE IF NOT EXISTS etl_errors (
    id         bigserial PRIMARY KEY,
    collection text NOT NULL,
    mongo_id   text,
    error      text NOT NULL,
    doc        jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_etl_errors_coll ON etl_errors (collection);
