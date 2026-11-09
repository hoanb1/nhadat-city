from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import xgboost as xgb
import joblib
import pandas as pd
import numpy as np

app = FastAPI(title="NhaDat-ML API", description="Hệ sinh thái AI Đa Nhiệm Bất Động Sản", version="2.0")

# Global variables for models and encoders
model = None
encoders = None
anomaly_model = None
knn_model = None
knn_scaler = None
knn_ids = None

class PropertyInput(BaseModel):
    property_type_name: str
    province_name: str
    district_name: str
    ward_name: str
    street_name: Optional[str] = "Unknown"
    area: float
    bedroom_count: Optional[float] = 0.0
    bathroom_count: Optional[float] = 0.0
    floor_count: Optional[float] = 0.0
    frontage_width: Optional[float] = 0.0
    house_direction: Optional[str] = "Unknown"

class PredictionOutput(BaseModel):
    estimated_price: float
    formatted_price: str

class DealInput(PropertyInput):
    listed_price: float

class DealOutput(BaseModel):
    expected_price: float
    formatted_expected_price: str
    deal_score: float
    evaluation: str
    message: str

class AnomalyOutput(BaseModel):
    is_anomaly: bool
    anomaly_score: float
    message: str

class RecommendInput(BaseModel):
    property_type_name: str
    province_name: str
    district_name: str
    ward_name: str
    area: float
    price: float

class RecommendOutput(BaseModel):
    similar_ids: List[str]
    message: str

@app.on_event("startup")
def load_assets():
    global model, encoders, anomaly_model, knn_model, knn_scaler, knn_ids
    try:
        print("Đang load siêu mô hình và các tiện ích mở rộng...")
        model = xgb.XGBRegressor()
        model.load_model("model.xgb")
        encoders = joblib.load("encoders.pkl")
        
        try:
            anomaly_model = joblib.load("anomaly_model.pkl")
            print("Load Anomaly Model thành công!")
        except Exception as e:
            print(f"Warning: Anomaly model chưa có ({e})")
            
        try:
            knn_model = joblib.load("knn_model.pkl")
            knn_scaler = joblib.load("knn_scaler.pkl")
            knn_ids = pd.read_pickle("knn_ids.pkl")
            print("Load KNN Recommender thành công!")
        except Exception as e:
            print(f"Warning: KNN model chưa có ({e})")
            
        print("Tất cả models load thành công!")
    except Exception as e:
        print(f"Lỗi khi load model: {e}")

def format_price(price: float) -> str:
    if price >= 1_000_000_000:
        return f"{price / 1_000_000_000:.2f} tỷ"
    elif price >= 1_000_000:
        return f"{price / 1_000_000:.0f} triệu"
    return f"{price:,.0f} đồng"

