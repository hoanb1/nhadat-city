use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use sqlx::{Pool, Postgres};

pub type DbPool = Pool<Postgres>;

pub async fn init_db_pool(database_url: &str) -> Result<DbPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(20)
        .min_connections(3)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(database_url)
        .await
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Province2025 {
    pub id: i32,
    pub slug: String,
    pub name: String,
    pub ma_tinh: Option<String>,
    pub ma_tinh_bnv: Option<String>,
    pub area_km2: Option<f64>,
    pub population: Option<i64>,
    pub merged_from: Option<String>,
    pub admin_center: Option<String>,
    pub legacy_slugs: Option<Vec<String>>,
    pub crs_proj4: Option<String>,
    pub central_meridian: Option<f64>,
    pub lat: f64,
    pub lon: f64,
    pub ward_count: Option<i32>,
    pub project_count: Option<i32>,
    pub median_price_m2: Option<f64>,
    pub sample_count: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LegacyProvince63 {
    pub slug: String,
    pub name: String,
    pub new_province_slug: String,
    pub central_meridian: f64,
    pub epsg_3deg: i32,
    pub epsg_6deg: i32,
    pub region: String,
    pub lat: f64,
    pub lon: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Ward2025 {
    pub id: i32,
    pub province_slug: String,
    pub province_name: String,
    pub slug: String,
    pub name: String,
    pub ma_xa: Option<String>,
    pub ma_xa_bnv: Option<String>,
    pub area_km2: Option<f64>,
    pub population: Option<i64>,
    pub resolution_no: Option<String>,
    pub merged_from: Option<String>,
    pub legacy_slugs: Option<Vec<String>>,
    pub lat: f64,
    pub lon: f64,
    pub median_price_m2: Option<f64>,
    pub avg_price_m2: Option<f64>,
    pub p25_price_m2: Option<f64>,
    pub p75_price_m2: Option<f64>,
    pub state_price_m2: Option<f64>,
    pub sample_count: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LandUseType {
    pub code: String,
    pub name: String,
    pub group_name: String,
    pub color_hex: String,
    pub is_residential: Option<bool>,
    pub max_term_text: String,
    pub legal_summary: String,
    pub buildable_guide: String,
    pub conversion_fee_rule: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MarketPriceIndex {
    pub id: i32,
    pub province_slug: String,
    pub ward_slug: String,
    pub property_type: String,
    pub sample_count: i32,
    pub median_price_m2: f64,
    pub avg_price_m2: f64,
    pub p25_price_m2: f64,
    pub p75_price_m2: f64,
    pub min_price_m2: f64,
    pub max_price_m2: f64,
    pub avg_total_price_billion: f64,
    pub avg_area_m2: f64,
    pub state_price_m2: f64,
    pub yoy_change_pct: f64,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PriceHistoryMonthly {
    pub province_slug: String,
    pub ward_slug: String,
    pub year_month: String,
    pub sample_count: i32,
    pub median_price_m2: f64,
    pub avg_price_m2: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Project {
    pub id: i32,
    pub slug: String,
    pub short_id: Option<String>,
    pub title: String,
    pub trade_name: Option<String>,
    pub province_slug: String,
    pub ward_slug: Option<String>,
    pub address: Option<String>,
    pub street_name: Option<String>,
    pub investor_name: Option<String>,
    pub investor_description: Option<String>,
    pub project_type: Option<String>,
    pub total_apartments: Option<String>,
    pub total_buildings: Option<String>,
    pub total_floors: Option<String>,
    pub total_area_text: Option<String>,
    pub building_density: Option<String>,
    pub ownership: Option<String>,
    pub status: Option<String>,
    pub banner_url: Option<String>,
    pub utilities_summary: Option<String>,
    pub location_summary: Option<String>,
    pub legal_summary: Option<String>,
    pub ref_price_m2: Option<f64>,
    pub lat: f64,
    pub lon: f64,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BankMortgageRate {
    pub slug: String,
    pub bank_name: String,
    pub short_name: String,
    pub bank_group: String,
    pub promo_rate_6m: f64,
    pub promo_rate_12m: f64,
    pub promo_rate_24m: f64,
    pub floating_rate: f64,
    pub max_ltv_pct: i32,
    pub max_term_years: i32,
    pub early_repayment_fee: String,
    pub grace_period_months: i32,
    pub notes: Option<String>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LegalArticle {
    pub id: i32,
    pub slug: String,
    pub title: String,
    pub category: String,
    pub summary: String,
    pub content_html: String,
    pub faqs: Option<serde_json::Value>,
    pub tags: Option<Vec<String>>,
    pub word_count: Option<i32>,
    pub published_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PlanningLayer {
    pub id: String,
    pub name: String,
    pub province_slug: Option<String>,
    pub layer_type: String,
    pub format: String,
    pub tile_url: String,
    pub min_zoom: Option<i32>,
    pub max_zoom: Option<i32>,
    pub bbox: Option<serde_json::Value>,
    pub active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct StateLandPrice {
    pub id: i32,
    pub province_slug: String,
    pub ward_slug: String,
    pub street_name: String,
    pub segment_from: String,
    pub segment_to: String,
    pub vt1_price: f64,
    pub vt2_price: f64,
    pub vt3_price: f64,
    pub vt4_price: f64,
    pub market_vt1: f64,
    pub k_ratio: f64,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ProvinceWardSummary {
    pub slug: String,
    pub name: String,
    pub median_price_m2: f64,
    pub state_price_m2: f64,
    pub merged_from: String,
}
