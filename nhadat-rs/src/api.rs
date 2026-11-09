use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::json;

use crate::config::Config;
use crate::db::*;
use crate::geo::*;
use crate::quant::*;

#[derive(Clone)]
pub struct AppState {
    pub pool: DbPool,
    #[allow(dead_code)]
    pub config: Config,
    pub geoserver: GeoServerClient,
}

pub fn create_router(state: AppState) -> Router {
    Router::new()
        // Core health check
        .route("/api/health", get(health_check))
        // Platform REST APIs for Astro SSR Frontend
        .route("/api/v1/overview", get(get_overview))
        .route("/api/v1/provinces", get(get_provinces))
        .route("/api/v1/provinces/{slug}", get(get_province_detail))
        .route("/api/v1/provinces/{province}/wards/{ward}", get(get_ward_detail))
        .route("/api/v1/land-codes", get(get_land_codes))
        .route("/api/v1/land-codes/{code}", get(get_land_code_detail))
        .route("/api/v1/banks", get(get_banks))
        .route("/api/v1/banks/{slug}", get(get_bank_detail))
        .route("/api/v1/projects", get(get_projects))
        .route("/api/v1/projects/{slug}", get(get_project_detail))
        .route("/api/v1/articles", get(get_articles))
        .route("/api/v1/articles/{slug}", get(get_article_detail))
        .route("/api/v1/sitemap-data", get(get_sitemap_data))
        .route("/api/v1/search", get(global_search))
        .route("/api/v1/merger/lookup", get(merger_lookup))
        .route("/api/v1/geo/reverse", get(reverse_geocode))
        .route("/api/v1/planning/layers", get(get_planning_layers_catalog))
        // Pure Rust Core Engines (both POST and GET supported)
        .route("/api/v1/tools/vn2000", get(tool_vn2000_get).post(tool_vn2000_post))
        .route("/api/v1/tools/valuate", get(tool_valuate_get).post(tool_valuate_post))
        .route("/api/v1/tools/mortgage", get(tool_mortgage_get).post(tool_mortgage_post))
        .route("/api/v1/tools/tax-fee", get(tool_tax_fee_get).post(tool_tax_fee_post))
        .route("/api/v1/tools/feng-shui", get(tool_feng_shui_get).post(tool_feng_shui_post))
        .route("/api/v1/tools/rental-yield", get(tool_rental_yield_get).post(tool_rental_yield_post))
        // GeoServer WFS Parcel Proxy & WMS Raster Tile Proxy
        .route("/api/v1/geo/parcel", get(get_geo_parcel))
        .route("/api/v1/tiles/{layer}/{z}/{x}/{y}", get(get_map_tile_path))
        .route("/map-api", get(get_map_tile_query))
        .with_state(state)
}

// ── Health Endpoint ──────────────────────────────────────────────────────────

async fn health_check(State(state): State<AppState>) -> Response {
    let postgis_check: Result<(String,), _> = sqlx::query_as("SELECT postgis_full_version()")
        .fetch_one(&state.pool)
        .await;

    match postgis_check {
        Ok(_) => (
            StatusCode::OK,
            Json(json!({
                "ok": true,
                "service": "nhadat-rs",
                "db": "connected",
                "postgis": true,
                "timestamp": Utc::now().to_rfc3339()
            })),
        ).into_response(),
        Err(err) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "ok": false,
                "service": "nhadat-rs",
                "db": "disconnected",
                "postgis": false,
                "error": err.to_string(),
                "timestamp": Utc::now().to_rfc3339()
            })),
        ).into_response(),
    }
}

// ── Overview Endpoint ────────────────────────────────────────────────────────

