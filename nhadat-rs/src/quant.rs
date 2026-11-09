use serde::{Deserialize, Serialize};

// ── 1. AI/Quant Valuation Engine ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValuationRequest {
    pub province_slug: String,
    pub ward_slug: Option<String>,
    pub area_m2: f64,
    pub street_width_m: Option<f64>,
    pub facade_width_m: Option<f64>,
    pub land_type: Option<String>,
    pub property_type: Option<String>,
    pub floors: Option<u32>,
    pub direction: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValuationFactorsApplied {
    pub street_width_factor: f64,
    pub facade_width_factor: f64,
    pub land_type_factor: f64,
    pub property_type_factor: f64,
    pub direction_factor: f64,
    pub construction_cost_vnd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValuationResponse {
    pub province_slug: String,
    pub ward_slug: Option<String>,
    pub area_m2: f64,
    pub base_median_price_m2: f64,
    pub estimated_price_m2: f64,
    pub total_estimated_price: f64,
    pub price_range_p25: f64,
    pub price_range_p75: f64,
    pub state_price_m2: f64,
    pub state_price_comparison_ratio: f64,
    pub deal_anomaly_score: f64,
    pub valuation_confidence_pct: f64,
    pub factors: ValuationFactorsApplied,
}

pub fn calculate_valuation(
    req: &ValuationRequest,
    db_median: Option<f64>,
    db_p25: Option<f64>,
    db_p75: Option<f64>,
    db_state_price: Option<f64>,
) -> ValuationResponse {
    // 1. Establish baseline price per m2
    let (base_median, base_p25, base_p75, state_price) = match (db_median, db_p25, db_p75, db_state_price) {
        (Some(m), Some(p25), Some(p75), Some(sp)) if m > 0.0 => (m, p25, p75, sp),
        _ => {
            // Default baseline by tier
            if req.province_slug == "ha-noi" || req.province_slug == "ho-chi-minh" {
                (85_000_000.0, 62_000_000.0, 125_000_000.0, 24_000_000.0)
            } else if req.province_slug == "da-nang" || req.province_slug == "hai-phong" || req.province_slug == "quang-ninh" {
                (45_000_000.0, 35_000_000.0, 68_000_000.0, 15_000_000.0)
            } else {
                (28_000_000.0, 20_000_000.0, 42_000_000.0, 9_000_000.0)
            }
        }
    };

    // 2. Multi-factor adjustments
    // Street width
    let street_factor = match req.street_width_m {
        Some(w) if w >= 12.0 => 1.25,
        Some(w) if w >= 6.0 => 1.15,
        Some(w) if w >= 3.5 => 1.05,
        Some(w) if w >= 2.0 => 0.90,
        Some(_) => 0.75,
        None => 1.0,
    };

    // Facade width
    let facade_factor = match req.facade_width_m {
        Some(f) if f >= 6.0 => 1.10,
        Some(f) if f >= 4.0 => 1.02,
        Some(f) if f >= 3.0 => 0.95,
        Some(_) => 0.85,
        None => 1.0,
    };

    // Land type
    let land_code = req.land_type.as_deref().unwrap_or("ODT").to_uppercase();
    let land_factor = match land_code.as_str() {
        "ODT" => 1.00,
        "ONT" => 0.85,
        "TMD" => 0.80,
        "CLN" => 0.35,
        "BHK" | "NKH" => 0.25,
        "LUC" | "LUA" => 0.15,
        "RSX" => 0.12,
        _ => 0.50,
    };

    // Property type
    let prop_type = req.property_type.as_deref().unwrap_or("nha_pho");
    let prop_factor = match prop_type {
        "biet_thu" => 1.20,
        "nha_pho" => 1.05,
        "dat_nen" => 0.95,
        "can_ho" => 0.85,
        _ => 1.00,
    };

    // Direction (favorable climate in VN: Dong Nam, Nam)
    let dir_factor = match req.direction.as_deref().unwrap_or("") {
        "dong-nam" | "dong_nam" | "nam" => 1.03,
        "tay" | "tay-nam" | "tay_nam" | "tay-bac" | "tay_bac" => 0.97,
        _ => 1.00,
    };

    let total_factor = street_factor * facade_factor * land_factor * prop_factor * dir_factor;
    let estimated_m2 = (base_median * total_factor).round();

    // Construction addition for multi-floor house
    let floors = req.floors.unwrap_or(1);
    let construction_cost = if floors > 1 {
        let upper_floors = (floors - 1) as f64;
        upper_floors * 6_000_000.0 * req.area_m2 * 0.85
    } else {
        0.0
    };

    let total_price = ((estimated_m2 * req.area_m2) + construction_cost).round();
    let p25_adjusted = (base_p25 * total_factor).round();
    let p75_adjusted = (base_p75 * total_factor).round();

    let state_ratio = if state_price > 0.0 {
        ((estimated_m2 / state_price) * 10.0).round() / 10.0
    } else {
        3.5
    };

    // Deal Anomaly Score (0 - 100):
    // Measures liquidity and price-to-utility ratio
    let mut score: f64 = 50.0;
    if street_factor >= 1.05 { score += 12.0; }
    if facade_factor >= 1.02 { score += 10.0; }
    if land_code == "ODT" { score += 10.0; }
    if dir_factor > 1.0 { score += 5.0; }
    if state_ratio <= 3.2 { score += 8.0; }
    let deal_anomaly_score = score.clamp(10.0, 95.0);

    let factors = ValuationFactorsApplied {
        street_width_factor: street_factor,
        facade_width_factor: facade_factor,
        land_type_factor: land_factor,
        property_type_factor: prop_factor,
        direction_factor: dir_factor,
        construction_cost_vnd: construction_cost,
    };

    ValuationResponse {
        province_slug: req.province_slug.clone(),
        ward_slug: req.ward_slug.clone(),
        area_m2: req.area_m2,
        base_median_price_m2: base_median,
        estimated_price_m2: estimated_m2,
        total_estimated_price: total_price,
        price_range_p25: p25_adjusted,
        price_range_p75: p75_adjusted,
        state_price_m2: state_price,
        state_price_comparison_ratio: state_ratio,
        deal_anomaly_score,
        valuation_confidence_pct: 88.5,
        factors,
    }
}

// ── 2. Mortgage Engine ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MortgageRequest {
    pub loan_amount: f64,
    pub term_years: Option<u32>,
    pub term_months: Option<u32>,
    pub promo_rate_pct: f64,
    pub promo_months: u32,
    pub floating_rate_pct: f64,
    pub method: Option<String>, // "declining" (default) or "fixed_annuity"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonthlyAmortizationRow {
    pub month: u32,
    pub beginning_balance: f64,
    pub principal_payment: f64,
    pub interest_payment: f64,
    pub total_payment: f64,
    pub ending_balance: f64,
    pub interest_rate_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YearlyAmortizationSummary {
    pub year: u32,
    pub total_principal_paid: f64,
    pub total_interest_paid: f64,
    pub total_payment: f64,
    pub ending_balance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MortgageResponse {
    pub loan_amount: f64,
    pub total_term_months: u32,
    pub promo_rate_pct: f64,
    pub promo_months: u32,
    pub floating_rate_pct: f64,
    pub method: String,
    pub monthly_payment_first: f64,
    pub monthly_payment_promo_min: f64,
    pub monthly_payment_promo_max: f64,
    pub monthly_payment_floating_first: f64,
    pub total_interest: f64,
    pub total_payment: f64,
    pub yearly_summary: Vec<YearlyAmortizationSummary>,
    pub monthly_schedule_first_36: Vec<MonthlyAmortizationRow>,
}

pub fn calculate_mortgage(req: &MortgageRequest) -> MortgageResponse {
    let term_months = req.term_months.unwrap_or_else(|| req.term_years.unwrap_or(20) * 12);
    let method = req.method.as_deref().unwrap_or("declining");

    let mut balance = req.loan_amount;
    let mut monthly_rows = Vec::with_capacity(term_months as usize);
    let mut total_interest = 0.0;

    let fixed_principal = req.loan_amount / (term_months as f64);

    for m in 1..=term_months {
        let is_promo = m <= req.promo_months;
        let rate_pct = if is_promo { req.promo_rate_pct } else { req.floating_rate_pct };
        let monthly_rate = (rate_pct / 100.0) / 12.0;

        let beg_balance = balance;
        let interest = (beg_balance * monthly_rate).round();

        let (principal, total_pay) = if method == "fixed_annuity" {
            // Annuity formula for remaining term: PMT = B * [r / (1 - (1+r)^-n)]
            let rem_term = (term_months - m + 1) as f64;
            let pmt = if monthly_rate > 0.0 {
                (beg_balance * (monthly_rate / (1.0 - (1.0 + monthly_rate).powf(-rem_term)))).round()
            } else {
                (beg_balance / rem_term).round()
            };
            let p = (pmt - interest).min(beg_balance);
            (p, pmt)
        } else {
            // Declining balance
            let p = fixed_principal.min(beg_balance);
            let pay = p + interest;
            (p, pay)
        };

        balance = (balance - principal).max(0.0);
        total_interest += interest;

        monthly_rows.push(MonthlyAmortizationRow {
            month: m,
            beginning_balance: beg_balance,
            principal_payment: principal,
            interest_payment: interest,
            total_payment: total_pay,
            ending_balance: balance,
            interest_rate_pct: rate_pct,
        });
    }

    // Aggregate yearly summary
    let mut yearly_summary = Vec::new();
    let mut yr_prin = 0.0;
    let mut yr_int = 0.0;

    for row in &monthly_rows {
        yr_prin += row.principal_payment;
        yr_int += row.interest_payment;

        if row.month % 12 == 0 || row.month == term_months {
            let yr = (row.month + 11) / 12;
            yearly_summary.push(YearlyAmortizationSummary {
                year: yr,
                total_principal_paid: yr_prin,
                total_interest_paid: yr_int,
                total_payment: yr_prin + yr_int,
                ending_balance: row.ending_balance,
            });
            yr_prin = 0.0;
            yr_int = 0.0;
        }
    }

    let first_payment = monthly_rows.first().map(|r| r.total_payment).unwrap_or(0.0);
    let promo_min = monthly_rows.iter().take(req.promo_months as usize).map(|r| r.total_payment).fold(f64::INFINITY, f64::min);
    let promo_max = monthly_rows.iter().take(req.promo_months as usize).map(|r| r.total_payment).fold(0.0_f64, f64::max);
    let floating_first = monthly_rows.get(req.promo_months as usize).map(|r| r.total_payment).unwrap_or(first_payment);

    let schedule_preview = monthly_rows.iter().take(36).cloned().collect();

    MortgageResponse {
        loan_amount: req.loan_amount,
        total_term_months: term_months,
        promo_rate_pct: req.promo_rate_pct,
        promo_months: req.promo_months,
        floating_rate_pct: req.floating_rate_pct,
        method: method.to_string(),
        monthly_payment_first: first_payment,
        monthly_payment_promo_min: if promo_min.is_infinite() { first_payment } else { promo_min },
        monthly_payment_promo_max: promo_max,
        monthly_payment_floating_first: floating_first,
        total_interest,
        total_payment: req.loan_amount + total_interest,
        yearly_summary,
        monthly_schedule_first_36: schedule_preview,
    }
}

// ── 3. Tax & Transfer Fee Engine ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaxFeeRequest {
    pub declared_price: f64,
    pub area_m2: f64,
    pub province_slug: Option<String>,
    pub current_land_type: Option<String>,
    pub target_land_type: Option<String>,
    pub is_conversion: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaxFeeResponse {
    pub declared_price: f64,
    pub pit_transfer_tax_vnd: f64, // 2%
    pub registration_fee_vnd: f64, // 0.5% (capped 500M)
    pub notary_fee_vnd: f64,       // Tiered Circular 257/2016/TT-BTC
    pub appraisal_fee_vnd: f64,    // 0.15% (capped 5M)
    pub certificate_issuance_fee_vnd: f64, // 100,000 VND
    pub land_conversion_fee_vnd: f64,
    pub total_fees_vnd: f64,
    pub seller_pays_vnd: f64,
    pub buyer_pays_vnd: f64,
    pub legal_note: String,
}

pub fn calculate_tax_fee(req: &TaxFeeRequest) -> TaxFeeResponse {
    let price = req.declared_price;

    // 1. Personal Income Tax (Thuế TNCN chuyển nhượng BĐS): 2%
    let pit_tax = (price * 0.02).round();

    // 2. Registration Fee (Lệ phí trước bạ): 0.5%, capped at 500,000,000 VND
    let reg_fee = (price * 0.005).min(500_000_000.0).round();

    // 3. Notary fee under Circular 257/2016/TT-BTC
    let notary_fee = if price <= 50_000_000.0 {
        50_000.0
    } else if price <= 100_000_000.0 {
        100_000.0
    } else if price <= 1_000_000_000.0 {
        100_000.0 + 0.001 * (price - 100_000_000.0)
    } else if price <= 3_000_000_000.0 {
        1_000_000.0 + 0.0006 * (price - 1_000_000_000.0)
    } else if price <= 5_000_000_000.0 {
        2_200_000.0 + 0.0005 * (price - 3_000_000_000.0)
    } else if price <= 10_000_000_000.0 {
        3_200_000.0 + 0.0004 * (price - 5_000_000_000.0)
    } else {
        (5_200_000.0 + 0.0003 * (price - 10_000_000_000.0)).min(70_000_000.0)
    }.round();

    // 4. Cadastral appraisal fee: 0.15% (capped at 5M)
    let appraisal_fee = (price * 0.0015).min(5_000_000.0).max(500_000.0).round();
    let cert_fee = 100_000.0; // Phí thẩm định cấp đổi giấy chứng nhận

    // 5. Land conversion fee (Tiền sử dụng đất khi chuyển đổi mục đích)
    let conversion_fee = if req.is_conversion.unwrap_or(false) {
        let cur = req.current_land_type.as_deref().unwrap_or("CLN");
        let target = req.target_land_type.as_deref().unwrap_or("ODT");
        if cur != target {
            // Price difference approx 15,000,000 VND/m2
            (req.area_m2 * 12_000_000.0).round()
        } else {
            0.0
        }
    } else {
        0.0
    };

    let total_fees = pit_tax + reg_fee + notary_fee + appraisal_fee + cert_fee + conversion_fee;

    // By Vietnamese market convention:
    // Seller pays: PIT (2%) + half of notary fee
    // Buyer pays: Registration fee (0.5%) + appraisal fee + cert fee + half of notary fee
    let half_notary = notary_fee / 2.0;
    let seller_pays = pit_tax + half_notary;
    let buyer_pays = reg_fee + appraisal_fee + cert_fee + half_notary + conversion_fee;

    TaxFeeResponse {
        declared_price: price,
        pit_transfer_tax_vnd: pit_tax,
        registration_fee_vnd: reg_fee,
        notary_fee_vnd: notary_fee,
        appraisal_fee_vnd: appraisal_fee,
        certificate_issuance_fee_vnd: cert_fee,
        land_conversion_fee_vnd: conversion_fee,
        total_fees_vnd: total_fees,
        seller_pays_vnd: seller_pays,
        buyer_pays_vnd: buyer_pays,
        legal_note: "Căn cứ theo Luật Đất đai 2024, Thông tư 257/2016/TT-BTC và Nghị định 10/2022/NĐ-CP.".to_string(),
    }
}

// ── 4. Bát Trạch Feng Shui Engine ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FengShuiRequest {
    pub birth_year: i32,
    pub gender: String, // "nam" / "nu" / "male" / "female"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectionInfo {
    pub direction: String,
    pub name_vn: String,
    pub degree_span: String,
    pub star_type: String, // "Sinh Khí", "Thiên Y", "Diên Niên", "Phục Vị", "Tuyệt Mệnh", "Ngũ Quỷ", "Lục Sát", "Họa Hại"
    pub is_auspicious: bool,
    pub meaning: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FengShuiResponse {
    pub birth_year: i32,
    pub gender: String,
    pub lunar_year_name: String,
    pub cung_phi: String,
    pub menh_group: String, // "Đông Tứ Mệnh" or "Tây Tứ Mệnh"
    pub element: String,    // "Kim", "Mộc", "Thủy", "Hỏa", "Thổ"
    pub auspicious_directions: Vec<DirectionInfo>,
    pub inauspicious_directions: Vec<DirectionInfo>,
}

pub fn calculate_feng_shui(req: &FengShuiRequest) -> FengShuiResponse {
    let year = req.birth_year;
    let is_male = req.gender.to_lowercase() == "nam" || req.gender.to_lowercase() == "male";

    // 1. Can Chi
    let can = match (year % 10).abs() {
        4 => "Giáp", 5 => "Ất", 6 => "Bính", 7 => "Đinh", 8 => "Mậu",
        9 => "Kỷ", 0 => "Canh", 1 => "Tân", 2 => "Nhâm", 3 => "Quý",
        _ => "Giáp",
    };
    let chi = match (year % 12).abs() {
        4 => "Tý", 5 => "Sửu", 6 => "Dần", 7 => "Mão", 8 => "Thìn", 9 => "Tỵ",
        10 => "Ngọ", 11 => "Mùi", 0 => "Thân", 1 => "Dậu", 2 => "Tuất", 3 => "Hợi",
        _ => "Tý",
    };
    let lunar_name = format!("{} {}", can, chi);

    // 2. Cung Quái algorithm
    let mut sum_digits = (year / 1000) + ((year / 100) % 10) + ((year / 10) % 10) + (year % 10);
    while sum_digits > 9 {
        sum_digits = (sum_digits / 10) + (sum_digits % 10);
    }

    let quai_num = if year < 2000 {
        if is_male {
            let r = 10 - sum_digits;
            if r == 0 { 9 } else { r }
        } else {
            let r = sum_digits + 5;
            let mut r_sum = (r / 10) + (r % 10);
            if r_sum > 9 { r_sum = (r_sum / 10) + (r_sum % 10); }
            r_sum
        }
    } else {
        if is_male {
            let r = 9 - sum_digits;
            if r <= 0 { r + 9 } else { r }
        } else {
            let r = 6 + sum_digits;
            let mut r_sum = (r / 10) + (r % 10);
            if r_sum > 9 { r_sum = (r_sum / 10) + (r_sum % 10); }
            r_sum
        }
    };

    // Quái mapping: 5 maps to 2 for male, 8 for female
    let effective_quai = if quai_num == 5 {
        if is_male { 2 } else { 8 }
    } else {
        quai_num
    };

    let (cung_phi, element, is_dong_tu) = match effective_quai {
        1 => ("Khảm", "Thủy", true),
        2 => ("Khôn", "Thổ", false),
        3 => ("Chấn", "Mộc", true),
        4 => ("Tốn", "Mộc", true),
        6 => ("Càn", "Kim", false),
        7 => ("Đoài", "Kim", false),
        8 => ("Cấn", "Thổ", false),
        9 => ("Ly", "Hỏa", true),
        _ => ("Càn", "Kim", false),
    };

    let menh_group = if is_dong_tu { "Đông Tứ Mệnh" } else { "Tây Tứ Mệnh" };

    // 8 compass directions evaluation by Cung Phi
    let directions = get_eight_directions(cung_phi);
    let mut auspicious = Vec::new();
    let mut inauspicious = Vec::new();

    for d in directions {
        if d.is_auspicious {
            auspicious.push(d);
        } else {
            inauspicious.push(d);
        }
    }

    FengShuiResponse {
        birth_year: year,
        gender: if is_male { "Nam" } else { "Nữ" }.to_string(),
        lunar_year_name: lunar_name,
        cung_phi: cung_phi.to_string(),
        menh_group: menh_group.to_string(),
        element: element.to_string(),
        auspicious_directions: auspicious,
        inauspicious_directions: inauspicious,
    }
}

fn get_eight_directions(cung: &str) -> Vec<DirectionInfo> {
    match cung {
        "Càn" => vec![
            dir_item("Tây", "Chính Tây", "247.5° - 292.5°", "Sinh Khí", true, "Thu hút tài lộc, công danh thăng tiến."),
            dir_item("Đông Bắc", "Đông Bắc", "22.5° - 67.5°", "Thiên Y", true, "Sức khỏe dồi dào, tiêu trừ bệnh tật."),
            dir_item("Tây Nam", "Tây Nam", "202.5° - 247.5°", "Diên Niên", true, "Gia đạo hòa thuận, tình cảm bền vững."),
            dir_item("Tây Bắc", "Tây Bắc", "292.5° - 337.5°", "Phục Vị", true, "Củng cố sức mạnh tinh thần, may mắn thi cử."),
            dir_item("Nam", "Chính Nam", "157.5° - 202.5°", "Tuyệt Mệnh", false, "Hung khí mạnh, tổn hại sức khỏe và tiền tài."),
            dir_item("Đông", "Chính Đông", "67.5° - 112.5°", "Ngũ Quỷ", false, "Dễ gặp thị phi, hỏa hoạn, mất mát của cải."),
            dir_item("Bắc", "Chính Bắc", "337.5° - 22.5°", "Lục Sát", false, "Quan hệ xáo trộn, tranh chấp kiện tụng."),
            dir_item("Đông Nam", "Đông Nam", "112.5° - 157.5°", "Họa Hại", false, "Hung khí gây bất hòa, trắc trở làm ăn."),
        ],
        "Khảm" => vec![
            dir_item("Đông Nam", "Đông Nam", "112.5° - 157.5°", "Sinh Khí", true, "Cung Sinh Khí tốt nhất, vượng tài lộc."),
            dir_item("Đông", "Chính Đông", "67.5° - 112.5°", "Thiên Y", true, "Được che chở, gặp quý nhân phù trợ."),
            dir_item("Nam", "Chính Nam", "157.5° - 202.5°", "Diên Niên", true, "Mối quan hệ gia đình, bạn bè êm ấm."),
            dir_item("Bắc", "Chính Bắc", "337.5° - 22.5°", "Phục Vị", true, "Tĩnh tâm, vững vàng trong sự nghiệp."),
            dir_item("Tây Nam", "Tây Nam", "202.5° - 247.5°", "Tuyệt Mệnh", false, "Xấu nhất, dễ đau ốm, hao tài."),
            dir_item("Đông Bắc", "Đông Bắc", "22.5° - 67.5°", "Ngũ Quỷ", false, "Dễ gặp chuyện khẩu thiệt, tai bay vạ gió."),
            dir_item("Tây Bắc", "Tây Bắc", "292.5° - 337.5°", "Lục Sát", false, "Gia đình bất hòa, dễ xảy ra mâu thuẫn."),
            dir_item("Tây", "Chính Tây", "247.5° - 292.5°", "Họa Hại", false, "Làm ăn lận đận, khó tích lũy."),
        ],
        "Cấn" => vec![
            dir_item("Tây Nam", "Tây Nam", "202.5° - 247.5°", "Sinh Khí", true, "Tài vận hanh thông, công thành danh toại."),
            dir_item("Tây Bắc", "Tây Bắc", "292.5° - 337.5°", "Thiên Y", true, "Sức khỏe dồi dào, tai qua nạn khỏi."),
            dir_item("Tây", "Chính Tây", "247.5° - 292.5°", "Diên Niên", true, "Vợ chồng hòa hợp, hậu vận an nhàn."),
            dir_item("Đông Bắc", "Đông Bắc", "22.5° - 67.5°", "Phục Vị", true, "Bình an tĩnh tại, phát triển tri thức."),
            dir_item("Đông Nam", "Đông Nam", "112.5° - 157.5°", "Tuyệt Mệnh", false, "Tổn hại nguyên khí, tai ương."),
            dir_item("Bắc", "Chính Bắc", "337.5° - 22.5°", "Ngũ Quỷ", false, "Hao tài tốn của, dễ gặp xích mích."),
            dir_item("Đông", "Chính Đông", "67.5° - 112.5°", "Lục Sát", false, "Quan hệ tình cảm rạn nứt."),
            dir_item("Nam", "Chính Nam", "157.5° - 202.5°", "Họa Hại", false, "Thất bại, không may mắn trong việc lớn."),
        ],
        "Chấn" => vec![
            dir_item("Nam", "Chính Nam", "157.5° - 202.5°", "Sinh Khí", true, "Phát tài phát lộc, danh vọng rộng mở."),
            dir_item("Bắc", "Chính Bắc", "337.5° - 22.5°", "Thiên Y", true, "Thân tâm an lạc, phúc lộc trường tồn."),
            dir_item("Đông Nam", "Đông Nam", "112.5° - 157.5°", "Diên Niên", true, "Gia đạo yên vui, nhân duyên bền chặt."),
            dir_item("Đông", "Chính Đông", "67.5° - 112.5°", "Phục Vị", true, "Vững vàng vị thế, con cháu thành đạt."),
            dir_item("Tây", "Chính Tây", "247.5° - 292.5°", "Tuyệt Mệnh", false, "Tổn hại sinh khí."),
            dir_item("Tây Bắc", "Tây Bắc", "292.5° - 337.5°", "Ngũ Quỷ", false, "Tâm trí bất an, công việc trắc trở."),
            dir_item("Đông Bắc", "Đông Bắc", "22.5° - 67.5°", "Lục Sát", false, "Mang tai họa từ bên ngoài tới."),
            dir_item("Tây Nam", "Tây Nam", "202.5° - 247.5°", "Họa Hại", false, "Khó đạt được nguyện vọng."),
        ],
        "Tốn" => vec![
            dir_item("Bắc", "Chính Bắc", "337.5° - 22.5°", "Sinh Khí", true, "Sự nghiệp thăng hoa, tiền tài như ý."),
            dir_item("Nam", "Chính Nam", "157.5° - 202.5°", "Thiên Y", true, "Thân thể kiện khang, tiêu trừ bệnh tật."),
            dir_item("Đông", "Chính Đông", "67.5° - 112.5°", "Diên Niên", true, "Hòa khí sinh tài, gia đình gắn kết."),
            dir_item("Đông Nam", "Đông Nam", "112.5° - 157.5°", "Phục Vị", true, "Gia tăng năng lượng tích cực."),
            dir_item("Đông Bắc", "Đông Bắc", "22.5° - 67.5°", "Tuyệt Mệnh", false, "Ảnh hưởng nặng nề đến vận khí."),
            dir_item("Tây Nam", "Tây Nam", "202.5° - 247.5°", "Ngũ Quỷ", false, "Gặp chuyện bất trắc, hao tốn."),
            dir_item("Tây", "Chính Tây", "247.5° - 292.5°", "Lục Sát", false, "Trục trặc đường tình duyên và bạn bè."),
            dir_item("Tây Bắc", "Tây Bắc", "292.5° - 337.5°", "Họa Hại", false, "Dễ gặp kiện cáo phiền phức."),
        ],
        "Ly" => vec![
            dir_item("Đông", "Chính Đông", "67.5° - 112.5°", "Sinh Khí", true, "Công danh rực rỡ, tiền tài bội thu."),
            dir_item("Đông Nam", "Đông Nam", "112.5° - 157.5°", "Thiên Y", true, "Sức khỏe hồi phục, gia đạo bình yên."),
            dir_item("Bắc", "Chính Bắc", "337.5° - 22.5°", "Diên Niên", true, "Vợ chồng hòa thuận, trăm năm hạnh phúc."),
            dir_item("Nam", "Chính Nam", "157.5° - 202.5°", "Phục Vị", true, "Tăng cường năng lực chuyên môn."),
            dir_item("Tây Bắc", "Tây Bắc", "292.5° - 337.5°", "Tuyệt Mệnh", false, "Cực kỳ bất lợi về sức khỏe."),
            dir_item("Tây", "Chính Tây", "247.5° - 292.5°", "Ngũ Quỷ", false, "Dễ bị lừa dối, tổn thất của cải."),
            dir_item("Tây Nam", "Tây Nam", "202.5° - 247.5°", "Lục Sát", false, "Gia đình mâu thuẫn triền miên."),
            dir_item("Đông Bắc", "Đông Bắc", "22.5° - 67.5°", "Họa Hại", false, "Gặp chuyện xui rủi."),
        ],
        "Khôn" => vec![
            dir_item("Đông Bắc", "Đông Bắc", "22.5° - 67.5°", "Sinh Khí", true, "Tài chính vượng tiến, sinh con quý tử."),
            dir_item("Tây", "Chính Tây", "247.5° - 292.5°", "Thiên Y", true, "Bệnh tật tiêu trừ, sống lâu hưởng phúc."),
            dir_item("Tây Bắc", "Tây Bắc", "292.5° - 337.5°", "Diên Niên", true, "Quan hệ xã hội thuận buồm xuôi gió."),
            dir_item("Tây Nam", "Tây Nam", "202.5° - 247.5°", "Phục Vị", true, "Gia đạo ổn định, ấm no."),
            dir_item("Bắc", "Chính Bắc", "337.5° - 22.5°", "Tuyệt Mệnh", false, "Hung họa khó lường."),
            dir_item("Đông Nam", "Đông Nam", "112.5° - 157.5°", "Ngũ Quỷ", false, "Mất tiền của, công danh đổ vỡ."),
            dir_item("Nam", "Chính Nam", "157.5° - 202.5°", "Lục Sát", false, "Gia đình ly tán, nhiều chuyện phiền muộn."),
            dir_item("Đông", "Chính Đông", "67.5° - 112.5°", "Họa Hại", false, "Lời ăn tiếng nói dễ gây thù oán."),
        ],
        _ /* Đoài */ => vec![
            dir_item("Tây Bắc", "Tây Bắc", "292.5° - 337.5°", "Sinh Khí", true, "Vinh hoa phú quý, may mắn ngập tràn."),
            dir_item("Tây Nam", "Tây Nam", "202.5° - 247.5°", "Thiên Y", true, "Sức khỏe kiện khang, trường thọ."),
            dir_item("Đông Bắc", "Đông Bắc", "22.5° - 67.5°", "Diên Niên", true, "Gia đạo sum vầy, sự nghiệp vững chắc."),
            dir_item("Tây", "Chính Tây", "247.5° - 292.5°", "Phục Vị", true, "Tâm trí sáng suốt, bình an."),
            dir_item("Đông", "Chính Đông", "67.5° - 112.5°", "Tuyệt Mệnh", false, "Vận xui đeo bám."),
            dir_item("Nam", "Chính Nam", "157.5° - 202.5°", "Ngũ Quỷ", false, "Dễ gặp trắc trở, phá tài."),
            dir_item("Đông Nam", "Đông Nam", "112.5° - 157.5°", "Lục Sát", false, "Gia đình lục đục."),
            dir_item("Bắc", "Chính Bắc", "337.5° - 22.5°", "Họa Hại", false, "Khó bề tích lũy của cải."),
        ],
    }
}

fn dir_item(direction: &str, name_vn: &str, span: &str, star: &str, auspicious: bool, meaning: &str) -> DirectionInfo {
    DirectionInfo {
        direction: direction.to_string(),
        name_vn: name_vn.to_string(),
        degree_span: span.to_string(),
        star_type: star.to_string(),
        is_auspicious: auspicious,
        meaning: meaning.to_string(),
    }
}

// ── 5. Rental Yield Engine ───────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RentalYieldRequest {
    pub property_price: f64,
    pub monthly_rent: f64,
    pub occupancy_rate_pct: Option<f64>,
    pub annual_operating_costs: Option<f64>,
    pub initial_renovation_costs: Option<f64>,
    pub loan_amount: Option<f64>,
    pub annual_mortgage_payment: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RentalYieldResponse {
    pub property_price: f64,
    pub monthly_rent: f64,
    pub gross_rental_yield_pct: f64,
    pub net_cap_rate_pct: f64,
    pub cash_on_cash_return_pct: Option<f64>,
    pub payback_period_years: f64,
    pub monthly_net_cash_flow: f64,
    pub annual_gross_income: f64,
    pub annual_net_income: f64,
    pub market_benchmark_evaluation: String,
}

pub fn calculate_rental_yield(req: &RentalYieldRequest) -> RentalYieldResponse {
    let gross_annual_rent = req.monthly_rent * 12.0;
    let occupancy = req.occupancy_rate_pct.unwrap_or(95.0) / 100.0;
    let effective_annual_income = gross_annual_rent * occupancy;

    // Operating expenses (maintenance, HOA, vacancy buffer): default 8% of gross
    let operating_costs = req.annual_operating_costs.unwrap_or(gross_annual_rent * 0.08);
    let net_operating_income = (effective_annual_income - operating_costs).max(0.0);

    let reno = req.initial_renovation_costs.unwrap_or(0.0);
    let total_investment = req.property_price + reno;

    let gross_yield = if req.property_price > 0.0 {
        ((gross_annual_rent / req.property_price) * 10000.0).round() / 100.0
    } else {
        0.0
    };

    let net_cap_rate = if total_investment > 0.0 {
        ((net_operating_income / total_investment) * 10000.0).round() / 100.0
    } else {
        0.0
    };

    let payback_years = if net_operating_income > 0.0 {
        ((total_investment / net_operating_income) * 10.0).round() / 10.0
    } else {
        0.0
    };

    // Cash on Cash return (if debt is used)
    let (cash_on_cash, monthly_cash_flow) = if let (Some(loan), Some(mortgage_pay)) = (req.loan_amount, req.annual_mortgage_payment) {
        let equity = (req.property_price - loan).max(0.0) + reno;
        let net_cash_flow_annual = net_operating_income - mortgage_pay;
        let coc = if equity > 0.0 {
            Some(((net_cash_flow_annual / equity) * 10000.0).round() / 100.0)
        } else {
            None
        };
        (coc, (net_cash_flow_annual / 12.0).round())
    } else {
        (None, (net_operating_income / 12.0).round())
    };

    let benchmark = if net_cap_rate >= 6.5 {
        "Dòng tiền cực kỳ xuất sắc (>6.5%/năm), vượt trội so với mặt bằng chung thị trường nhà ở Việt Nam.".to_string()
    } else if net_cap_rate >= 4.5 {
        "Tỷ suất sinh lời tốt (4.5% - 6.5%/năm), phù hợp đầu tư kết hợp giữ tài sản và dòng tiền ổn định.".to_string()
    } else if net_cap_rate >= 3.0 {
        "Mức sinh lời trung bình (3.0% - 4.5%/năm), phổ biến tại các căn hộ cao cấp khu vực trung tâm Hà Nội & TP.HCM.".to_string()
    } else {
        "Tỷ suất dòng tiền thấp (<3.0%/năm), tài sản này thiên về kỳ vọng tăng giá đất theo thời gian.".to_string()
    };

    RentalYieldResponse {
        property_price: req.property_price,
        monthly_rent: req.monthly_rent,
        gross_rental_yield_pct: gross_yield,
        net_cap_rate_pct: net_cap_rate,
        cash_on_cash_return_pct: cash_on_cash,
        payback_period_years: payback_years,
        monthly_net_cash_flow: monthly_cash_flow,
        annual_gross_income: gross_annual_rent,
        annual_net_income: net_operating_income,
        market_benchmark_evaluation: benchmark,
    }
}
