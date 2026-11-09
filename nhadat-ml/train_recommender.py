import os
import pandas as pd
import numpy as np
import joblib
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler
from pg_source import load_listings
import time

def main():
    print("1. Tải danh sách BĐS đang active từ PostgreSQL...")
    cursor = load_listings(
        {'status': {'$gte': 1}, 'totalPrice': {'$gt': 0}, 'area': {'$gt': 0}, 'shortId': {'$exists': True}},
        # Only fetch what we need to build the vector space
        columns=['_id', 'shortId', 'propertyType', 'location', 'adminunit', 'totalPrice', 'price', 'area', 'dynamicFields'],
        order_by=('createdAt', -1), limit=50000,  # Only latest 50k active properties
    )

    records = []
    prop_type_map = {
        'nha_o': 'Nhà', 'chung_cu': 'Căn hộ chung cư', 'dat_nen': 'Đất', 'biet_thu': 'Biệt thự/Nhà liền kề', 'shophouse': 'Shophouse'
    }
    
    start_time = time.time()
    for doc in cursor:
        try:
            price = doc.get('totalPrice') or doc.get('price')
            area = doc.get('area')
            
            loc = doc.get('location') or {}
            province_name = loc.get('province') or (doc.get('adminunit') or {}).get('province') or ''
            district_name = (loc.get('district') or '')
            ward_name = (loc.get('ward') or '')
            
            records.append({
                'id': str(doc.get('shortId')),
                'property_type_name': prop_type_map.get(doc.get('propertyType'), 'Nhà'),
                'province_name': str(province_name).replace('Thành phố ', '').replace('Tỉnh ', ''),
                'district_name': str(district_name).replace('Quận ', '').replace('Huyện ', ''),
                'ward_name': str(ward_name).replace('Phường ', '').replace('Xã ', ''),
                'area': float(area),
                'price': float(price),
                # We can skip exact street for embeddings to keep it robust
                'price_per_m2': float(price) / float(area) if area > 0 else 0
            })
        except Exception:
            continue
            
    df = pd.DataFrame(records)
    print(f"  -> Lấy được {len(df)} BĐS trong {time.time()-start_time:.1f}s.")
    
    if len(df) == 0:
        print("Không có dữ liệu, hủy!")
        return

    print("2. Mã hóa dữ liệu...")
    encoders = joblib.load("encoders.pkl")
    
    features = ['property_type_name', 'province_name', 'district_name', 'ward_name']
    X = df[features].copy()
    
    for col in features:
        X[col] = X[col].astype(str).str.strip().fillna('Unknown')
        unseen = ~X[col].isin(encoders[col].classes_)
        if unseen.sum() > 0:
            X.loc[unseen, col] = 'Unknown_inference'
        X[col] = encoders[col].transform(X[col])
    
    # Add numerical features
    X['area'] = np.log1p(df['area'])
    X['price'] = np.log1p(df['price'])
    X['price_per_m2'] = np.log1p(df['price_per_m2'])
    
    # Standardize
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    print("3. Huấn luyện KNN Recommender...")
    knn = NearestNeighbors(n_neighbors=10, metric='euclidean', n_jobs=-1)
    knn.fit(X_scaled)
    
    print("4. Lưu mô hình KNN...")
    joblib.dump(knn, "knn_model.pkl")
    joblib.dump(scaler, "knn_scaler.pkl")
    # Save the id mapping so we can retrieve the DB ID from the KNN index
    df[['id']].to_pickle("knn_ids.pkl")
    print("Hoàn thành xây dựng hệ thống Gợi ý BĐS!")

if __name__ == "__main__":
    main()