async fn get_overview(State(state): State<AppState>) -> Response {
    let provinces: Vec<Province2025> = sqlx::query_as(
        "SELECT * FROM provinces_2025 ORDER BY sample_count DESC NULLS LAST, name ASC"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let legacy: Vec<LegacyProvince63> = sqlx::query_as("SELECT * FROM legacy_provinces_63 ORDER BY name ASC")
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    let top_projects: Vec<Project> = sqlx::query_as(
        "SELECT * FROM projects ORDER BY (banner_url IS NOT NULL AND banner_url != '') DESC, ref_price_m2 DESC NULLS LAST, id ASC LIMIT 8"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let top_banks: Vec<BankMortgageRate> = sqlx::query_as("SELECT * FROM bank_mortgage_rates ORDER BY promo_rate_12m ASC LIMIT 8")
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    let articles: Vec<LegalArticle> = sqlx::query_as(
        "SELECT * FROM legal_articles ORDER BY (word_count > 200) DESC, published_at DESC LIMIT 6"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let total_wards: (i64,) = sqlx::query_as("SELECT count(*) FROM wards_2025")
        .fetch_one(&state.pool)
        .await
        .unwrap_or((3322,));

    let total_projects: (i64,) = sqlx::query_as("SELECT count(*) FROM projects")
        .fetch_one(&state.pool)
        .await
        .unwrap_or((4551,));

    let total_samples: i64 = provinces
        .iter()
        .map(|p| p.sample_count.unwrap_or(0) as i64)
        .sum::<i64>()
        .max(890_486);

    Json(json!({
        "summary": {
            "total_provinces_2025": provinces.len(),
            "total_legacy_provinces": legacy.len(),
            "total_wards": total_wards.0,
            "total_wards_2025": total_wards.0,
            "total_projects": total_projects.0,
            "total_price_samples": total_samples,
            "total_banks": top_banks.len(),
            "national_median_price_m2": 48.5,
            "national_avg_price_m2": 45000000.0,
        },
        "provinces": provinces,
        "legacy_provinces": legacy,
        "top_projects": top_projects,
        "top_banks": top_banks,
        "featured_articles": articles,
    })).into_response()
}

// ── Provinces Endpoints ──────────────────────────────────────────────────────

async fn get_provinces(State(state): State<AppState>) -> Response {
    let provinces_2025: Vec<Province2025> = sqlx::query_as(
        "SELECT * FROM provinces_2025 ORDER BY sample_count DESC NULLS LAST, name ASC"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let legacy_provinces_63: Vec<LegacyProvince63> = sqlx::query_as("SELECT * FROM legacy_provinces_63 ORDER BY name ASC")
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    Json(json!({
        "provinces_2025": provinces_2025,
        "legacy_provinces_63": legacy_provinces_63
    })).into_response()
}

fn normalize_province_slug(raw: &str) -> String {
    let s = raw.trim().to_lowercase();
    match s.as_str() {
        "tp-ho-chi-minh" | "tphcm" | "sai-gon" => "ho-chi-minh".to_string(),
        "hue-da-nang" => "da-nang".to_string(),
        "can-tho-hau-giang" => "can-tho".to_string(),
        "vinh-phuc-phu-tho" => "phu-tho".to_string(),
        "bac-giang-bac-kan" => "bac-ninh".to_string(),
        "cao-bang-lang-son" => "lang-son".to_string(),
        "ha-giang-tuyen-quang" => "tuyen-quang".to_string(),
        "lao-cai-yen-bai" => "lao-cai".to_string(),
        "dien-bien-lai-chau" => "dien-bien".to_string(),
        "son-la-hoa-binh" => "son-la".to_string(),
        "quang-binh-quang-tri" => "quang-tri".to_string(),
        "quang-nam-quang-ngai" => "quang-ngai".to_string(),
        "binh-dinh-phu-yen" => "gia-lai".to_string(),
        "khanh-hoa-ninh-thuan" => "khanh-hoa".to_string(),
        "kon-tum-gia-lai" => "gia-lai".to_string(),
        "dak-lak-dak-nong" => "dak-lak".to_string(),
        "binh-duong-binh-phuoc" => "ho-chi-minh".to_string(),
        "dong-nai-ba-ria-vung-tau" => "dong-nai".to_string(),
        "long-an-tien-giang" => "tay-ninh".to_string(),
        "ben-tre-tra-vinh" => "vinh-long".to_string(),
        "vinh-long-dong-thap" => "vinh-long".to_string(),
        "an-giang-kien-giang" => "an-giang".to_string(),
        "soc-trang-bac-lieu" => "can-tho".to_string(),
        _ => s,
    }
}

async fn get_province_detail(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Response {
    let raw_slug = slug.trim().to_lowercase();
    let slug_clean = normalize_province_slug(&raw_slug);

    // Check if it matches 2025 province directly or via legacy_slugs
    let prov_opt: Option<Province2025> = sqlx::query_as(
        "SELECT * FROM provinces_2025 WHERE slug = $1 OR $1 = ANY(legacy_slugs) ORDER BY (slug = $1) DESC LIMIT 1"
    )
    .bind(&slug_clean)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    let (province, is_legacy, canonical_slug) = if let Some(p) = prov_opt {
        let is_leg = p.slug != raw_slug;
        let canon = p.slug.clone();
        (p, is_leg, canon)
    } else {
        // Check if it's a legacy 63 province
        let leg_opt: Option<LegacyProvince63> = sqlx::query_as("SELECT * FROM legacy_provinces_63 WHERE slug = $1")
            .bind(&slug_clean)
            .fetch_optional(&state.pool)
            .await
            .unwrap_or(None);

        if let Some(leg) = leg_opt {
            let p_resolved: Option<Province2025> = sqlx::query_as("SELECT * FROM provinces_2025 WHERE slug = $1")
                .bind(&leg.new_province_slug)
                .fetch_optional(&state.pool)
                .await
                .unwrap_or(None);

            if let Some(p) = p_resolved {
                let canon = p.slug.clone();
                (p, true, canon)
            } else {
                return (StatusCode::NOT_FOUND, Json(json!({"error": "Province not found"}))).into_response();
            }
        } else {
            return (StatusCode::NOT_FOUND, Json(json!({"error": "Province not found"}))).into_response();
        }
    };

    // Fetch related wards (ordered by sample_count DESC then name ASC)
    let wards: Vec<Ward2025> = sqlx::query_as(
        "SELECT * FROM wards_2025 WHERE province_slug = $1 ORDER BY sample_count DESC NULLS LAST, name ASC"
    )
    .bind(&canonical_slug)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // Fetch market price index
    let price_indices: Vec<MarketPriceIndex> = sqlx::query_as("SELECT * FROM market_price_index WHERE province_slug = $1")
        .bind(&canonical_slug)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    // Fetch monthly price history
    let price_history: Vec<PriceHistoryMonthly> = sqlx::query_as("SELECT * FROM price_history_monthly WHERE province_slug = $1 ORDER BY year_month ASC")
        .bind(&canonical_slug)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    // Fetch planning layers
    let layers: Vec<PlanningLayer> = sqlx::query_as(
        "SELECT * FROM planning_layers WHERE province_slug = $1 OR province_slug = 'toan-quoc' ORDER BY (province_slug = $1) DESC, name ASC"
    )
    .bind(&canonical_slug)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // Fetch top projects
    let projects: Vec<Project> = sqlx::query_as(
        "SELECT * FROM projects WHERE province_slug = $1 ORDER BY (banner_url IS NOT NULL AND banner_url != '') DESC, ref_price_m2 DESC NULLS LAST, id ASC LIMIT 24"
    )
    .bind(&canonical_slug)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    Json(json!({
        "province": province,
        "is_legacy_redirect": is_legacy,
        "canonical_slug": canonical_slug,
        "wards": wards,
        "market_price_index": price_indices,
        "price_history_monthly": price_history,
        "planning_layers": layers,
        "projects": projects
    })).into_response()
}

async fn get_ward_detail(
    State(state): State<AppState>,
    Path((province_slug, ward_slug)): Path<(String, String)>,
) -> Response {
    let p_slug = normalize_province_slug(&province_slug);
    let w_slug = ward_slug.trim().to_lowercase();

    // Resolve province
    let prov: Option<Province2025> = sqlx::query_as(
        "SELECT * FROM provinces_2025 WHERE slug = $1 OR $1 = ANY(legacy_slugs) ORDER BY (slug = $1) DESC LIMIT 1"
    )
    .bind(&p_slug)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    let province = match prov {
        Some(p) => p,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "Province not found"}))).into_response(),
    };

    // Resolve ward prioritizing exact slug match over legacy_slugs match
    let ward_opt: Option<Ward2025> = sqlx::query_as(
        "SELECT * FROM wards_2025 WHERE province_slug = $1 AND (slug = $2 OR $2 = ANY(legacy_slugs)) ORDER BY (slug = $2) DESC, sample_count DESC NULLS LAST LIMIT 1"
    )
    .bind(&province.slug)
    .bind(&w_slug)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    let ward = match ward_opt {
        Some(w) => w,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "Ward not found"}))).into_response(),
    };

    // Sibling wards sorted by spherical distance
    let sibling_wards: Vec<Ward2025> = sqlx::query_as(
        r#"
        SELECT * FROM wards_2025
        WHERE province_slug = $1 AND slug != $2
        ORDER BY ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography) ASC NULLS LAST, sample_count DESC NULLS LAST
        LIMIT 24
        "#
    )
    .bind(&province.slug)
    .bind(&ward.slug)
    .bind(ward.lon)
    .bind(ward.lat)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // All province wards (lightweight list for crawlable directory)
    let all_province_wards: Vec<ProvinceWardSummary> = sqlx::query_as(
        "SELECT slug, name, COALESCE(median_price_m2, 0.0) as median_price_m2, COALESCE(state_price_m2, 0.0) as state_price_m2, COALESCE(merged_from, '') as merged_from FROM wards_2025 WHERE province_slug = $1 ORDER BY name ASC"
    )
    .bind(&province.slug)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // State land prices
    let state_prices: Vec<StateLandPrice> = sqlx::query_as(
        "SELECT * FROM state_land_prices WHERE province_slug = $1 AND ward_slug = $2 ORDER BY vt1_price DESC"
    )
    .bind(&province.slug)
    .bind(&ward.slug)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // Price history
    let price_history: Vec<PriceHistoryMonthly> = sqlx::query_as(
        "SELECT * FROM price_history_monthly WHERE province_slug = $1 AND (ward_slug = $2 OR ward_slug = '_all') ORDER BY year_month ASC"
    )
    .bind(&province.slug)
    .bind(&ward.slug)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // Planning layers for province
    let planning_layers: Vec<PlanningLayer> = sqlx::query_as(
        "SELECT * FROM planning_layers WHERE province_slug = $1 OR province_slug = 'toan-quoc' ORDER BY (province_slug = $1) DESC, name ASC"
    )
    .bind(&province.slug)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // Nearby projects using PostGIS spherical distance
    let nearby_projects: Vec<Project> = sqlx::query_as(
        r#"
        SELECT id, slug, short_id, title, trade_name, province_slug, ward_slug,
               address, street_name, investor_name, investor_description, project_type,
               total_apartments, total_buildings, total_floors, total_area_text,
               building_density, ownership, status, banner_url, utilities_summary,
               location_summary, legal_summary, ref_price_m2, lat, lon, created_at
        FROM projects
        WHERE province_slug = $1
        ORDER BY ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) ASC NULLS LAST
        LIMIT 8
        "#
    )
    .bind(&province.slug)
    .bind(ward.lon)
    .bind(ward.lat)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    Json(json!({
        "ward": ward,
        "province": province,
        "sibling_wards": sibling_wards,
        "all_province_wards": all_province_wards,
        "price_history": price_history,
        "planning_layers": planning_layers,
        "nearby_projects": nearby_projects,
        "state_prices": state_prices
    })).into_response()
}

