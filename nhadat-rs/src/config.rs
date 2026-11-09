use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub host: String,
    pub port: u16,
    pub geoserver_url: String,
    pub geoserver_parcel_layer: String,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let database_url = env::var("DATABASE_URL")
            .expect("DATABASE_URL must be set (see nhadat-rs/.env.example)");

        let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port = env::var("PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(3005);

        let geoserver_url = env::var("GEOSERVER_URL")
            .unwrap_or_else(|_| "http://internal.example:8080/geoserver".to_string());

        let geoserver_parcel_layer = env::var("GEOSERVER_PARCEL_LAYER")
            .unwrap_or_else(|_| "current:ranhthua".to_string());

        Self {
            database_url,
            host,
            port,
            geoserver_url,
            geoserver_parcel_layer,
        }
    }
}
