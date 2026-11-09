import os
import pandas as pd
import numpy as np
import joblib
from datasets import load_dataset
from pg_source import load_listings
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_percentage_error
import time

def load_huggingface_data():
    print(f"1. Đang tải TOÀN BỘ records từ HuggingFace...")
    ds = load_dataset("tinixai/vietnam-real-estates", split="train")
    df = ds.to_pandas()
    
    # Filter valid price and area
    df = df[(df['price'] > 0) & (df['area'] > 10) & (df['area'] < 5000)]
        
    features = [
        'property_type_name', 'province_name', 'district_name', 'ward_name', 'street_name',
        'area', 'bedroom_count', 'bathroom_count', 'floor_count', 
        'frontage_width', 'house_direction', 'price'
    ]
    
    # Keep only relevant columns
    existing_features = [f for f in features if f in df.columns]
    df = df[existing_features].copy()
    
    for f in features:
        if f not in df.columns:
            df[f] = np.nan
            
    df['source'] = 'huggingface'
    return df

def load_pg_data(limit=None):
    print(f"2. Đang tải TOÀN BỘ records từ PostgreSQL...")
    cursor = load_listings(
        {'status': {'$gte': 1}},
        limit=limit,
        columns=['totalPrice', 'price', 'area', 'propertyType', 'location', 'adminunit', 'dynamicFields', 'direction'],
        order_by=None,  # order irrelevant (shuffled in split); avoids sorting millions of rows
    )
    
    records = []
    
    prop_type_map = {
        'nha_o': 'Nhà',
        'chung_cu': 'Căn hộ chung cư',
        'dat_nen': 'Đất',
        'biet_thu': 'Biệt thự/Nhà liền kề',
        'shophouse': 'Shophouse'
    }
    
    start_time = time.time()
    for doc in cursor:
        try:
            # Base info
            price = doc.get('totalPrice') or doc.get('price')
            area = doc.get('area')
            
            if not price or not area or area <= 10 or price <= 0:
                continue
                
            property_type_name = prop_type_map.get(doc.get('propertyType'), 'Nhà')
            
            # Location
            loc = doc.get('location') or {}
            province_name = loc.get('province') or (doc.get('adminunit') or {}).get('province') or ''
            district_name = loc.get('district') or ''
            ward_name = loc.get('ward') or ''
            street_name = loc.get('road') or ''
            
            # Dynamic fields
            dfields = doc.get('dynamicFields') or []
            bedroom_count = 0
            bathroom_count = 0
            floor_count = 0
            frontage_width = 0
            
            for df in dfields:
                val = df.get('value', 0)
                # Convert to float if possible
                try:
                    val = float(val)
                except:
                    continue
                    
                df_id = df.get('_id')
                if df_id == 'bedrooms':
                    bedroom_count = val
                elif df_id == 'bathrooms':
                    bathroom_count = val
                elif df_id == 'floor':
                    floor_count = val
                elif df_id == 'facade':
                    frontage_width = val
            
            records.append({
                'property_type_name': property_type_name,
                'province_name': str(province_name).replace('Thành phố ', '').replace('Tỉnh ', ''),
                'district_name': str(district_name).replace('Quận ', '').replace('Huyện ', ''),
                'ward_name': str(ward_name).replace('Phường ', '').replace('Xã ', ''),
                'street_name': str(street_name).replace('Đường ', ''),
                'area': float(area),
                'bedroom_count': float(bedroom_count),
                'bathroom_count': float(bathroom_count),
                'floor_count': float(floor_count),
                'frontage_width': float(frontage_width),
                'house_direction': doc.get('direction') or 'Unknown',
                'price': float(price),
                'source': 'postgres'
            })
        except Exception as e:
            continue
            
    df = pd.DataFrame(records)
    print(f"  -> Tải xong {len(df)} hợp lệ từ PostgreSQL trong {time.time()-start_time:.1f}s.")
    return df

def preprocess_data(df):
    print("3. Đang tiền xử lý dữ liệu...")
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
        # Strip string to avoid 'Ha Noi' vs ' Ha Noi ' mismatch
        X[col] = X[col].astype(str).str.strip().fillna('Unknown')
        X.loc[X[col] == '', col] = 'Unknown'
        X.loc[X[col] == 'nan', col] = 'Unknown'
        
    # Encode categorical features
    encoders = {}
    for col in cat_cols:
        le = LabelEncoder()
        unique_vals = list(X[col].unique())
        unique_vals.append('Unknown_inference')
        le.fit(unique_vals)
        X[col] = le.transform(X[col])
        encoders[col] = le
        
    return X, y, encoders

def train_model(X_train, y_train, X_test, y_test):
    print("4. Bắt đầu huấn luyện XGBoost Siêu việt...")
    model = xgb.XGBRegressor(
        n_estimators=1000,
        learning_rate=0.03,
        max_depth=9,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
        eval_metric='mape',
        tree_method='hist' # Faster for 1M+ rows
    )
    
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=100
    )
    
    return model

def main():
    import gc
    # 1. Load HF Data
    df_hf = load_huggingface_data()
    
    # 2. Load PostgreSQL Data
    df_mongo = load_pg_data()
    
    # 3. Combine
    df = pd.concat([df_hf, df_mongo], ignore_index=True)
    del df_hf
    del df_mongo
    gc.collect()
    print(f"Kích thước dữ liệu huấn luyện tổng hợp: {df.shape}")
    
    # 4. Preprocess
    X, y, encoders = preprocess_data(df)
    
    y_log = np.log1p(y)
    
    # 5. Split
    X_train, X_test, y_train_log, y_test_log = train_test_split(X, y_log, test_size=0.1, random_state=42)
    
    # 6. Train
    model = train_model(X_train, y_train_log, X_test, y_test_log)
    
    # 7. Evaluate
    print("5. Đang đánh giá siêu mô hình trên tập test...")
    y_pred_log = model.predict(X_test)
    y_pred = np.expm1(y_pred_log)
    y_test_real = np.expm1(y_test_log)
    
    mape = mean_absolute_percentage_error(y_test_real, y_pred)
    print(f"=> Sai số trung bình tuyệt đối (MAPE): {mape * 100:.2f}%")
    
    # 8. Save
    print("6. Đang lưu mô hình...")
    model.save_model("model.xgb")
    joblib.dump(encoders, "encoders.pkl")
    print("Hoàn thành quá trình xây dựng siêu mô hình!")

if __name__ == "__main__":
    main()