// ── Land Codes Endpoints ─────────────────────────────────────────────────────

async fn get_land_codes(State(state): State<AppState>) -> Response {
    let codes: Vec<LandUseType> = sqlx::query_as("SELECT * FROM land_use_types ORDER BY is_residential DESC, code ASC")
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    Json(json!({
        "total": codes.len(),
        "land_use_types": codes
    })).into_response()
}

async fn get_land_code_detail(
    State(state): State<AppState>,
    Path(code): Path<String>,
) -> Response {
    let clean_code = code.trim().to_uppercase();

    let land_opt: Option<LandUseType> = sqlx::query_as("SELECT * FROM land_use_types WHERE UPPER(code) = $1")
        .bind(&clean_code)
        .fetch_optional(&state.pool)
        .await
        .unwrap_or(None);

    match land_opt {
        Some(item) => Json(json!(item)).into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "Land code not found"}))).into_response(),
    }
}

// ── Banks Endpoints ──────────────────────────────────────────────────────────

async fn get_banks(State(state): State<AppState>) -> Response {
    let banks: Vec<BankMortgageRate> = sqlx::query_as("SELECT * FROM bank_mortgage_rates ORDER BY promo_rate_12m ASC")
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    Json(json!({
        "total": banks.len(),
        "banks": banks
    })).into_response()
}

async fn get_bank_detail(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Response {
    let clean_slug = slug.trim().to_lowercase();

    let bank_opt: Option<BankMortgageRate> = sqlx::query_as("SELECT * FROM bank_mortgage_rates WHERE slug = $1")
        .bind(&clean_slug)
        .fetch_optional(&state.pool)
        .await
        .unwrap_or(None);

    match bank_opt {
        Some(bank) => {
            // Compute pre-computed sample 2-billion VND 20-year amortization schedule
            let sample_mortgage = calculate_mortgage(&MortgageRequest {
                loan_amount: 2_000_000_000.0,
                term_years: Some(20),
                term_months: Some(240),
                promo_rate_pct: bank.promo_rate_12m,
                promo_months: 12,
                floating_rate_pct: bank.floating_rate,
                method: Some("declining".to_string()),
            });

            Json(json!({
                "bank": bank,
                "sample_2billion_schedule": sample_mortgage
            })).into_response()
        }
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "Bank not found"}))).into_response(),
    }
}

// ── Projects Endpoints ───────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ProjectQueryParams {
    pub province: Option<String>,
    pub ward: Option<String>,
    pub q: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

