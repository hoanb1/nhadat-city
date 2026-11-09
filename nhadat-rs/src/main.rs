mod api;
mod config;
mod db;
mod geo;
mod quant;
mod web;

use std::net::SocketAddr;
use std::time::Duration;
use tower_http::compression::CompressionLayer;
use tower_http::cors::{Any, CorsLayer};
use tower_http::timeout::TimeoutLayer;
use tower_http::trace::TraceLayer;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::api::{create_router, AppState};
use crate::config::Config;
use crate::db::init_db_pool;
use crate::geo::GeoServerClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Initialize logging & tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "nhadat_rs=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // 2. Load centralized configuration
    let config = Config::from_env();
    info!(
        database = %redact_db_url(&config.database_url),
        port = config.port,
        host = %config.host,
        geoserver = %config.geoserver_url,
        "Starting NhaDat.City Rust Core & GIS/Quant Backend (nhadat-rs)"
    );

    // 3. Connect to PostgreSQL / PostGIS
    info!("Connecting to PostgreSQL database...");
    let pool = init_db_pool(&config.database_url).await?;
    info!("Database connection pool established successfully.");

    // 4. Initialize GeoServer Client
    let geoserver = GeoServerClient::new(&config.geoserver_url, &config.geoserver_parcel_layer);

    // 5. Construct Application State
    let app_state = AppState {
        pool,
        config: config.clone(),
        geoserver,
    };

    // 6. Build Axum Router with Tower HTTP Middleware suite
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = create_router(app_state.clone())
        .merge(web::router(app_state))
        .layer(cors)
        .layer(CompressionLayer::new())
        .layer(TimeoutLayer::with_status_code(axum::http::StatusCode::REQUEST_TIMEOUT, Duration::from_secs(15)))
        .layer(TraceLayer::new_for_http());

    // 7. Bind TCP Listener and Serve
    let addr: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    info!("NhaDat.City Axum Backend listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("nhadat-rs server gracefully shut down.");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}

/// "host:port/dbname" only; never log credentials.
fn redact_db_url(url: &str) -> String {
    let rest = url.split_once("://").map(|(_, r)| r).unwrap_or(url);
    let rest = rest.rsplit_once('@').map(|(_, r)| r).unwrap_or(rest);
    rest.split('?').next().unwrap_or(rest).to_string()
}