@app.post("/predict", response_model=PredictionOutput)
def predict_price(data: PropertyInput):
    if model is None or encoders is None:
        raise HTTPException(status_code=503, detail="Mô hình chưa được khởi tạo")
        
    try:
        input_dict = data.dict()
        df = pd.DataFrame([input_dict])
        
        cat_cols = ['property_type_name', 'province_name', 'district_name', 'ward_name', 'street_name', 'house_direction']
        for col in cat_cols:
            val = df[col].iloc[0]
            if val in encoders[col].classes_:
                df[col] = encoders[col].transform([val])
            else:
                df[col] = encoders[col].transform(['Unknown_inference'])
                
        pred_log = model.predict(df)[0]
        pred_real = float(np.expm1(pred_log))
        
        return PredictionOutput(
            estimated_price=pred_real,
            formatted_price=format_price(pred_real)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze_deal", response_model=DealOutput)
def analyze_deal(data: DealInput):
    if model is None or encoders is None:
        raise HTTPException(status_code=503, detail="Mô hình chưa được khởi tạo")
        
    try:
        input_dict = data.dict(exclude={'listed_price'})
        df = pd.DataFrame([input_dict])
        
        cat_cols = ['property_type_name', 'province_name', 'district_name', 'ward_name', 'street_name', 'house_direction']
        for col in cat_cols:
            val = df[col].iloc[0]
            if val in encoders[col].classes_:
                df[col] = encoders[col].transform([val])
            else:
                df[col] = encoders[col].transform(['Unknown_inference'])
                
        pred_log = model.predict(df)[0]
        expected_price = float(np.expm1(pred_log))
        listed_price = data.listed_price
        
        ratio = listed_price / expected_price
        
        if ratio <= 0.5:
            score = 99.0
        elif ratio >= 1.5:
            score = 1.0
        else:
            score = 100 - (ratio - 0.5) * 100
            score = max(1.0, min(99.0, score))
            
        if score >= 80:
            eval_label = "Món hời cực tốt (Rất rẻ)"
            msg = f"Giá rao bán rẻ hơn khoảng {((1 - ratio) * 100):.0f}% so với giá trị thực ước tính. Rất đáng để đầu tư!"
        elif score >= 60:
            eval_label = "Giá tốt (Rẻ hơn thị trường)"
            msg = f"Giá rao bán thấp hơn một chút so với thị trường (khoảng {((1 - ratio) * 100):.0f}%). Có thể cân nhắc mua."
        elif score >= 40:
            eval_label = "Giá thị trường (Hợp lý)"
            msg = "Mức giá rao bán khá sát với định giá thực tế của thị trường."
        else:
            eval_label = "Giá cao (Đắt hơn thị trường)"
            msg = f"Giá rao bán cao hơn khoảng {((ratio - 1) * 100):.0f}% so với mặt bằng chung. Bạn nên thương lượng mạnh tay hơn."
            
        return DealOutput(
            expected_price=expected_price,
            formatted_expected_price=format_price(expected_price),
            deal_score=round(score, 1),
            evaluation=eval_label,
            message=msg
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect_anomaly", response_model=AnomalyOutput)
def detect_anomaly(data: DealInput):
    if anomaly_model is None or encoders is None:
        raise HTTPException(status_code=503, detail="Mô hình Anomaly chưa được khởi tạo")
        
    try:
        input_dict = data.dict(exclude={'listed_price'})
        df = pd.DataFrame([input_dict])
        
        cat_cols = ['property_type_name', 'province_name', 'district_name', 'ward_name', 'street_name', 'house_direction']
        for col in cat_cols:
            val = df[col].iloc[0]
            if val in encoders[col].classes_:
                df[col] = encoders[col].transform([val])
            else:
                df[col] = encoders[col].transform(['Unknown_inference'])
                
        # Calculate features required for anomaly model
        df['price'] = np.log1p(data.listed_price)
        safe_area = data.area if data.area > 0 else 1
        df['price_per_m2_log'] = np.log1p(data.listed_price / safe_area)
        
        # Predict anomaly: -1 means outlier/anomaly, 1 means normal
        pred = anomaly_model.predict(df)[0]
        # score_samples returns negative anomaly score. Lower values are more abnormal.
        score = float(anomaly_model.score_samples(df)[0])
        
        is_anomaly = bool(pred == -1)
        
        if is_anomaly:
            msg = "CẢNH BÁO: Bất động sản này có dấu hiệu bất thường (giá quá rẻ hoặc thông số mâu thuẫn). Khả năng cao là tin ảo."
        else:
            msg = "Thông số và mức giá của bất động sản này nằm trong ngưỡng bình thường."
            
        return AnomalyOutput(
            is_anomaly=is_anomaly,
            anomaly_score=score,
            message=msg
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/recommend", response_model=RecommendOutput)
def recommend_similar(data: RecommendInput):
    if knn_model is None or knn_scaler is None or knn_ids is None or encoders is None:
        raise HTTPException(status_code=503, detail="Mô hình Gợi ý chưa được khởi tạo")
        
    try:
        input_dict = data.dict()
        df = pd.DataFrame([input_dict])
        
        features = ['property_type_name', 'province_name', 'district_name', 'ward_name']
        for col in features:
            val = df[col].iloc[0]
            if val in encoders[col].classes_:
                df[col] = encoders[col].transform([val])
            else:
                df[col] = encoders[col].transform(['Unknown_inference'])
                
        df['area'] = np.log1p(data.area)
        df['price'] = np.log1p(data.price)
        safe_area = data.area if data.area > 0 else 1
        df['price_per_m2'] = np.log1p(data.price / safe_area)
        
        X_scaled = knn_scaler.transform(df)
        
        # Find nearest 6 (in case the 1st one is the exact same listing if it was in the DB)
        distances, indices = knn_model.kneighbors(X_scaled, n_neighbors=6)
        
        similar_db_ids = []
        for idx in indices[0]:
            try:
                db_id = knn_ids.iloc[idx]['id']
                similar_db_ids.append(db_id)
            except:
                pass
                
        return RecommendOutput(
            similar_ids=similar_db_ids,
            message=f"Đã tìm thấy {len(similar_db_ids)} bất động sản có đặc điểm tương đồng nhất."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health_check():
    return {
        "status": "ok", 
        "price_model": model is not None,
        "anomaly_model": anomaly_model is not None,
        "knn_model": knn_model is not None
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