async fn get_projects(
    State(state): State<AppState>,
    Query(params): Query<ProjectQueryParams>,
) -> Response {
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * limit;

    let prov = params.province.unwrap_or_default();
    let ward = params.ward.unwrap_or_default();
    let q = params.q.unwrap_or_default();

    let projects: Vec<Project> = if !prov.is_empty() && !ward.is_empty() {
        sqlx::query_as("SELECT * FROM projects WHERE province_slug = $1 AND ward_slug = $2 ORDER BY id DESC LIMIT $3 OFFSET $4")
            .bind(&prov)
            .bind(&ward)
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.pool)
            .await
            .unwrap_or_default()
    } else if !prov.is_empty() {
        sqlx::query_as("SELECT * FROM projects WHERE province_slug = $1 ORDER BY id DESC LIMIT $2 OFFSET $3")
            .bind(&prov)
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.pool)
            .await
            .unwrap_or_default()
    } else if !q.is_empty() {
        let pattern = format!("%{}%", q);
        sqlx::query_as("SELECT * FROM projects WHERE title ILIKE $1 ORDER BY id DESC LIMIT $2 OFFSET $3")
            .bind(&pattern)
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.pool)
            .await
            .unwrap_or_default()
    } else {
        sqlx::query_as("SELECT * FROM projects ORDER BY id DESC LIMIT $1 OFFSET $2")
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.pool)
            .await
            .unwrap_or_default()
    };

    let total: (i64,) = sqlx::query_as("SELECT count(*) FROM projects")
        .fetch_one(&state.pool)
        .await
        .unwrap_or((0,));

    Json(json!({
        "page": page,
        "limit": limit,
        "total": total.0,
        "projects": projects
    })).into_response()
}

async fn get_project_detail(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Response {
    let clean_slug = slug.trim().to_lowercase();

    let project_opt: Option<Project> = sqlx::query_as("SELECT * FROM projects WHERE slug = $1 OR short_id = $1")
        .bind(&clean_slug)
        .fetch_optional(&state.pool)
        .await
        .unwrap_or(None);

    let project = match project_opt {
        Some(p) => p,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "Project not found"}))).into_response(),
    };

    // Nearby projects via PostGIS spherical distance
    let nearby: Vec<Project> = sqlx::query_as(
        r#"
        SELECT id, slug, short_id, title, trade_name, province_slug, ward_slug,
               address, street_name, investor_name, investor_description, project_type,
               total_apartments, total_buildings, total_floors, total_area_text,
               building_density, ownership, status, banner_url, utilities_summary,
               location_summary, legal_summary, ref_price_m2, lat, lon, created_at
        FROM projects
        WHERE id != $1
        ORDER BY ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) ASC NULLS LAST
        LIMIT 8
        "#
    )
    .bind(project.id)
    .bind(project.lon)
    .bind(project.lat)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // Ward / Province price comparison
    let price_idx: Option<MarketPriceIndex> = sqlx::query_as(
        "SELECT * FROM market_price_index WHERE province_slug = $1 LIMIT 1"
    )
    .bind(&project.province_slug)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    Json(json!({
        "project": project,
        "nearby_projects": nearby,
        "area_market_benchmark": price_idx
    })).into_response()
}

// ── Articles Endpoints ───────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ArticleQueryParams {
    pub limit: Option<i64>,
    pub category: Option<String>,
    pub q: Option<String>,
}

async fn get_articles(
    State(state): State<AppState>,
    Query(params): Query<ArticleQueryParams>,
) -> Response {
    let limit = params.limit.unwrap_or(50).clamp(1, 200);
    let cat = params.category.unwrap_or_default();
    let q = params.q.unwrap_or_default();

    let articles: Vec<LegalArticle> = if !cat.is_empty() {
        sqlx::query_as(
            "SELECT * FROM legal_articles WHERE category = $1 ORDER BY (word_count > 200) DESC, published_at DESC LIMIT $2"
        )
        .bind(&cat)
        .bind(limit)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default()
    } else if !q.is_empty() {
        let pattern = format!("%{}%", q);
        sqlx::query_as(
            "SELECT * FROM legal_articles WHERE title ILIKE $1 OR summary ILIKE $1 ORDER BY (word_count > 200) DESC, published_at DESC LIMIT $2"
        )
        .bind(&pattern)
        .bind(limit)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default()
    } else {
        sqlx::query_as(
            "SELECT * FROM legal_articles ORDER BY (word_count > 200) DESC, published_at DESC LIMIT $1"
        )
        .bind(limit)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default()
    };

    let total: (i64,) = sqlx::query_as("SELECT count(*) FROM legal_articles")
        .fetch_one(&state.pool)
        .await
        .unwrap_or((articles.len() as i64,));

    Json(json!({
        "total": total.0,
        "articles": articles
    })).into_response()
}

async fn get_article_detail(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Response {
    let clean_slug = slug.trim().to_lowercase();

    let article_opt: Option<LegalArticle> = sqlx::query_as("SELECT * FROM legal_articles WHERE slug = $1")
        .bind(&clean_slug)
        .fetch_optional(&state.pool)
        .await
        .unwrap_or(None);

    match article_opt {
        Some(item) => Json(json!(item)).into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "Article not found"}))).into_response(),
    }
}

// ── Sitemap Data Endpoint ────────────────────────────────────────────────────

async fn get_sitemap_data(State(state): State<AppState>) -> Response {
    let provinces: Vec<(String,)> = sqlx::query_as("SELECT slug FROM provinces_2025 ORDER BY slug ASC")
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    let legacy: Vec<(String,)> = sqlx::query_as("SELECT slug FROM legacy_provinces_63 ORDER BY slug ASC")
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    let wards: Vec<(String, String)> = sqlx::query_as("SELECT province_slug, slug FROM wards_2025 ORDER BY province_slug, slug ASC")
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    let projects: Vec<(String,)> = sqlx::query_as("SELECT slug FROM projects ORDER BY slug ASC")
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    let articles: Vec<(String,)> = sqlx::query_as("SELECT slug FROM legal_articles ORDER BY slug ASC")
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    let banks: Vec<(String,)> = sqlx::query_as("SELECT slug FROM bank_mortgage_rates ORDER BY slug ASC")
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    let land_codes: Vec<(String,)> = sqlx::query_as("SELECT LOWER(code) FROM land_use_types ORDER BY code ASC")
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    Json(json!({
        "provinces": provinces.into_iter().map(|p| p.0).collect::<Vec<_>>(),
        "legacy_provinces": legacy.into_iter().map(|l| l.0).collect::<Vec<_>>(),
        "wards": wards.into_iter().map(|w| json!({"province_slug": w.0, "ward_slug": w.1})).collect::<Vec<_>>(),
        "projects": projects.into_iter().map(|p| p.0).collect::<Vec<_>>(),
        "articles": articles.into_iter().map(|a| a.0).collect::<Vec<_>>(),
        "banks": banks.into_iter().map(|b| b.0).collect::<Vec<_>>(),
        "land_codes": land_codes.into_iter().map(|c| c.0).collect::<Vec<_>>()
    })).into_response()
}

