import requests
import json

BASE_URL = "http://127.0.0.1:8001"

def test_anomaly_normal():
    print("\n--- 1. TEST PHÁT HIỆN TIN ẢO (DỮ LIỆU BÌNH THƯỜNG) ---")
    payload = {
        "property_type_name": "Nhà",
        "province_name": "Hà Nội",
        "district_name": "Quận Cầu Giấy",
        "ward_name": "Phường Dịch Vọng",
        "area": 50.0,
        "bedroom_count": 4.0,
        "bathroom_count": 3.0,
        "floor_count": 4.0,
        "listed_price": 10_000_000_000.0  # 10 tỷ
    }
    res = requests.post(f"{BASE_URL}/detect_anomaly", json=payload, timeout=5)
    print("Payload:", payload)
    print("Kết quả:", json.dumps(res.json(), ensure_ascii=False, indent=2))

def test_anomaly_fake():
    print("\n--- 2. TEST PHÁT HIỆN TIN ẢO (GIÁ SIÊU RẺ / LÙA GÀ) ---")
    payload = {
        "property_type_name": "Nhà",
        "province_name": "Hà Nội",
        "district_name": "Quận Cầu Giấy",
        "ward_name": "Phường Dịch Vọng",
        "area": 150.0,  # 150 m2
        "bedroom_count": 5.0,
        "floor_count": 5.0,
        "listed_price": 1_000_000_000.0  # 1 tỷ (quá vô lý)
    }
    res = requests.post(f"{BASE_URL}/detect_anomaly", json=payload, timeout=5)
    print("Payload:", payload)
    print("Kết quả:", json.dumps(res.json(), ensure_ascii=False, indent=2))

def test_recommendation():
    print("\n--- 3. TEST GỢI Ý BẤT ĐỘNG SẢN TƯƠNG ĐỒNG (KNN VECTOR) ---")
    payload = {
        "property_type_name": "Nhà",
        "province_name": "Hà Nội",
        "district_name": "Quận Cầu Giấy",
        "ward_name": "Phường Dịch Vọng",
        "area": 50.0,
        "price": 10_000_000_000.0
    }
    res = requests.post(f"{BASE_URL}/recommend", json=payload, timeout=5)
    print("Đang tìm nhà giống căn: 50m2, Dịch Vọng, Cầu Giấy, 10 tỷ...")
    print("Kết quả:", json.dumps(res.json(), ensure_ascii=False, indent=2))

if __name__ == "__main__":
    try:
        test_anomaly_normal()
        test_anomaly_fake()
        test_recommendation()
    except Exception as e:
        print(f"Lỗi: {e}")
