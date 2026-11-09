import argparse
import pandas as pd
import numpy as np
import joblib
from datasets import load_dataset
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_percentage_error
import xgboost as xgb
import os

def load_data(sample_size=None, province=None):
    print("Đang tải dữ liệu từ HuggingFace...")
    ds = load_dataset("tinixai/vietnam-real-estates", split="train")
    df = ds.to_pandas()
    
    # Filter valid price and area
    df = df[(df['price'] > 0) & (df['area'] > 10) & (df['area'] < 5000)]
    
    if province:
        df = df[df['province_name'] == province]
        
    if sample_size and sample_size < len(df):
        print(f"Lấy mẫu {sample_size} records từ tổng {len(df)} records...")
        df = df.sample(sample_size, random_state=42)
        
    return df

def preprocess_data(df):
    print("Đang tiền xử lý dữ liệu...")
    # Select features
    features = [
        'property_type_name', 'province_name', 'district_name', 'ward_name', 'street_name',
        'area', 'bedroom_count', 'bathroom_count', 'floor_count', 
        'frontage_width', 'house_direction'
    ]
    target = 'price'
    
    X = df[features].copy()
    y = df[target].copy()
    
    # Handle missing numerical values
    num_cols = ['area', 'bedroom_count', 'bathroom_count', 'floor_count', 'frontage_width']
    for col in num_cols:
        X[col] = pd.to_numeric(X[col], errors='coerce').fillna(0)
        
    # Handle missing categorical values
    cat_cols = ['property_type_name', 'province_name', 'district_name', 'ward_name', 'street_name', 'house_direction']
    for col in cat_cols:
        X[col] = X[col].fillna('Unknown')
        
    # Encode categorical features
    encoders = {}
    for col in cat_cols:
        le = LabelEncoder()
        # Add a placeholder for unknown categories during inference
        unique_vals = list(X[col].unique())
        unique_vals.append('Unknown_inference')
        le.fit(unique_vals)
        X[col] = le.transform(X[col])
        encoders[col] = le
        
    return X, y, encoders

def train_model(X_train, y_train, X_test, y_test):
    print("Bắt đầu huấn luyện XGBoost...")
    model = xgb.XGBRegressor(
        n_estimators=500,
        learning_rate=0.05,
        max_depth=8,
        random_state=42,
        n_jobs=-1,
        eval_metric='mape'
    )
    
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=50
    )
    
    return model

def main():
    parser = argparse.ArgumentParser(description="Train Real Estate Price Prediction Model")
    parser.add_argument("--sample", type=int, default=300000, help="Number of records to sample")
    parser.add_argument("--province", type=str, default=None, help="Filter by province (e.g. 'Hà Nội')")
    parser.add_argument("--model-path", type=str, default="model.xgb", help="Path to save XGBoost model")
    parser.add_argument("--encoder-path", type=str, default="encoders.pkl", help="Path to save LabelEncoders")
    args = parser.parse_args()

    # 1. Load data
    df = load_data(sample_size=args.sample, province=args.province)
    print(f"Kích thước dữ liệu huấn luyện: {df.shape}")
    
    # 2. Preprocess
    X, y, encoders = preprocess_data(df)
    
    # Predict log(price) to handle wide range of prices better
    y_log = np.log1p(y)
    
    # 3. Split
    X_train, X_test, y_train_log, y_test_log = train_test_split(X, y_log, test_size=0.2, random_state=42)
    
    # 4. Train
    model = train_model(X_train, y_train_log, X_test, y_test_log)
    
    # 5. Evaluate
    print("Đang đánh giá mô hình trên tập test...")
    y_pred_log = model.predict(X_test)
    y_pred = np.expm1(y_pred_log)
    y_test_real = np.expm1(y_test_log)
    
    mape = mean_absolute_percentage_error(y_test_real, y_pred)
    print(f"Sai số trung bình tuyệt đối (MAPE): {mape * 100:.2f}%")
    
    # 6. Save
    print("Đang lưu mô hình...")
    model.save_model(args.model_path)
    joblib.dump(encoders, args.encoder_path)
    
    # Save a small sample for API testing
    sample_input = df[['property_type_name', 'province_name', 'district_name', 'ward_name', 'street_name', 'area', 'bedroom_count', 'bathroom_count', 'floor_count', 'frontage_width', 'house_direction']].iloc[0].to_dict()
    print(f"Ví dụ input: {sample_input}")
    print(f"Giá thực tế: {df['price'].iloc[0]:,.0f} VND")
    
    print("Hoàn thành!")

if __name__ == "__main__":
    main()