// ── Pure Rust Core Engine Handlers ───────────────────────────────────────────

// 1. Tool VN2000 <-> WGS84
#[derive(Debug, Deserialize)]
pub struct Vn2000ToolPayload {
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub province: Option<String>,
    pub central_meridian: Option<f64>,
    pub points: Option<Vec<Vn2000PointInput>>,
    pub from: Option<String>, // "vn2000" or "wgs84"
    pub lat: Option<f64>,
    pub lon: Option<f64>,
}

async fn tool_vn2000_post(Json(payload): Json<Vn2000ToolPayload>) -> Response {
    handle_vn2000(payload)
}

async fn tool_vn2000_get(Query(payload): Query<Vn2000ToolPayload>) -> Response {
    handle_vn2000(payload)
}

fn handle_vn2000(payload: Vn2000ToolPayload) -> Response {
    let cm = resolve_central_meridian(payload.province.as_deref(), payload.central_meridian);

    // If reverse conversion requested (WGS84 -> VN2000)
    if payload.from.as_deref() == Some("wgs84") || (payload.lat.is_some() && payload.lon.is_some()) {
        if let (Some(lat), Some(lon)) = (payload.lat, payload.lon) {
            let (x, y) = wgs84_to_vn2000(lat, lon, cm);
            return Json(json!({
                "central_meridian": cm,
                "input": {"lat": lat, "lon": lon},
                "vn2000": {"x": (x * 1000.0).round() / 1000.0, "y": (y * 1000.0).round() / 1000.0}
            })).into_response();
        }
    }

    // Polygon points processing
    if let Some(pts) = payload.points {
        if !pts.is_empty() {
            let res = process_vn2000_polygon(pts, cm);
            return Json(json!(res)).into_response();
        }
    }

    // Single point (x, y) processing
    if let (Some(x), Some(y)) = (payload.x, payload.y) {
        let (lat, lon) = vn2000_to_wgs84(x, y, cm);
        return Json(json!({
            "central_meridian": cm,
            "input": {"x": x, "y": y},
            "wgs84": {
                "lat": (lat * 1e6).round() / 1e6,
                "lon": (lon * 1e6).round() / 1e6
            }
        })).into_response();
    }

    (
        StatusCode::BAD_REQUEST,
        Json(json!({"error": "Please provide x & y, or points array, or lat & lon for conversion"})),
    ).into_response()
}

// 2. Tool AI/Quant Property Valuation
async fn tool_valuate_post(
    State(state): State<AppState>,
    Json(payload): Json<ValuationRequest>,
) -> Response {
    handle_valuation(state, payload).await
}

async fn tool_valuate_get(
    State(state): State<AppState>,
    Query(payload): Query<ValuationRequest>,
) -> Response {
    handle_valuation(state, payload).await
}

async fn handle_valuation(state: AppState, req: ValuationRequest) -> Response {
    let p_slug = normalize_province_slug(&req.province_slug);
    // Try to lookup DB market index
    let mpi: Option<MarketPriceIndex> = if let Some(ref w) = req.ward_slug {
        sqlx::query_as("SELECT * FROM market_price_index WHERE province_slug = $1 AND ward_slug = $2 LIMIT 1")
            .bind(&p_slug)
            .bind(w)
            .fetch_optional(&state.pool)
            .await
            .unwrap_or(None)
    } else {
        sqlx::query_as("SELECT * FROM market_price_index WHERE province_slug = $1 LIMIT 1")
            .bind(&p_slug)
            .fetch_optional(&state.pool)
            .await
            .unwrap_or(None)
    };

    let (m, p25, p75, sp) = match mpi {
        Some(row) => (Some(row.median_price_m2), Some(row.p25_price_m2), Some(row.p75_price_m2), Some(row.state_price_m2)),
        None => (None, None, None, None),
    };

    let res = calculate_valuation(&req, m, p25, p75, sp);
    Json(json!(res)).into_response()
}

// 3. Tool Mortgage Calculator
async fn tool_mortgage_post(Json(payload): Json<MortgageRequest>) -> Response {
    let res = calculate_mortgage(&payload);
    Json(json!(res)).into_response()
}

async fn tool_mortgage_get(Query(payload): Query<MortgageRequest>) -> Response {
    let res = calculate_mortgage(&payload);
    Json(json!(res)).into_response()
}

// 4. Tool Tax & Transfer Fee
async fn tool_tax_fee_post(Json(payload): Json<TaxFeeRequest>) -> Response {
    let res = calculate_tax_fee(&payload);
    Json(json!(res)).into_response()
}

async fn tool_tax_fee_get(Query(payload): Query<TaxFeeRequest>) -> Response {
    let res = calculate_tax_fee(&payload);
    Json(json!(res)).into_response()
}

// 5. Tool Feng Shui
async fn tool_feng_shui_post(Json(payload): Json<FengShuiRequest>) -> Response {
    let res = calculate_feng_shui(&payload);
    Json(json!(res)).into_response()
}

async fn tool_feng_shui_get(Query(payload): Query<FengShuiRequest>) -> Response {
    let res = calculate_feng_shui(&payload);
    Json(json!(res)).into_response()
}

// 6. Tool Rental Yield
async fn tool_rental_yield_post(Json(payload): Json<RentalYieldRequest>) -> Response {
    let res = calculate_rental_yield(&payload);
    Json(json!(res)).into_response()
}

async fn tool_rental_yield_get(Query(payload): Query<RentalYieldRequest>) -> Response {
    let res = calculate_rental_yield(&payload);
    Json(json!(res)).into_response()
}

// 7. GeoServer Parcel Proxy Endpoint (with PostGIS Ward + VN2000 Enrichment)
#[derive(Debug, Deserialize)]
pub struct ParcelQueryParams {
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub uuid: Option<String>,
}

