# Changelog - NhaDat ML

All notable changes to **NhaDat ML** will be documented in this file.

## [1.1.0] - 2026-05-19
### Added
- **Khả năng nhận diện Vị trí Cấp độ Đường phố**: Thêm trường `street_name` vào mô hình huấn luyện để tăng độ chính xác cực đại khi định giá.
- **Siêu Mô Hình (Super Model)**: Tạo script `train_super.py` tích hợp tự động với MongoDB (`internal.example`) để trích xuất 1 triệu tin đăng đang active (`status >= 1`).
- **Merge Dataset**: Kết hợp 3.2 triệu dữ liệu từ HuggingFace với 1 triệu dữ liệu MongoDB để tạo ra tập huấn luyện Siêu Mô Hình khổng lồ (4.1 triệu rows).
- **Tính năng Săn Món Hời (Deal Scoring)**: Ra mắt endpoint `/analyze_deal` trả về `deal_score` và lời khuyên đầu tư dựa trên độ chênh lệch giá trị thực do AI dự báo và giá đăng bán của người dùng.

## [1.0.0] - 2026-05-19
### Added
- **Khởi tạo dự án** `nhadat-ml` độc lập chuyên phục vụ Machine Learning bằng FastAPI.
- Pipeline `train.py` huấn luyện mô hình dự đoán giá `XGBRegressor` sử dụng dataset public HuggingFace (`tinixai/vietnam-real-estates`).
- Cung cấp Endpoint `/predict` cho phép định giá nhà đất thông qua JSON API theo thời gian thực.
- Triển khai quy trình chạy nền (Production) qua PM2 với shell script `start.sh`.
