use askama::Template;
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};

use super::{Meta, Page};

/// Shared error type for HTML routes. JSON API handlers keep their own error handling.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("not found")]
    NotFound,
    #[error("database error: {0}")]
    Db(#[from] sqlx::Error),
    #[error("template error: {0}")]
    Template(#[from] askama::Error),
    #[allow(dead_code)] // used by upcoming phases
    #[error("internal error: {0}")]
    Internal(String),
}

#[derive(Template)]
#[template(path = "pages/not_found.html")]
struct NotFoundTemplate {
    page: Page,
}

#[derive(Template)]
#[template(path = "pages/error.html")]
struct ErrorTemplate {
    page: Page,
}

fn html(status: StatusCode, body: Result<String, askama::Error>) -> Response {
    match body {
        Ok(b) => (
            status,
            [
                (header::CONTENT_TYPE, "text/html; charset=utf-8"),
                (header::CACHE_CONTROL, "no-store"),
            ],
            b,
        )
            .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "error page render failed");
            (StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error").into_response()
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        match self {
            AppError::NotFound => {
                let meta = Meta::page("Không tìm thấy nội dung", "Trang bạn tìm không tồn tại.", "/").noindex();
                html(StatusCode::NOT_FOUND, NotFoundTemplate { page: Page::new(meta) }.render())
            }
            other => {
                tracing::error!(error = %other, "request failed");
                let meta = Meta::page("Đã xảy ra lỗi", "Hệ thống đang gặp sự cố tạm thời.", "/").noindex();
                html(StatusCode::INTERNAL_SERVER_ERROR, ErrorTemplate { page: Page::new(meta) }.render())
            }
        }
    }
}
