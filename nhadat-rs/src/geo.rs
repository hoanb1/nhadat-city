use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::f64::consts::PI;
use std::time::Duration;

pub const WGS84_A: f64 = 6378137.0;
pub const WGS84_F: f64 = 1.0 / 298.257223563;
pub const WGS84_B: f64 = WGS84_A * (1.0 - WGS84_F);
pub const WGS84_E2: f64 = 2.0 * WGS84_F - WGS84_F * WGS84_F;
pub const WGS84_E_PRIME2: f64 = (WGS84_A * WGS84_A - WGS84_B * WGS84_B) / (WGS84_B * WGS84_B);

// Helmert 7 parameters (VN2000 -> WGS84)
pub const DX: f64 = -191.9044;
pub const DY: f64 = -39.3032;
pub const DZ: f64 = -111.4503;
pub const WX: f64 = -0.00928836 * (PI / (180.0 * 3600.0));
pub const WY: f64 = 0.00975456 * (PI / (180.0 * 3600.0));
pub const WZ: f64 = -0.01170641 * (PI / (180.0 * 3600.0));
pub const SCALE_PPM: f64 = -0.0042736 * 1e-6;

pub const K0_3DEG: f64 = 0.9999;
pub const FALSE_EASTING: f64 = 500000.0;
pub const FALSE_NORTHING: f64 = 0.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vn2000PointInput {
    pub point_id: Option<String>,
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wgs84PointOutput {
    pub point_id: Option<String>,
    pub original_x: f64,
    pub original_y: f64,
    pub lat: f64,
    pub lon: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vn2000ConversionResult {
    pub central_meridian: f64,
    pub points: Vec<Wgs84PointOutput>,
    pub centroid: Centroid,
    pub bbox: [f64; 4], // [min_lon, min_lat, max_lon, max_lat]
    pub area_m2: f64,
    pub perimeter_m: f64,
    pub geojson: GeoJsonPolygon,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Centroid {
    pub lat: f64,
    pub lon: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoJsonPolygon {
    #[serde(rename = "type")]
    pub geo_type: String,
    pub coordinates: Vec<Vec<[f64; 2]>>,
}

/// Normalizes province string to find its standard 3-degree central meridian
pub fn resolve_central_meridian(input: Option<&str>, meridian_override: Option<f64>) -> f64 {
    if let Some(m) = meridian_override {
        if m > 100.0 && m < 115.0 {
            return m;
        }
    }

    let raw = match input {
        Some(s) => s.to_lowercase(),
        None => return 105.0, // Default Hanoi
    };

    let s = raw.replace('-', " ").replace('_', " ");

    if s.contains("ha noi") || s.contains("hanoi") || s.contains("ha giang") || s.contains("tuyen quang") || s.contains("hoa binh") || s.contains("thanh hoa") || s.contains("bac lieu") || s.contains("dong thap") {
        105.0
    } else if s.contains("tp ho chi minh") || s.contains("ho chi minh") || s.contains("hcm") || s.contains("sai gon") || s.contains("binh duong") || s.contains("hai phong") || s.contains("ninh binh") || s.contains("thai nguyen") || s.contains("bac kan") || s.contains("cao bang") || s.contains("ben tre") || s.contains("long an") || s.contains("tien giang") {
        105.75
    } else if s.contains("da nang") || s.contains("quang nam") || s.contains("quang ninh") || s.contains("lam dong") || s.contains("dong nai") {
        107.75
    } else if s.contains("ha nam") || s.contains("hai duong") || s.contains("hung yen") || s.contains("bac ninh") || s.contains("ha tinh") || s.contains("tay ninh") || s.contains("can tho") || s.contains("hau giang") || s.contains("tra vinh") || s.contains("vinh long") {
        105.5
    } else if s.contains("nam dinh") || s.contains("quang binh") {
        106.0
    } else if s.contains("thai binh") {
        106.5
    } else if s.contains("bac giang") || s.contains("thua thien hue") || s.contains("hue") {
        107.0
    } else if s.contains("lang son") {
        107.25
    } else if s.contains("ba ria") || s.contains("vung tau") || s.contains("kon tum") {
        107.5
    } else if s.contains("binh dinh") || s.contains("khanh hoa") {
        108.25
    } else if s.contains("quang ngai") || s.contains("phu yen") || s.contains("binh thuan") || s.contains("gia lai") || s.contains("dak lak") || s.contains("dak nong") {
        108.5
    } else if s.contains("ninh thuan") {
        108.75
    } else if s.contains("quang tri") || s.contains("binh phuoc") {
        106.25
    } else if s.contains("an giang") || s.contains("ca mau") || s.contains("kien giang") {
        104.5
    } else if s.contains("phu tho") || s.contains("yen bai") || s.contains("nghe an") {
        104.75
    } else if s.contains("dien bien") || s.contains("lai chau") {
        103.0
    } else if s.contains("lao cai") || s.contains("son la") {
        104.0
    } else if s.contains("soc trang") {
        105.3
    } else {
        105.0
    }
}

/// Convert single point VN2000 (x, y) to WGS84 (lat, lon)
pub fn vn2000_to_wgs84(x_in: f64, y_in: f64, central_meridian: f64) -> (f64, f64) {
    // Northing in Vietnam is typically 1,000,000 - 2,500,000
    // Easting is typically 300,000 - 700,000
    // If x < 1,000,000 and y > 1,000,000, user/OCR swapped them.
    let (northing, easting) = if x_in < 1_000_000.0 && y_in > 1_000_000.0 {
        (y_in, x_in)
    } else {
        (x_in, y_in)
    };

    // Step 1: Inverse Transverse Mercator on VN2000 ellipsoid
    let (phi_vn, lam_vn) = inv_transverse_mercator(northing, easting, central_meridian, K0_3DEG);

    // Step 2: VN2000 Geodetic to Cartesian (X, Y, Z)
    let n = WGS84_A / (1.0 - WGS84_E2 * phi_vn.sin().powi(2)).sqrt();
    let x_c = n * phi_vn.cos() * lam_vn.cos();
    let y_c = n * phi_vn.cos() * lam_vn.sin();
    let z_c = n * (1.0 - WGS84_E2) * phi_vn.sin();

    // Step 3: 7-parameter Helmert transformation to WGS84 Cartesian
    let s = 1.0 + SCALE_PPM;
    let x_w = DX + s * (x_c - WZ * y_c + WY * z_c);
    let y_w = DY + s * (WZ * x_c + y_c - WX * z_c);
    let z_w = DZ + s * (-WY * x_c + WX * y_c + z_c);

    // Step 4: WGS84 Cartesian to Geodetic (Lat, Lon) via Bowring's formula
    let p = (x_w * x_w + y_w * y_w).sqrt();
    let theta = (z_w * WGS84_A).atan2(p * WGS84_B);
    let lat_rad = (z_w + WGS84_E_PRIME2 * WGS84_B * theta.sin().powi(3))
        .atan2(p - WGS84_E2 * WGS84_A * theta.cos().powi(3));
    let lon_rad = y_w.atan2(x_w);

    let lat = lat_rad * 180.0 / PI;
    let lon = lon_rad * 180.0 / PI;

    (lat, lon)
}

/// Convert WGS84 (lat, lon) to VN2000 (northing, easting)
pub fn wgs84_to_vn2000(lat: f64, lon: f64, central_meridian: f64) -> (f64, f64) {
    let lat_rad = lat * PI / 180.0;
    let lon_rad = lon * PI / 180.0;

    let n = WGS84_A / (1.0 - WGS84_E2 * lat_rad.sin().powi(2)).sqrt();
    let x_w = n * lat_rad.cos() * lon_rad.cos();
    let y_w = n * lat_rad.cos() * lon_rad.sin();
    let z_w = n * (1.0 - WGS84_E2) * lat_rad.sin();

    // Inverse Helmert
    let s = 1.0 + SCALE_PPM;
    let x_diff = (x_w - DX) / s;
    let y_diff = (y_w - DY) / s;
    let z_diff = (z_w - DZ) / s;

    let x_c = x_diff + WZ * y_diff - WY * z_diff;
    let y_c = -WZ * x_diff + y_diff + WX * z_diff;
    let z_c = WY * x_diff - WX * y_diff + z_diff;

    let p = (x_c * x_c + y_c * y_c).sqrt();
    let theta = (z_c * WGS84_A).atan2(p * WGS84_B);
    let phi_vn = (z_c + WGS84_E_PRIME2 * WGS84_B * theta.sin().powi(3))
        .atan2(p - WGS84_E2 * WGS84_A * theta.cos().powi(3));
    let lam_vn = y_c.atan2(x_c);

    fwd_transverse_mercator(phi_vn, lam_vn, central_meridian, K0_3DEG)
}

fn inv_transverse_mercator(northing: f64, easting: f64, lon_0_deg: f64, k0: f64) -> (f64, f64) {
    let lon_0 = lon_0_deg * PI / 180.0;
    let x = (easting - FALSE_EASTING) / k0;
    let y = (northing - FALSE_NORTHING) / k0;

    // Meridional arc parameters
    let _e = WGS84_E2.sqrt();
    let e1 = (1.0 - (1.0 - WGS84_E2).sqrt()) / (1.0 + (1.0 - WGS84_E2).sqrt());
    let m = y;
    let mu = m / (WGS84_A * (1.0 - WGS84_E2 / 4.0 - 3.0 * WGS84_E2.powi(2) / 64.0 - 5.0 * WGS84_E2.powi(3) / 256.0));

    let phi1 = mu
        + (3.0 * e1 / 2.0 - 27.0 * e1.powi(3) / 32.0) * (2.0 * mu).sin()
        + (21.0 * e1.powi(2) / 16.0 - 55.0 * e1.powi(4) / 32.0) * (4.0 * mu).sin()
        + (151.0 * e1.powi(3) / 96.0) * (6.0 * mu).sin()
        + (1097.0 * e1.powi(4) / 512.0) * (8.0 * mu).sin();

    let c1 = WGS84_E_PRIME2 * phi1.cos().powi(2);
    let t1 = phi1.tan().powi(2);
    let n1 = WGS84_A / (1.0 - WGS84_E2 * phi1.sin().powi(2)).sqrt();
    let r1 = WGS84_A * (1.0 - WGS84_E2) / (1.0 - WGS84_E2 * phi1.sin().powi(2)).powf(1.5);
    let d = x / n1;

    let phi = phi1 - (n1 * phi1.tan() / r1) * (
        d * d / 2.0
        - (5.0 + 3.0 * t1 + 10.0 * c1 - 4.0 * c1 * c1 - 9.0 * WGS84_E_PRIME2) * d.powi(4) / 24.0
        + (61.0 + 90.0 * t1 + 298.0 * c1 + 45.0 * t1 * t1 - 252.0 * WGS84_E_PRIME2 - 3.0 * c1 * c1) * d.powi(6) / 720.0
    );

    let lam = lon_0 + (
        d
        - (1.0 + 2.0 * t1 + c1) * d.powi(3) / 6.0
        + (5.0 - 2.0 * c1 + 28.0 * t1 - 3.0 * c1 * c1 + 8.0 * WGS84_E_PRIME2 + 24.0 * t1 * t1) * d.powi(5) / 120.0
    ) / phi1.cos();

    (phi, lam)
}

fn fwd_transverse_mercator(phi: f64, lam: f64, lon_0_deg: f64, k0: f64) -> (f64, f64) {
    let lon_0 = lon_0_deg * PI / 180.0;
    let delta_lam = lam - lon_0;

    let n = WGS84_A / (1.0 - WGS84_E2 * phi.sin().powi(2)).sqrt();
    let t = phi.tan().powi(2);
    let c = WGS84_E_PRIME2 * phi.cos().powi(2);
    let a_val = delta_lam * phi.cos();

    let m = WGS84_A * (
        (1.0 - WGS84_E2 / 4.0 - 3.0 * WGS84_E2.powi(2) / 64.0 - 5.0 * WGS84_E2.powi(3) / 256.0) * phi
        - (3.0 * WGS84_E2 / 8.0 + 3.0 * WGS84_E2.powi(2) / 32.0 + 45.0 * WGS84_E2.powi(3) / 1024.0) * (2.0 * phi).sin()
        + (15.0 * WGS84_E2.powi(2) / 256.0 + 45.0 * WGS84_E2.powi(3) / 1024.0) * (4.0 * phi).sin()
        - (35.0 * WGS84_E2.powi(3) / 3072.0) * (6.0 * phi).sin()
    );

    let x = k0 * n * (
        a_val
        + (1.0 - t + c) * a_val.powi(3) / 6.0
        + (5.0 - 18.0 * t + t * t + 72.0 * c - 58.0 * WGS84_E_PRIME2) * a_val.powi(5) / 120.0
    ) + FALSE_EASTING;

    let y = k0 * (
        m + n * phi.tan() * (
            a_val * a_val / 2.0
            + (5.0 - t + 9.0 * c + 4.0 * c * c) * a_val.powi(4) / 24.0
            + (61.0 - 58.0 * t + t * t + 600.0 * c - 330.0 * WGS84_E_PRIME2) * a_val.powi(6) / 720.0
        )
    ) + FALSE_NORTHING;

    (y, x) // (northing, easting)
}

/// Computes Shoelace area and perimeter on metric (northing, easting) points
pub fn compute_polygon_metrics(points: &[Vn2000PointInput]) -> (f64, f64) {
    let n = points.len();
    if n < 3 {
        return (0.0, 0.0);
    }

    let mut area_sum = 0.0;
    let mut perimeter = 0.0;

    for i in 0..n {
        let j = (i + 1) % n;
        let xi = points[i].x;
        let yi = points[i].y;
        let xj = points[j].x;
        let yj = points[j].y;

        area_sum += xi * yj - xj * yi;
        let dist = ((xj - xi).powi(2) + (yj - yi).powi(2)).sqrt();
        perimeter += dist;
    }

    let area = (area_sum.abs() * 0.5 * 100.0).round() / 100.0;
    let perim = (perimeter * 100.0).round() / 100.0;

    (area, perim)
}

/// Converts an array of VN2000 polygon corner points to WGS84 GeoJSON + area + perimeter
pub fn process_vn2000_polygon(
    points: Vec<Vn2000PointInput>,
    central_meridian: f64,
) -> Vn2000ConversionResult {
    let (area_m2, perimeter_m) = compute_polygon_metrics(&points);

    let mut converted_points = Vec::with_capacity(points.len());
    let mut sum_lat = 0.0;
    let mut sum_lon = 0.0;
    let mut min_lat = 90.0_f64;
    let mut max_lat = -90.0_f64;
    let mut min_lon = 180.0_f64;
    let mut max_lon = -180.0_f64;

    for pt in &points {
        let (lat, lon) = vn2000_to_wgs84(pt.x, pt.y, central_meridian);
        sum_lat += lat;
        sum_lon += lon;

        if lat < min_lat { min_lat = lat; }
        if lat > max_lat { max_lat = lat; }
        if lon < min_lon { min_lon = lon; }
        if lon > max_lon { max_lon = lon; }

        converted_points.push(Wgs84PointOutput {
            point_id: pt.point_id.clone(),
            original_x: pt.x,
            original_y: pt.y,
            lat: (lat * 1e6).round() / 1e6,
            lon: (lon * 1e6).round() / 1e6,
        });
    }

    let count = if points.is_empty() { 1.0 } else { points.len() as f64 };
    let centroid = Centroid {
        lat: ((sum_lat / count) * 1e6).round() / 1e6,
        lon: ((sum_lon / count) * 1e6).round() / 1e6,
    };

    let mut ring: Vec<[f64; 2]> = converted_points
        .iter()
        .map(|p| [p.lon, p.lat])
        .collect();

    if let (Some(first), Some(last)) = (ring.first().copied(), ring.last().copied()) {
        if first != last {
            ring.push(first);
        }
    }

    Vn2000ConversionResult {
        central_meridian,
        points: converted_points,
        centroid,
        bbox: [
            (min_lon * 1e6).round() / 1e6,
            (min_lat * 1e6).round() / 1e6,
            (max_lon * 1e6).round() / 1e6,
            (max_lat * 1e6).round() / 1e6,
        ],
        area_m2,
        perimeter_m,
        geojson: GeoJsonPolygon {
            geo_type: "Polygon".to_string(),
            coordinates: vec![ring],
        },
    }
}

/// GeoServer Parcel Client
#[derive(Clone)]
pub struct GeoServerClient {
    client: Client,
    base_url: String,
    parcel_layer: String,
}

impl GeoServerClient {
    pub fn new(base_url: &str, parcel_layer: &str) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(8))
            .build()
            .unwrap_or_else(|_| Client::new());

        Self {
            client,
            base_url: base_url.trim_end_matches('/').to_string(),
            parcel_layer: parcel_layer.to_string(),
        }
    }

    pub fn resolve_layer_name(layer: &str) -> &str {
        match layer.trim() {
            "tY939dPWjrap3f9zk" | "qhct2026_ha_noi" => "current:qhct2026_ha_noi",
            "tY939dPWjrap3f9zm" | "planning_zones_hcm_z14" => "planning:planning_zones_hcm_z14",
            "vM6kHqC3JwXyZaBcd" | "basemap" => "current:basemap",
            "xai8TeB4v9xHqC3Jw" | "ranhthua" | "current:hanoi-ranhthua" | "6C4k9gbWtwh8EfvRc" => "current:ranhthua",
            "5JLsFZTuAXk4Sdv5W" | "hanoiphankhu" => "planning:hanoiphankhu",
            "Ljt9naJ5ia9ymw2cq" | "goon" => "current:goon",
            "JobQ2YHfBjnjCRx3e" | "goonranh" => "current:goonranh",
            "Wjrap3f9zktY939dP" | "hcmranhthua" => "current:hcmranhthua",
            "cTxcfgpXGMZ8rGqpf" | "hocmon-quyhoach" => "planning:hocmon-quyhoach",
            "BaLK92icvQg2awxz8" | "vungtau" => "current:vungtau",
            "QavEEcu6Fx2gDen2k" | "binhduong" => "current:binhduong",
            "fsBv4uSPwFB9d7zeg" | "binhphuoc" => "current:binhphuoc",
            "djm7B6fLhJtoAYuDM" | "danang" => "current:danang",
            "fFxLcSzcvzgx5rHyK" | "cantho" => "current:cantho",
            "7KkAr7ERakdMp3tbS" | "canthohientrangdatcapxa" => "current:canthohientrangdatcapxa",
            "eMTnaKydcJM9QAAT9" | "hungyen-caphuyen" => "planning:hungyen-caphuyen",
            "gmFgQru9HcN9y5rX4" | "hungyen-giaothong" => "planning:hungyen-giaothong",
            "iNX7xwrbZeBCC3GcN" | "hungyen-captinh" => "planning:hungyen-captinh",
            "z8X7GpkHxhHSKvq8e" | "hungyen" => "current:hungyen",
            "Ca4T2arWZYkFnoaEu" | "khanhhoa" => "current:khanhhoa",
            "vp38sWeHWCQFJ4WTG" | "ninhbinh" => "planning:ninhbinh",
            "QRnzz6boRN3bJLNDZ" | "longan" => "current:longan",
            "5JLsFZTuAXk4Sdv1M" | "communes2025fixed" => "adminunit:communes2025fixed",
            "KfwjvkZtuGgLpBsTp" | "provinces20251fixed" => "adminunit:provinces20251fixed",
            "SmrpvW7vkFDKmDSKp" | "districts" => "adminunit:districts",
            "9kgcQjqxu54h33Gi3" | "communes" => "adminunit:communes",
            "TKgBBt5Wrdu5zSTSs" | "moon" => "current:moon",
            other => other,
        }
    }

    /// Calculate Web Mercator (EPSG:3857) bounding box [min_x, min_y, max_x, max_y] for slippy tile (z, x, y)
    pub fn tile_to_epsg3857_bbox(z: u32, x: u32, y: u32) -> (f64, f64, f64, f64) {
        const ORIGIN_SHIFT: f64 = 20037508.342789244;
        let map_size = 2.0 * ORIGIN_SHIFT;
        let n = (1u64 << z.min(30)) as f64;
        let tile_size = map_size / n;

        let min_x = -ORIGIN_SHIFT + (x as f64) * tile_size;
        let max_x = -ORIGIN_SHIFT + ((x + 1) as f64) * tile_size;
        let max_y = ORIGIN_SHIFT - (y as f64) * tile_size;
        let min_y = ORIGIN_SHIFT - ((y + 1) as f64) * tile_size;

        (min_x, min_y, max_x, max_y)
    }

    /// Fetch WMS 256x256 PNG tile from GeoServer
    pub async fn get_wms_tile(
        &self,
        layer: &str,
        z: u32,
        x: u32,
        y: u32,
    ) -> Result<(Vec<u8>, String), String> {
        let resolved_layer = Self::resolve_layer_name(layer);
        let (min_x, min_y, max_x, max_y) = Self::tile_to_epsg3857_bbox(z, x, y);

        let url = format!(
            "{}/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS={}&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={:.6},{:.6},{:.6},{:.6}",
            self.base_url,
            urlencoding::encode(resolved_layer),
            min_x,
            min_y,
            max_x,
            max_y
        );

        let sem = get_geoserver_semaphore();
        let _permit = sem.acquire().await.map_err(|e| e.to_string())?;

        let res = self
            .client
            .get(&url)
            .timeout(Duration::from_secs(6))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !res.status().is_success() {
            return Err(format!("GeoServer returned HTTP {}", res.status()));
        }

        let content_type = res
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("image/png")
            .to_string();

        let bytes = res.bytes().await.map_err(|e| e.to_string())?.to_vec();
        Ok((bytes, content_type))
    }

    pub async fn get_parcel_by_uuid(&self, uuid: &str) -> Result<Option<serde_json::Value>, String> {
        let is_feature_id = uuid.contains('.') || uuid.chars().all(|c| c.is_ascii_digit());
        let id_filter = if is_feature_id {
            format!("&FEATUREID={}", urlencoding::encode(uuid))
        } else {
            format!("&CQL_FILTER=uuid='{}'", urlencoding::encode(uuid))
        };

        let url = format!(
            "{}/wfs?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME={}&OUTPUTFORMAT=application/json{}&MAXFEATURES=1",
            self.base_url,
            urlencoding::encode(&self.parcel_layer),
            id_filter
        );

        let res = self
            .client
            .get(&url)
            .timeout(Duration::from_millis(2500))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !res.status().is_success() {
            return Ok(None);
        }

        let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
        if let Some(features) = json.get("features").and_then(|f| f.as_array()) {
            if let Some(first) = features.first() {
                return Ok(Some(first.clone()));
            }
        }

        Ok(None)
    }

    pub async fn get_parcel_by_coords(&self, lat: f64, lon: f64) -> Result<Option<serde_json::Value>, String> {
        // Fast spatial index BBOX query (~6m radius around click) with 2.5s timeout
        let d = 0.00006;
        let cql = format!(
            "BBOX(geom,{:.6},{:.6},{:.6},{:.6},'EPSG:4326')",
            lon - d,
            lat - d,
            lon + d,
            lat + d
        );
        let url = format!(
            "{}/wfs?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME={}&OUTPUTFORMAT=application/json&CQL_FILTER={}&MAXFEATURES=1",
            self.base_url,
            urlencoding::encode(&self.parcel_layer),
            urlencoding::encode(&cql)
        );

        let res = self
            .client
            .get(&url)
            .timeout(Duration::from_millis(2500))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !res.status().is_success() {
            return Ok(None);
        }

        let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
        if let Some(features) = json.get("features").and_then(|f| f.as_array()) {
            if let Some(first) = features.first() {
                return Ok(Some(first.clone()));
            }
        }

        Ok(None)
    }
}

pub static TILE_CACHE: std::sync::OnceLock<tokio::sync::RwLock<std::collections::HashMap<String, Vec<u8>>>> = std::sync::OnceLock::new();

pub fn get_tile_cache() -> &'static tokio::sync::RwLock<std::collections::HashMap<String, Vec<u8>>> {
    TILE_CACHE.get_or_init(|| tokio::sync::RwLock::new(std::collections::HashMap::new()))
}

pub static GEOSERVER_SEMAPHORE: std::sync::OnceLock<tokio::sync::Semaphore> = std::sync::OnceLock::new();

pub fn get_geoserver_semaphore() -> &'static tokio::sync::Semaphore {
    GEOSERVER_SEMAPHORE.get_or_init(|| tokio::sync::Semaphore::new(6))
}