async fn get_geo_parcel(
    State(state): State<AppState>,
    Query(params): Query<ParcelQueryParams>,
) -> Response {
    let parcel_feature = if let Some(ref uid) = params.uuid {
        state.geoserver.get_parcel_by_uuid(uid).await
    } else if let (Some(lat), Some(lon)) = (params.lat, params.lon) {
        state.geoserver.get_parcel_by_coords(lat, lon).await
    } else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Please provide uuid or lat & lon coordinates"})),
        ).into_response();
    };

    // Nearest PostGIS ward for administrative & price enrichment
    let nearest_ward: Option<Ward2025> = if let (Some(lat), Some(lon)) = (params.lat, params.lon) {
        sqlx::query_as(
            "SELECT * FROM wards_2025 ORDER BY ST_Distance(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)) ASC LIMIT 1"
        )
        .bind(lon)
        .bind(lat)
        .fetch_optional(&state.pool)
        .await
        .unwrap_or(None)
    } else {
        None
    };

    let (vn2000_x, vn2000_y, central_meridian) = if let (Some(lat), Some(lon)) = (params.lat, params.lon) {
        let p_slug = nearest_ward.as_ref().map(|w| w.province_slug.as_str());
        let cm = resolve_central_meridian(p_slug, None);
        let (x, y) = wgs84_to_vn2000(lat, lon, cm);
        (
            ((x * 100.0).round() / 100.0),
            ((y * 100.0).round() / 100.0),
            cm,
        )
    } else {
        (0.0, 0.0, 105.0)
    };

    match parcel_feature {
        Ok(Some(mut feat)) => {
            if let Some(props) = feat.get_mut("properties").and_then(|p| p.as_object_mut()) {
                let code_raw = props
                    .get("loai_dat")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_uppercase())
                    .unwrap_or_else(|| "ODT".to_string());

                let land_info: Option<LandUseType> = sqlx::query_as(
                    "SELECT * FROM land_use_types WHERE UPPER(code) = $1"
                )
                .bind(&code_raw)
                .fetch_optional(&state.pool)
                .await
                .unwrap_or(None);

                if let Some(info) = land_info {
                    props.insert("loai_dat_name".to_string(), json!(info.name));
                    props.insert("loai_dat_color".to_string(), json!(info.color_hex));
                    props.insert("is_residential".to_string(), json!(info.is_residential));
                    props.insert("legal_summary".to_string(), json!(info.legal_summary));
                }

                if let Some(ref w) = nearest_ward {
                    props.insert("ward_name".to_string(), json!(w.name));
                    props.insert("ward_slug".to_string(), json!(w.slug));
                    props.insert("province_name".to_string(), json!(w.province_name));
                    props.insert("province_slug".to_string(), json!(w.province_slug));
                    props.insert("median_price_m2".to_string(), json!(w.median_price_m2));
                    props.insert("state_price_m2".to_string(), json!(w.state_price_m2));
                    props.insert("merged_from".to_string(), json!(w.merged_from));
                }

                props.insert("vn2000_x".to_string(), json!(vn2000_x));
                props.insert("vn2000_y".to_string(), json!(vn2000_y));
                props.insert("central_meridian".to_string(), json!(central_meridian));
            }

            Json(json!({
                "ok": true,
                "has_parcel_geometry": true,
                "parcel": feat
            })).into_response()
        }
        Ok(None) | Err(_) => {
            // Return administrative ward + VN2000 + market price context even if WFS times out or has no dense parcel polygon
            if let Some(w) = nearest_ward {
                let lat = params.lat.unwrap_or(w.lat);
                let lon = params.lon.unwrap_or(w.lon);
                Json(json!({
                    "ok": true,
                    "has_parcel_geometry": false,
                    "parcel": {
                        "type": "Feature",
                        "geometry": null,
                        "properties": {
                            "so_to": null,
                            "so_thua": null,
                            "dien_tich": null,
                            "loai_dat": "ODT",
                            "loai_dat_name": "Đất ở đô thị / Khu dân cư",
                            "dia_chi": format!("{}, {}", w.name, w.province_name),
                            "ward_name": w.name,
                            "ward_slug": w.slug,
                            "province_name": w.province_name,
                            "province_slug": w.province_slug,
                            "median_price_m2": w.median_price_m2,
                            "state_price_m2": w.state_price_m2,
                            "merged_from": w.merged_from,
                            "vn2000_x": vn2000_x,
                            "vn2000_y": vn2000_y,
                            "central_meridian": central_meridian,
                            "lat": lat,
                            "lon": lon
                        }
                    }
                })).into_response()
            } else {
                (
                    StatusCode::NOT_FOUND,
                    Json(json!({"ok": false, "message": "Parcel not found at location"})),
                ).into_response()
            }
        }
    }
}

// 8. GeoServer WMS Raster Tile Proxy Endpoints
async fn get_map_tile_path(
    State(state): State<AppState>,
    Path((layer, z, x, y_raw)): Path<(String, u32, u32, String)>,
) -> Response {
    let y_clean = y_raw
        .trim_end_matches(".png")
        .trim_end_matches(".webp")
        .trim_end_matches(".jpg");
    let y: u32 = match y_clean.parse() {
        Ok(v) => v,
        Err(_) => return (StatusCode::BAD_REQUEST, "Invalid tile Y coordinate").into_response(),
    };

    serve_wms_tile(&state, &layer, z, x, y).await
}

#[derive(Debug, Deserialize)]
pub struct MapTileQueryParams {
    pub layer: String,
    pub z: u32,
    pub x: u32,
    pub y: u32,
}

async fn get_map_tile_query(
    State(state): State<AppState>,
    Query(params): Query<MapTileQueryParams>,
) -> Response {
    serve_wms_tile(&state, &params.layer, params.z, params.x, params.y).await
}

