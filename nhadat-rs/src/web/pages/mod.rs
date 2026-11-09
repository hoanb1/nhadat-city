use askama::Template;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{Html, IntoResponse, Response};

use super::{render, AppError, Meta, Page};
use crate::api::AppState;

#[derive(Template)]
#[template(path = "pages/preview.html")]
struct PreviewTemplate {
    page: Page,
}

/// GET /__rs/preview — base layout with sample content (noindex).
pub async fn preview() -> Result<Html<String>, AppError> {
    let meta = Meta::page("Rust shell preview", "Trang thử layout nhadat-rs.", "/__rs/preview").noindex();
    render(&PreviewTemplate { page: Page::new(meta) })
}

/// GET /healthz — "ok" if the DB answers `select 1`.
pub async fn healthz(State(state): State<AppState>) -> Response {
    match sqlx::query("select 1").execute(&state.pool).await {
        Ok(_) => (StatusCode::OK, "ok").into_response(),
        Err(e) => {
            tracing::error!(error = %e, "healthz: db check failed");
            (StatusCode::SERVICE_UNAVAILABLE, "db unavailable").into_response()
        }
    }
}
