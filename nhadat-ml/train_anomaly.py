import os
import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import IsolationForest
import time
from pg_source import load_listings
from train_super import preprocess_data

def load_sampled_data(max_samples=150000):
    """Load a balanced and memory-efficient sample for anomaly detection training."""
    import gc
    
    print("1.1 Tải dữ liệu mẫu từ PostgreSQL...")
    cursor = load_listings(
        {'status': {'$gte': 1}, 'totalPrice': {'$gt': 0}, 'area': {'$gt': 0}},
        columns=['propertyType', 'location', 'adminunit', 'totalPrice', 'price', 'area', 'dynamicFields', 'direction'],
        order_by=('createdAt', -1), limit=100000,
    )

    records = []
    prop_type_map = {
        'nha_o': 'Nhà',
        'chung_cu': 'Căn hộ chung cư',
        'dat_nen': 'Đất',
        'biet_thu': 'Biệt thự/Nhà liền kề',
        'shophouse': 'Shophouse'
    }
    
    for doc in cursor:
        try:
            price = doc.get('totalPrice') or doc.get('price')
            area = doc.get('area')
            if not price or not area or float(price) <= 0 or float(area) <= 0:
                continue
                
            loc = doc.get('location') or {}
            # dynamicFields is a list [{_id, value}] -> flat dict (old code called .get on the list => every row was skipped)
            dyn = {d.get('_id'): d.get('value') for d in (doc.get('dynamicFields') or []) if isinstance(d, dict)}
            
            records.append({
                'property_type_name': prop_type_map.get(doc.get('propertyType'), 'Nhà'),
                'province_name': str(loc.get('province') or (doc.get('adminunit') or {}).get('province') or '').replace('Thành phố ', '').replace('Tỉnh ', ''),
                'district_name': str((loc.get('district') or '')).replace('Quận ', '').replace('Huyện ', ''),
                'ward_name': str((loc.get('ward') or '')).replace('Phường ', '').replace('Xã ', ''),
                'street_name': str((loc.get('road') or '')),
                'area': float(area),
                'bedroom_count': float(dyn.get('bedrooms', 0) or 0),
                'bathroom_count': float(dyn.get('bathrooms', 0) or 0),
                'floor_count': float(dyn.get('floor', 0) or 0),
                'frontage_width': float(dyn.get('facade', 0) or 0),
                'house_direction': str(doc.get('direction') or 'Unknown'),
                'price': float(price),
                'source': 'postgres'
            })
        except Exception:
            continue
            
    df_mongo = pd.DataFrame(records)
    print(f"  -> Lấy được {len(df_mongo)} records từ PostgreSQL.")
    
    del records
    gc.collect()
    
    if len(df_mongo) < max_samples:
        try:
            print("1.2 Tải bổ sung mẫu từ HuggingFace...")
            from datasets import load_dataset
            ds = load_dataset("tinixai/vietnam-real-estates", split="train")
            hf_sample_size = min(max_samples - len(df_mongo), 50000)
            df_hf = ds.select(range(min(len(ds), hf_sample_size * 2))).to_pandas()
            df_hf = df_hf[(df_hf['price'] > 0) & (df_hf['area'] > 10) & (df_hf['area'] < 5000)].head(hf_sample_size)
            df = pd.concat([df_mongo, df_hf], ignore_index=True)
            del df_hf
        except Exception as e:
            print(f"  [Warning] Không tải được HuggingFace: {e}, dùng dữ liệu PostgreSQL thuần")
            df = df_mongo
    else:
        df = df_mongo
        
    gc.collect()
    return df

def main():
    print("1. Tải dữ liệu mẫu an toàn...")
    import gc
    df = load_sampled_data(max_samples=120000)
    print(f"Kích thước dữ liệu tổng hợp: {df.shape}")
    
    # Preprocess
    print("2. Tiền xử lý dữ liệu...")
    features = [
        'property_type_name', 'province_name', 'district_name', 'ward_name', 'street_name',
        'area', 'bedroom_count', 'bathroom_count', 'floor_count', 
        'frontage_width', 'house_direction'
    ]
    target = 'price'
    
    # We load the existing encoders to be consistent
    try:
        encoders = joblib.load("encoders.pkl")
    except:
        X, y, encoders = preprocess_data(df)
        joblib.dump(encoders, "encoders.pkl")
        
    X = df[features].copy()
    y = df[target].copy()
    
    num_cols = ['area', 'bedroom_count', 'bathroom_count', 'floor_count', 'frontage_width']
    for col in num_cols:
        X[col] = pd.to_numeric(X[col], errors='coerce').fillna(0)
        
    cat_cols = ['property_type_name', 'province_name', 'district_name', 'ward_name', 'street_name', 'house_direction']
    for col in cat_cols:
        X[col] = X[col].astype(str).str.strip().fillna('Unknown')
        X.loc[X[col] == '', col] = 'Unknown'
        X.loc[X[col] == 'nan', col] = 'Unknown'
        
        # Apply encoders
        # Handle unseen values by mapping them to 'Unknown_inference'
        unseen = ~X[col].isin(encoders[col].classes_)
        if unseen.sum() > 0:
            X.loc[unseen, col] = 'Unknown_inference'
        X[col] = encoders[col].transform(X[col])
        
    # Include price and price_per_m2 as features for anomaly detection
    # Anomaly models need to see the price to know if the price is anomalous given the features
    X_anomaly = X.copy()
    X_anomaly['price'] = np.log1p(y)  # log of price to handle huge ranges
    
    # Safe calculation of price per m2
    safe_area = X_anomaly['area'].replace(0, 1)
    X_anomaly['price_per_m2_log'] = np.log1p(y / safe_area)
    
    print("3. Bắt đầu huấn luyện Isolation Forest...")
    start_time = time.time()
    # contamination = 'auto' lets it decide the proportion of outliers
    # We set contamination to 0.03 (assuming 3% of data is anomalous/fake)
    model = IsolationForest(n_estimators=100, contamination=0.03, random_state=42, n_jobs=2)
    model.fit(X_anomaly)
    
    print(f"Huấn luyện xong trong {time.time() - start_time:.1f}s")
    
    print("4. Đang lưu mô hình Anomaly...")
    joblib.dump(model, "anomaly_model.pkl")
    print("Hoàn thành quá trình xây dựng siêu mô hình Phát hiện Tin Ảo!")

if __name__ == "__main__":
    main()
