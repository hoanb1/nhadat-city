import joblib
import pandas as pd
import numpy as np
import xgboost as xgb

try:
    print("Loading model and encoders...")
    model = xgb.XGBRegressor()
    model.load_model("model.xgb")
    encoders = joblib.load("encoders.pkl")
    print("Load successful!")

    data = {
        "property_type_name": "Nhà riêng",
        "province_name": "Hà Nội",
        "district_name": "Quận Cầu Giấy",
        "ward_name": "Phường Dịch Vọng",
        "street_name": "Đường Cầu Giấy",
        "area": 50.0,
        "bedroom_count": 3.0,
        "bathroom_count": 2.0,
        "floor_count": 4.0,
        "frontage_width": 4.0,
        "house_direction": "Đông Nam"
    }

    df = pd.DataFrame([data])

    cat_cols = ['property_type_name', 'province_name', 'district_name', 'ward_name', 'street_name', 'house_direction']
    for col in cat_cols:
        val = df[col].iloc[0]
        if val in encoders[col].classes_:
            df[col] = encoders[col].transform([val])
        else:
            df[col] = encoders[col].transform(['Unknown_inference'])

    pred_log = model.predict(df)[0]
    pred_real = float(np.expm1(pred_log))

    print("-" * 30)
    print("Test Input Data:")
    for k, v in data.items():
        print(f"  {k}: {v}")
    
    print(f"\n=> Estimated Price: {pred_real:,.0f} VND")
    if pred_real >= 1_000_000_000:
        print(f"=> Formatted Price: {pred_real / 1_000_000_000:.2f} tỷ")
    elif pred_real >= 1_000_000:
        print(f"=> Formatted Price: {pred_real / 1_000_000:.0f} triệu")

except Exception as e:
    print(f"Error during test: {e}")