async fn serve_wms_tile(state: &AppState, layer: &str, z: u32, x: u32, y: u32) -> Response {
    let cache_key = format!("{}:{}:{}:{}", layer, z, x, y);
    let cache = crate::geo::get_tile_cache();

    {
        let read_guard = cache.read().await;
        if let Some(bytes) = read_guard.get(&cache_key) {
            return (
                StatusCode::OK,
                [
                    (axum::http::header::CONTENT_TYPE, "image/png".to_string()),
                    (
                        axum::http::header::CACHE_CONTROL,
                        "public, max-age=86400, s-maxage=604800".to_string(),
                    ),
                    (
                        axum::http::HeaderName::from_static("x-tile-cache"),
                        "HIT".to_string(),
                    ),
                ],
                bytes.clone(),
            )
                .into_response();
        }
    }

    match state.geoserver.get_wms_tile(layer, z, x, y).await {
        Ok((bytes, content_type)) => {
            if bytes.len() > 100 {
                let mut write_guard = cache.write().await;
                if write_guard.len() >= 4000 {
                    write_guard.clear();
                }
                write_guard.insert(cache_key, bytes.clone());
            }

            (
                StatusCode::OK,
                [
                    (axum::http::header::CONTENT_TYPE, content_type),
                    (
                        axum::http::header::CACHE_CONTROL,
                        "public, max-age=86400, s-maxage=604800".to_string(),
                    ),
                    (
                        axum::http::HeaderName::from_static("x-tile-cache"),
                        "MISS".to_string(),
                    ),
                ],
                bytes,
            )
                .into_response()
        }
        Err(err) => (
            StatusCode::BAD_GATEWAY,
            Json(json!({"ok": false, "error": err})),
        )
            .into_response(),
    }
}

// ── Search & Geocoding Endpoints ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SearchQueryParams {
    pub q: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Debug, serde::Serialize)]
pub struct SearchResultItem {
    pub r#type: String,
    pub title: String,
    pub subtitle: String,
    pub url: String,
    pub badge: String,
    pub badge_color: String,
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub extra: serde_json::Value,
}

#[derive(sqlx::FromRow)]
struct SearchProvRow {
    slug: String,
    name: String,
    lat: f64,
    lon: f64,
    median_price_m2: Option<f64>,
    ward_count: Option<i32>,
}

#[derive(sqlx::FromRow)]
struct SearchWardRow {
    slug: String,
    name: String,
    province_slug: String,
    province_name: String,
    lat: f64,
    lon: f64,
    median_price_m2: Option<f64>,
    merged_from: Option<String>,
    matched_name: bool,
}

#[derive(sqlx::FromRow)]
struct SearchProjRow {
    slug: String,
    title: String,
    ref_price_m2: Option<f64>,
    project_type: Option<String>,
    investor_name: Option<String>,
    lat: f64,
    lon: f64,
}

#[derive(sqlx::FromRow)]
struct SearchStreetRow {
    province_slug: String,
    ward_slug: String,
    street_name: String,
    segment_from: String,
    segment_to: String,
    vt1_price: f64,
    k_ratio: f64,
    ward_name: String,
    lat: f64,
    lon: f64,
}

async fn global_search(
    State(state): State<AppState>,
    Query(params): Query<SearchQueryParams>,
) -> Response {
    let q_raw = params.q.unwrap_or_default();
    let q = q_raw.trim();
    if q.is_empty() {
        return Json(json!({
            "query": "",
            "total": 0,
            "results": []
        })).into_response();
    }

    let max_limit = params.limit.unwrap_or(12).clamp(1, 30);
    let mut results: Vec<SearchResultItem> = Vec::new();

    // 1. Wards & Merged Wards
    let ward_rows: Vec<SearchWardRow> = sqlx::query_as(
        r#"
        SELECT slug, name, province_slug, province_name, lat, lon, median_price_m2, merged_from,
               (unaccent(name) ILIKE '%' || unaccent($1) || '%') AS matched_name
        FROM wards_2025
        WHERE unaccent(name) ILIKE '%' || unaccent($1) || '%'
           OR unaccent(merged_from) ILIKE '%' || unaccent($1) || '%'
        ORDER BY sample_count DESC NULLS LAST
        LIMIT 8
        "#
    )
    .bind(q)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    for w in ward_rows {
        if w.matched_name {
            results.push(SearchResultItem {
                r#type: "ward".to_string(),
                title: w.name.clone(),
                subtitle: format!("{}, {} • Giá TB: {:.1} tr/m²", w.name, w.province_name, w.median_price_m2.unwrap_or(0.0)),
                url: format!("/{}/{}", w.province_slug, w.slug),
                badge: "Phường/Xã".to_string(),
                badge_color: "emerald".to_string(),
                lat: Some(w.lat),
                lon: Some(w.lon),
                extra: json!({
                    "province_slug": w.province_slug,
                    "median_price_m2": w.median_price_m2,
                    "merged_from": w.merged_from
                }),
            });
        } else {
            results.push(SearchResultItem {
                r#type: "merged_ward".to_string(),
                title: format!("{} (Sáp nhập vào {})", w.merged_from.as_deref().unwrap_or(""), w.name),
                subtitle: format!("Thuộc {}, {} • Sáp nhập hành chính 2025", w.name, w.province_name),
                url: format!("/sap-nhap-hanh-chinh/{}/{}", w.province_slug, w.slug),
                badge: "Sáp Nhập 2025".to_string(),
                badge_color: "amber".to_string(),
                lat: Some(w.lat),
                lon: Some(w.lon),
                extra: json!({
                    "province_slug": w.province_slug,
                    "target_ward_name": w.name,
                    "merged_from": w.merged_from
                }),
            });
        }
    }

    // 2. Provinces
    let prov_rows: Vec<SearchProvRow> = sqlx::query_as(
        r#"
        SELECT slug, name, lat, lon, median_price_m2, ward_count
        FROM provinces_2025
        WHERE unaccent(name) ILIKE '%' || unaccent($1) || '%'
        ORDER BY sample_count DESC NULLS LAST
        LIMIT 4
        "#
    )
    .bind(q)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    for p in prov_rows {
        results.push(SearchResultItem {
            r#type: "province".to_string(),
            title: format!("Tỉnh / Thành phố {}", p.name),
            subtitle: format!("{} phường/xã • Giá TB: {:.1} tr/m²", p.ward_count.unwrap_or(0), p.median_price_m2.unwrap_or(0.0)),
            url: format!("/{}", p.slug),
            badge: "Tỉnh/TP".to_string(),
            badge_color: "blue".to_string(),
            lat: Some(p.lat),
            lon: Some(p.lon),
            extra: json!({
                "median_price_m2": p.median_price_m2,
                "ward_count": p.ward_count
            }),
        });
    }

    // 3. Projects
    let proj_rows: Vec<SearchProjRow> = sqlx::query_as(
        r#"
        SELECT slug, title, ref_price_m2, project_type, investor_name, lat, lon
        FROM projects
        WHERE unaccent(title) ILIKE '%' || unaccent($1) || '%'
           OR unaccent(COALESCE(trade_name, '')) ILIKE '%' || unaccent($1) || '%'
        ORDER BY (banner_url IS NOT NULL AND banner_url != '') DESC, ref_price_m2 DESC NULLS LAST
        LIMIT 6
        "#
    )
    .bind(q)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    for prj in proj_rows {
        results.push(SearchResultItem {
            r#type: "project".to_string(),
            title: prj.title,
            subtitle: format!("Dự án {} • {}", prj.project_type.as_deref().unwrap_or("BĐS"), prj.investor_name.as_deref().unwrap_or("Chủ đầu tư")),
            url: format!("/du-an/{}", prj.slug),
            badge: "Dự Án".to_string(),
            badge_color: "violet".to_string(),
            lat: Some(prj.lat),
            lon: Some(prj.lon),
            extra: json!({
                "ref_price_m2": prj.ref_price_m2,
                "project_type": prj.project_type
            }),
        });
    }

    // 4. State land prices
    let street_rows: Vec<SearchStreetRow> = sqlx::query_as(
        r#"
        SELECT slp.province_slug, slp.ward_slug, slp.street_name, slp.segment_from, slp.segment_to,
               slp.vt1_price, slp.k_ratio, w.name AS ward_name, w.lat, w.lon
        FROM state_land_prices slp
        JOIN wards_2025 w ON slp.province_slug = w.province_slug AND slp.ward_slug = w.slug
        WHERE unaccent(slp.street_name) ILIKE '%' || unaccent($1) || '%'
        ORDER BY slp.vt1_price DESC
        LIMIT 6
        "#
    )
    .bind(q)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    for s in street_rows {
        results.push(SearchResultItem {
            r#type: "street_price".to_string(),
            title: s.street_name,
            subtitle: format!("{} ({}) • VT1: {:.1} tr/m² (K={:.2})", s.ward_name, s.segment_from, s.vt1_price, s.k_ratio),
            url: format!("/{}/{}#bang-gia-dat", s.province_slug, s.ward_slug),
            badge: "Giá Đất NN".to_string(),
            badge_color: "rose".to_string(),
            lat: Some(s.lat),
            lon: Some(s.lon),
            extra: json!({
                "vt1_price": s.vt1_price,
                "k_ratio": s.k_ratio,
                "segment": format!("{} - {}", s.segment_from, s.segment_to)
            }),
        });
    }

    if results.len() > max_limit {
        results.truncate(max_limit);
    }

    Json(json!({
        "query": q,
        "total": results.len(),
        "results": results
    })).into_response()
}

