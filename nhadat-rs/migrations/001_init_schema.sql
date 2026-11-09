-- NhaDat.City v2.0 PostgreSQL + PostGIS Master Schema (SSOT)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Provinces 2025 (34 Post-Merger Provinces/Cities)
CREATE TABLE IF NOT EXISTS provinces_2025 (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    ma_tinh TEXT,
    ma_tinh_bnv TEXT,
    area_km2 DOUBLE PRECISION DEFAULT 0,
    population BIGINT DEFAULT 0,
    merged_from TEXT DEFAULT '',
    admin_center TEXT DEFAULT '',
    legacy_slugs TEXT[] DEFAULT '{}',
    crs_proj4 TEXT DEFAULT '',
    central_meridian DOUBLE PRECISION DEFAULT 105.0,
    lat DOUBLE PRECISION NOT NULL DEFAULT 21.0285,
    lon DOUBLE PRECISION NOT NULL DEFAULT 105.8542,
    ward_count INT DEFAULT 0,
    project_count INT DEFAULT 0,
    median_price_m2 DOUBLE PRECISION DEFAULT 0,
    sample_count INT DEFAULT 0,
    geom GEOMETRY(Geometry, 4326)
);
CREATE INDEX IF NOT EXISTS idx_provinces_2025_geom ON provinces_2025 USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_provinces_2025_legacy ON provinces_2025 USING GIN (legacy_slugs);

