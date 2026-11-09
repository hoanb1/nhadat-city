//! Server-rendered HTML (askama). JSON API stays in `crate::api`.
pub mod error;
pub mod pages;
pub mod provinces;

use askama::Template;
use axum::http::{header, HeaderValue, StatusCode, Uri};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use chrono::Datelike;
use std::sync::OnceLock;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::set_header::SetResponseHeaderLayer;

pub use error::AppError;

use crate::api::AppState;

pub const SITE_URL: &str = "https://nhadat.city";
pub const OG_IMAGE: &str = "https://nhadat.city/og-image.jpg";
/// Content hash of static css/js (build.rs); used as `?v=` cache-buster.
pub const ASSET_V: &str = env!("ASSET_V");

const DEFAULT_TITLE: &str = "Tra cứu bản đồ quy hoạch & mua bán nhà đất chính chủ 24/7 | NhaDat.City";
const DEFAULT_DESC: &str = "Nền tảng bất động sản thông minh: xem bản đồ quy hoạch, giá nhà, hơn 1 triệu tin đăng chính chủ toàn quốc, cập nhật 24/7.";
const DEFAULT_KEYWORDS: &str = "bản đồ quy hoạch, nhà đất, mua bán nhà đất, bất động sản, quy hoạch đô thị, giá nhà đất, nhadat.city, nhà đất toàn quốc, mua nhà hà nội, mua nhà hcm, tin rao bán nhà đất, chính chủ không qua môi giới";
const DEFAULT_OG_TITLE: &str = "Bản đồ quy hoạch & mua bán nhà đất toàn quốc | NhaDat.City";
const DEFAULT_OG_DESC: &str = "Nền tảng bản đồ bất động sản thông minh hàng đầu Việt Nam. Tra cứu quy hoạch, giá nhà, tin đăng chính chủ toàn quốc.";
pub const ROBOTS_INDEX: &str = "index, follow, max-image-preview:large, max-snippet:-1";
pub const ROBOTS_NOINDEX: &str = "noindex, nofollow";

/// Per-page SEO metadata (mirrors Next `metadata`).
#[derive(Clone, Debug)]
pub struct Meta {
    pub title: String,
    pub description: String,
    pub keywords: String,
    pub canonical: String,
    pub robots: String,
    pub og_title: String,
    pub og_description: String,
    pub og_image: String,
    pub og_type: String,
}

impl Meta {
    /// Site-wide defaults (same as app/layout.tsx).
    pub fn site_default() -> Self {
        Self {
            title: DEFAULT_TITLE.into(),
            description: DEFAULT_DESC.into(),
            keywords: DEFAULT_KEYWORDS.into(),
            canonical: SITE_URL.into(),
            robots: ROBOTS_INDEX.into(),
            og_title: DEFAULT_OG_TITLE.into(),
            og_description: DEFAULT_OG_DESC.into(),
            og_image: OG_IMAGE.into(),
            og_type: "website".into(),
        }
    }

    /// Page meta: title gets the "| NhaDat.City" template suffix; `path` is the canonical path.
    pub fn page(title: &str, description: &str, path: &str) -> Self {
        let full = format!("{title} | NhaDat.City");
        Self {
            og_title: full.clone(),
            og_description: description.into(),
            title: full,
            description: description.into(),
            canonical: format!("{SITE_URL}{path}"),
            ..Self::site_default()
        }
    }

    pub fn noindex(mut self) -> Self {
        self.robots = ROBOTS_NOINDEX.into();
        self
    }
}

/// Everything the base layout needs; embed as field `page` in every page template.
#[derive(Clone, Debug)]
pub struct Page {
    pub meta: Meta,
    pub asset_v: &'static str,
    pub year: i32,
    pub global_jsonld: &'static str,
    pub provinces: &'static [(&'static str, &'static str)],
}

impl Page {
    pub fn new(meta: Meta) -> Self {
        Self {
            meta,
            asset_v: ASSET_V,
            year: chrono::Utc::now().year(),
            global_jsonld: global_jsonld(),
            provinces: provinces::PROVINCES,
        }
    }
}

/// Global JSON-LD (WebSite + Organization), same graph as app/layout.tsx.
fn global_jsonld() -> &'static str {
    static CELL: OnceLock<String> = OnceLock::new();
    CELL.get_or_init(|| {
        let v = serde_json::json!({
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "WebSite",
                    "@id": format!("{SITE_URL}/#website"),
                    "name": "NhaDat.City",
                    "url": SITE_URL,
                    "description": "Nền tảng bản đồ bất động sản thông minh hàng đầu Việt Nam",
                    "inLanguage": "vi",
                    "potentialAction": {
                        "@type": "SearchAction",
                        "target": {"@type": "EntryPoint", "urlTemplate": format!("{SITE_URL}/?q={{search_term_string}}")},
                        "query-input": "required name=search_term_string"
                    }
                },
                {
                    "@type": "Organization",
                    "@id": format!("{SITE_URL}/#organization"),
                    "name": "NhaDat.City",
                    "url": SITE_URL,
                    "logo": {"@type": "ImageObject", "url": format!("{SITE_URL}/logo.png"), "width": 512, "height": 512},
                    "contactPoint": [
                        {"@type": "ContactPoint", "contactType": "customer support", "email": "support@nhadat.city", "availableLanguage": "Vietnamese"},
                        {"@type": "ContactPoint", "contactType": "sales", "email": "partner@nhadat.city"}
                    ],
                    "sameAs": [SITE_URL]
                }
            ]
        });
        // Prevent `</script>` breakout.
        v.to_string().replace("</", "<\\/")
    })
}

/// `STATIC_DIR` env (prod: next to the binary); defaults to the crate's `static/` for local runs.
fn static_dir() -> String {
    std::env::var("STATIC_DIR").unwrap_or_else(|_| format!("{}/static", env!("CARGO_MANIFEST_DIR")))
}

/// Render an askama template into an HTML response.
pub fn render<T: Template>(t: &T) -> Result<Html<String>, AppError> {
    Ok(Html(t.render()?))
}

pub fn router(state: AppState) -> Router {
    let cache_immutable = SetResponseHeaderLayer::overriding(
        header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=31536000, immutable"),
    );
    let cache_day = || {
        SetResponseHeaderLayer::overriding(
            header::CACHE_CONTROL,
            HeaderValue::from_static("public, max-age=86400"),
        )
    };
    let static_dir = static_dir();
    let file = |p: &'static str| ServeFile::new(format!("{static_dir}/{p}"));

    let static_svc = tower::ServiceBuilder::new()
        .layer(cache_immutable)
        .service(ServeDir::new(&static_dir));

    Router::new()
        .route("/healthz", get(pages::healthz))
        .route("/__rs/preview", get(pages::preview))
        .nest_service("/static", static_svc)
        .route_service("/favicon.ico", tower::ServiceBuilder::new().layer(cache_day()).service(file("favicon.ico")))
        .route_service("/manifest.json", tower::ServiceBuilder::new().layer(cache_day()).service(file("manifest.json")))
        .route_service("/og-image.jpg", tower::ServiceBuilder::new().layer(cache_day()).service(file("og-image.jpg")))
        .fallback(fallback)
        .with_state(state)
}

/// Unknown paths: JSON 404 for /api/*, HTML 404 page otherwise.
async fn fallback(uri: Uri) -> Response {
    if uri.path().starts_with("/api/") {
        return (
            StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({"error": "not found"})),
        )
            .into_response();
    }
    AppError::NotFound.into_response()
}