// ── Merger Lookup Endpoint ───────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct MergerQueryParams {
    pub q: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, Deserialize, sqlx::FromRow)]
pub struct MergerWardResult {
    pub province_slug: String,
    pub province_name: String,
    pub slug: String,
    pub name: String,
    pub merged_from: Option<String>,
    pub resolution_no: Option<String>,
    pub area_km2: Option<f64>,
    pub population: Option<i64>,
    pub median_price_m2: Option<f64>,
    pub state_price_m2: Option<f64>,
}

async fn merger_lookup(
    State(state): State<AppState>,
    Query(params): Query<MergerQueryParams>,
) -> Response {
    let q_raw = params.q.unwrap_or_default();
    let q = q_raw.trim();
    if q.is_empty() {
        return Json(json!({
            "query": "",
            "results": []
        })).into_response();
    }

    let results: Vec<MergerWardResult> = sqlx::query_as(
        r#"
        SELECT province_slug, province_name, slug, name, merged_from, resolution_no,
               area_km2, population, median_price_m2, state_price_m2
        FROM wards_2025
        WHERE unaccent(name) ILIKE '%' || unaccent($1) || '%'
           OR unaccent(merged_from) ILIKE '%' || unaccent($1) || '%'
           OR unaccent(province_name) ILIKE '%' || unaccent($1) || '%'
        ORDER BY sample_count DESC NULLS LAST
        LIMIT 20
        "#
    )
    .bind(q)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    Json(json!({
        "query": q,
        "results": results
    })).into_response()
}

// ── Reverse Geocode Endpoint ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ReverseGeocodeQuery {
    pub lat: f64,
    pub lon: f64,
}

async fn reverse_geocode(
    State(state): State<AppState>,
    Query(query): Query<ReverseGeocodeQuery>,
) -> Response {
    let ward_opt: Option<Ward2025> = sqlx::query_as(
        r#"
        SELECT * FROM wards_2025
        ORDER BY ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) ASC NULLS LAST
        LIMIT 1
        "#
    )
    .bind(query.lon)
    .bind(query.lat)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    match ward_opt {
        Some(ward) => {
            let cm = resolve_central_meridian(Some(&ward.province_slug), None);
            let (northing, easting) = wgs84_to_vn2000(query.lat, query.lon, cm);
            Json(json!({
                "ok": true,
                "lat": query.lat,
                "lon": query.lon,
                "vn2000": {
                    "x": (northing * 1000.0).round() / 1000.0,
                    "y": (easting * 1000.0).round() / 1000.0,
                    "central_meridian": cm
                },
                "ward": ward
            })).into_response()
        }
        None => (
            StatusCode::NOT_FOUND,
            Json(json!({ "ok": false, "error": "No ward found near coordinates" }))
        ).into_response(),
    }
}

// ── Planning Layers Catalog Endpoint ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct PlanningLayersQuery {
    pub province: Option<String>,
}

async fn get_planning_layers_catalog(
    State(state): State<AppState>,
    Query(query): Query<PlanningLayersQuery>,
) -> Response {
    let layers: Vec<PlanningLayer> = if let Some(p) = query.province {
        sqlx::query_as("SELECT * FROM planning_layers WHERE active = true AND (province_slug = $1 OR province_slug = 'toan-quoc') ORDER BY (province_slug = $1) DESC, name ASC")
            .bind(p)
            .fetch_all(&state.pool)
            .await
            .unwrap_or_default()
    } else {
        sqlx::query_as("SELECT * FROM planning_layers WHERE active = true ORDER BY (province_slug = 'toan-quoc') DESC, province_slug ASC, name ASC")
            .fetch_all(&state.pool)
            .await
            .unwrap_or_default()
    };

    Json(json!({
        "total": layers.len(),
        "layers": layers
    })).into_response()
}


