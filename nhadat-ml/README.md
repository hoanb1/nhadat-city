# NhaDat ML - Hệ Thống Định Giá & AI Bất Động Sản Siêu Việt

Dự án Machine Learning chuyên biệt dành cho hệ sinh thái **NhaDat.City**, cung cấp khả năng dự đoán giá trị bất động sản chính xác cao và phân tích cơ hội đầu tư (Deal Scoring) theo thời gian thực.

## Tổng quan
Mô hình XGBoost (Super Model) được huấn luyện trên **~4.1 triệu bản ghi**, kết hợp sức mạnh từ:
1. **HuggingFace (`tinixai/vietnam-real-estates`)**: 3.2 triệu dữ liệu lịch sử phong phú, đa dạng.
2. **MongoDB Nội Bộ (`charity.realEstate`)**: Gần 1 triệu tin rao bán bất động sản đang active, cập nhật sát sao tình hình thị trường Việt Nam hiện tại.

Sự kết hợp này mang lại cho AI tầm nhìn lịch sử sâu rộng lẫn khả năng "chạm" được vào nhịp đập thực tế của thị trường, tránh hiện tượng "ảo giá" so với việc chỉ dùng dữ liệu public cũ.

## Tính năng
- **`/predict`**: Dự đoán giá trị bất động sản dựa trên đặc điểm (Loại hình, Tỉnh/Thành phố, Quận/Huyện, Phường/Xã, Tên đường, Diện tích, Phòng ngủ, Phòng tắm, Mặt tiền, v.v.).
- **`/analyze_deal` (Săn Món Hời)**: Đánh giá cơ hội đầu tư bằng cách so sánh **Giá rao bán** với **Giá trị thực do AI dự đoán**. Trả về `deal_score` (Thang điểm 1-100) kèm lời khuyên chuyên môn để gợi ý người dùng nên Mua, Đàm phán thêm, hay Bỏ qua.

## Cài đặt & Chạy dịch vụ
Dự án sử dụng Python 3.14+ (Virtual Environment) và được quản lý tiến trình bởi PM2.

```bash
# 1. Kích hoạt môi trường ảo
source venv/bin/activate

# 2. Cài đặt thư viện
pip install -r requirements.txt

# 3. Chạy API (Dev mode - port 8001)
fastapi dev api.py --port 8001

# 4. Chạy Production (PM2)
pm2 start start.sh --name "nhadat-ml"
pm2 save
```

## Huấn Luyện Mô Hình (Training)
```bash
# 1. Huấn luyện Siêu mô hình (Super Model) trên toàn bộ 4.1M dữ liệu (Khuyên dùng)
python train_super.py

# 2. Huấn luyện mô hình cơ bản (Chỉ dùng dữ liệu HuggingFace)
python train.py --sample 300000
```
