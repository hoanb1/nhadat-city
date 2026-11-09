# NhaDat.City — Nền tảng công nghệ bất động sản & Bản đồ quy hoạch

Bản đồ quy hoạch và mua bán nhà đất toàn quốc · Next.js 16 (App Router) · MapLibre GL JS · MongoDB · Động cơ lập chỉ mục tức thì (Instant Indexing Engine).

[![Lighthouse SEO](https://img.shields.io/badge/Lighthouse%20SEO-100%2F100-brightgreen)](https://nhadat.city)
[![Lighthouse Accessibility](https://img.shields.io/badge/Accessibility-100%2F100-brightgreen)](https://nhadat.city)
[![Best Practices](https://img.shields.io/badge/Best%20Practices-96%2F100-brightgreen)](https://nhadat.city)
[![PM2 Cluster](https://img.shields.io/badge/PM2-Cluster%20Mode-blue)](https://nhadat.city)

---

## 1. Đặc tả kiến trúc kỹ thuật (SDD Suite)

Hệ thống được thiết kế và vận hành theo tiêu chuẩn **Spec-Driven Development (SDD)**:

| Mã tài liệu | Tên đặc tả kỹ thuật | Nội dung chính |
|---|---|---|
| [`SDD 00`](docs/sdd/00_SYSTEM_OVERVIEW_SDD.md) | **Tổng quan kiến trúc & topology** | Bản đồ phân tầng hệ thống (Next.js 16, HAProxy, Varnish, MongoDB, Redis, AI Agent) |
| [`SDD 01`](docs/sdd/01_DATA_SCHEMA_AND_MODELS_SDD.md) | **Lược đồ dữ liệu SSOT** | Schema MongoDB (`real_estate`, `projects`, `indexing_queue`), Indexes & Validation |
| [`SDD 02`](docs/sdd/02_PROGRAMMATIC_SEO_AND_ROUTING_SDD.md) | **Programmatic SEO & Routing** | Phân cấp URL 63 tỉnh/thành, Dynamic Sitemaps, Schema.org JSON-LD |
| [`SDD 03`](docs/sdd/03_INSTANT_INDEXING_ENGINE_SDD.md) | **Động cơ lập chỉ mục tức thì** | Google Indexing API (OAuth2 JWT), IndexNow Protocol, Quota Gatekeeper |
| [`SDD 04`](docs/sdd/04_GIS_SPATIAL_AND_PLANNING_SDD.md) | **Hạ tầng GIS & Bản đồ quy hoạch** | Hệ tọa độ VN2000 ↔ WGS84, PMTiles Vector Tiles, GeoServer WFS/WMS |
| [`SDD 05`](docs/sdd/05_AI_AGENT_FEDERATION_SDD.md) | **Tác tử tự hành Trần Nhung** | Cognitive Tri-Tier Loop, MCP Server, Memory Graph, Communication Seams |
| [`SDD 06`](docs/sdd/06_INFRASTRUCTURE_AND_DEPLOYMENT_SDD.md) | **Hạ tầng & Triển khai** | HAProxy SSL, Varnish VCL Caching, PM2 Zero-Downtime, Proxmox LXC Containers |
| [`SDD 07`](docs/sdd/07_CODEBASE_AND_CODEMAP_SDD.md) | **Bản đồ mã nguồn & Codemap** | Chi tiết cấu trúc thư mục, ma trận module, luồng thực thi dữ liệu |

---

## 2. Tính năng chính

- **Bản đồ quy hoạch & ranh thửa tương tác**: Tích hợp MapLibre GL JS, hiển thị lớp phân khu xây dựng toàn quốc, ranh thửa đất, tự động chuyển đổi hệ tọa độ VN2000.
- **Hệ thống Programmatic SEO quy mô lớn**: Hơn 10,000 trang phường/xã và 63 tỉnh/thành được render SSR/SSG hoàn chỉnh với Schema.org JSON-LD và sitemap động đa phân vùng.
- **Động cơ lập chỉ mục tức thì**: Tự động thông báo Google Indexing API và IndexNow ngay khi có tin đăng mới hoặc cập nhật trạng thái.
- **Tác tử AI Trần Nhung**: Hệ thống Agent tự hành giám sát telemetry, kiểm tra từ khóa Google Search Console, quản lý cache và hỗ trợ vận hành.
- **Định giá AI & Phân tích thị trường**: Dịch vụ Machine Learning (XGBoost / FastAPI) phân tích tương quan giá, loại bỏ ngoại lai và dự đoán xu hướng.

---

## 3. Hướng dẫn khởi động nhanh (Quick Start)

### Cài đặt môi trường
```bash
# Clone repository
git clone https://github.com/hoanb1/nhadat-next.git
cd nhadat-next

# Cài đặt dependencies
npm install

# Khởi chạy môi trường phát triển
npm run dev
```

Ứng dụng khởi chạy tại [http://localhost:3000](http://localhost:3000).

### Kiểm thử hệ thống
```bash
# Kiểm tra TypeScript compilation
timeout 30s npx tsc --noEmit

# Chạy bộ kiểm thử E2E SEO (59/59 test cases)
timeout 30s node tests/e2e-seo-suite.mjs

# Build ứng dụng sản xuất
timeout 60s npm run build
```

---

## 4. Quản lý triển khai hạ tầng

Toàn bộ cấu hình hạ tầng mạng và cân bằng tải được quản lý tập trung trong thư mục [`infra/`](infra):
- `infra/haproxy/haproxy.cfg`: Cấu hình SSL Termination và định tuyến backend.
- `infra/varnish/default.vcl`: Cấu hình Edge Cache HTML SSR và xử lý PURGE token.
- `infra/scripts/`: Kịch bản triển khai LBS và kiểm tra an toàn.
- `ecosystem.config.js`: Cấu hình PM2 quản lý tiến trình zero-downtime.