-- 2. Legacy 63 Provinces & Official VN2000 Central Meridians (BTNMT Standard)
CREATE TABLE IF NOT EXISTS legacy_provinces_63 (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    new_province_slug TEXT NOT NULL,
    central_meridian DOUBLE PRECISION NOT NULL,
    epsg_3deg INT NOT NULL,
    epsg_6deg INT NOT NULL,
    region TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_legacy_provinces_new_slug ON legacy_provinces_63 (new_province_slug);

-- 3. Wards / Communes 2025 (3,322 Post-Merger Administrative Units)
CREATE TABLE IF NOT EXISTS wards_2025 (
    id SERIAL PRIMARY KEY,
    province_slug TEXT NOT NULL,
    province_name TEXT NOT NULL,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    ma_xa TEXT,
    ma_xa_bnv TEXT,
    area_km2 DOUBLE PRECISION DEFAULT 0,
    population BIGINT DEFAULT 0,
    resolution_no TEXT DEFAULT '',
    merged_from TEXT DEFAULT '',
    legacy_slugs TEXT[] DEFAULT '{}',
    lat DOUBLE PRECISION NOT NULL DEFAULT 0,
    lon DOUBLE PRECISION NOT NULL DEFAULT 0,
    median_price_m2 DOUBLE PRECISION DEFAULT 0,
    avg_price_m2 DOUBLE PRECISION DEFAULT 0,
    p25_price_m2 DOUBLE PRECISION DEFAULT 0,
    p75_price_m2 DOUBLE PRECISION DEFAULT 0,
    state_price_m2 DOUBLE PRECISION DEFAULT 0,
    sample_count INT DEFAULT 0,
    geom GEOMETRY(Geometry, 4326),
    UNIQUE (province_slug, slug)
);
CREATE INDEX IF NOT EXISTS idx_wards_2025_prov ON wards_2025 (province_slug);
CREATE INDEX IF NOT EXISTS idx_wards_2025_slug ON wards_2025 (slug);
CREATE INDEX IF NOT EXISTS idx_wards_2025_legacy ON wards_2025 USING GIN (legacy_slugs);
CREATE INDEX IF NOT EXISTS idx_wards_2025_name_trgm ON wards_2025 USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_wards_2025_geom ON wards_2025 USING GIST (geom);

-- 4. Land Use Types (52 Official Land Codes under Vietnam Land Law)
CREATE TABLE IF NOT EXISTS land_use_types (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    group_name TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    is_residential BOOLEAN DEFAULT FALSE,
    max_term_text TEXT NOT NULL,
    legal_summary TEXT NOT NULL,
    buildable_guide TEXT NOT NULL,
    conversion_fee_rule TEXT NOT NULL
);

-- 5. Distilled Market Price Index (Aggregated from ~985k historical records)
CREATE TABLE IF NOT EXISTS market_price_index (
    id SERIAL PRIMARY KEY,
    province_slug TEXT NOT NULL,
    ward_slug TEXT NOT NULL DEFAULT '_all',
    property_type TEXT NOT NULL DEFAULT 'all',
    sample_count INT NOT NULL DEFAULT 0,
    median_price_m2 DOUBLE PRECISION NOT NULL DEFAULT 0,
    avg_price_m2 DOUBLE PRECISION NOT NULL DEFAULT 0,
    p25_price_m2 DOUBLE PRECISION NOT NULL DEFAULT 0,
    p75_price_m2 DOUBLE PRECISION NOT NULL DEFAULT 0,
    min_price_m2 DOUBLE PRECISION NOT NULL DEFAULT 0,
    max_price_m2 DOUBLE PRECISION NOT NULL DEFAULT 0,
    avg_total_price_billion DOUBLE PRECISION NOT NULL DEFAULT 0,
    avg_area_m2 DOUBLE PRECISION NOT NULL DEFAULT 0,
    state_price_m2 DOUBLE PRECISION NOT NULL DEFAULT 0,
    yoy_change_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (province_slug, ward_slug, property_type)
);
CREATE INDEX IF NOT EXISTS idx_mpi_prov_ward ON market_price_index (province_slug, ward_slug);

-- 6. Monthly Price History (Time-Series Intelligence)
CREATE TABLE IF NOT EXISTS price_history_monthly (
    province_slug TEXT NOT NULL,
    ward_slug TEXT NOT NULL DEFAULT '_all',
    year_month TEXT NOT NULL,
    sample_count INT NOT NULL DEFAULT 0,
    median_price_m2 DOUBLE PRECISION NOT NULL DEFAULT 0,
    avg_price_m2 DOUBLE PRECISION NOT NULL DEFAULT 0,
    PRIMARY KEY (province_slug, ward_slug, year_month)
);

-- 7. Real Estate Projects Encyclopedia (4,551 Projects)
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    short_id TEXT,
    title TEXT NOT NULL,
    trade_name TEXT DEFAULT '',
    province_slug TEXT NOT NULL,
    ward_slug TEXT DEFAULT '',
    address TEXT DEFAULT '',
    street_name TEXT DEFAULT '',
    investor_name TEXT DEFAULT '',
    investor_description TEXT DEFAULT '',
    project_type TEXT DEFAULT 'Khu đô thị / Dự án',
    total_apartments TEXT DEFAULT '',
    total_buildings TEXT DEFAULT '',
    total_floors TEXT DEFAULT '',
    total_area_text TEXT DEFAULT '',
    building_density TEXT DEFAULT '',
    ownership TEXT DEFAULT 'Sổ hồng lâu dài',
    status TEXT DEFAULT 'Đang cập nhật',
    banner_url TEXT DEFAULT '',
    utilities_summary TEXT DEFAULT '',
    location_summary TEXT DEFAULT '',
    legal_summary TEXT DEFAULT '',
    ref_price_m2 DOUBLE PRECISION DEFAULT 0,
    lat DOUBLE PRECISION NOT NULL DEFAULT 0,
    lon DOUBLE PRECISION NOT NULL DEFAULT 0,
    geom GEOMETRY(Point, 4326),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_projects_prov ON projects (province_slug);
CREATE INDEX IF NOT EXISTS idx_projects_ward ON projects (province_slug, ward_slug);
CREATE INDEX IF NOT EXISTS idx_projects_geom ON projects USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_projects_title_trgm ON projects USING GIN (title gin_trgm_ops);

-- 8. Bank Mortgage Interest Rates (For Financial Calculators & Programmatic Bank Pages)
CREATE TABLE IF NOT EXISTS bank_mortgage_rates (
    slug TEXT PRIMARY KEY,
    bank_name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    bank_group TEXT NOT NULL,
    promo_rate_6m DOUBLE PRECISION NOT NULL,
    promo_rate_12m DOUBLE PRECISION NOT NULL,
    promo_rate_24m DOUBLE PRECISION NOT NULL,
    floating_rate DOUBLE PRECISION NOT NULL,
    max_ltv_pct INT NOT NULL DEFAULT 70,
    max_term_years INT NOT NULL DEFAULT 25,
    early_repayment_fee TEXT NOT NULL,
    grace_period_months INT NOT NULL DEFAULT 12,
    notes TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Legal & Planning Articles (Cleaned of any external spam links)
CREATE TABLE IF NOT EXISTS legal_articles (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'phap-ly-quy-hoach',
    summary TEXT NOT NULL DEFAULT '',
    content_html TEXT NOT NULL DEFAULT '',
    faqs JSONB DEFAULT '[]'::jsonb,
    tags TEXT[] DEFAULT '{}',
    word_count INT DEFAULT 0,
    published_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_legal_articles_cat ON legal_articles (category);

-- 10. GIS Planning & Cadastral Layers Metadata
CREATE TABLE IF NOT EXISTS planning_layers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    province_slug TEXT DEFAULT 'toan-quoc',
    layer_type TEXT NOT NULL DEFAULT 'quy-hoach',
    format TEXT NOT NULL DEFAULT 'wms',
    tile_url TEXT NOT NULL,
    min_zoom INT DEFAULT 0,
    max_zoom INT DEFAULT 22,
    bbox JSONB DEFAULT '{}'::jsonb,
    active BOOLEAN DEFAULT TRUE
);
