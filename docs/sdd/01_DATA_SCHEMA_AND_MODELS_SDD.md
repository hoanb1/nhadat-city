# SDD 01: Lược Đồ Dữ Liệu & Mô Hình SSOT (Data Schema & Models)

## 1. Giới thiệu & Nguyên tắc SSOT
Tất cả các định nghĩa lược đồ (schema), cấu trúc dữ liệu MongoDB và TypeScript interfaces trong `nhadat-next` tuân thủ nguyên tắc Single Source of Truth (SSOT). Mọi trường dữ liệu được chuẩn hóa kiểu, chỉ mục (indexes) và ràng buộc toàn vẹn.

---

## 2. Các Collection MongoDB chính

### 2.1 Collection `real_estate` (Tin đăng bất động sản)
Quản lý toàn bộ danh sách tin rao mua bán, cho thuê nhà đất trên toàn quốc.

| Tên trường | Kiểu dữ liệu | Bắt buộc | Mô tả & Ràng buộc |
|---|---|---|---|
| `_id` | `ObjectId` | Có | Khóa chính MongoDB |
| `shortId` | `string` | Không | Mã định danh rút gọn duy nhất (Base62 / alphanumeric) cho URL SEO |
| `title` | `string` | Có | Tiêu đề tin đăng (Sentence Case tiếng Việt, không emoji) |
| `description` | `string` | Có | Nội dung mô tả chi tiết bất động sản |
| `price` | `number` | Có | Giá niêm yết (VND) |
| `priceUnit` | `string` | Có | Đơn vị tính (`VND`, `tỷ`, `triệu`, `thỏa thuận`) |
| `area` | `number` | Có | Diện tích đất/sàn (m²) |
| `province` | `string` | Có | Tên chuẩn của tỉnh/thành phố |
| `provinceSlug` | `string` | Có | Slug không dấu chuẩn hóa (`ha-noi`, `ho-chi-minh`) |
| `district` | `string` | Có | Tên quận/huyện |
| `districtSlug` | `string` | Có | Slug quận/huyện |
| `ward` | `string` | Có | Tên phường/xã |
| `wardSlug` | `string` | Có | Slug phường/xã |
| `address` | `string` | Không | Địa chỉ chi tiết |
| `coordinates` | `[number, number] \| { lat, lng }` | Không | Tọa độ WGS84 `[lng, lat]` phục vụ spatial query |
| `propertyType` | `string` | Có | Loại BĐS (`nha-rieng`, `can-ho`, `dat-nen`, `biet-thu`, `mat-pho`) |
| `images` | `string[]` | Có | Mảng URL hình ảnh của bất động sản |
| `contact` | `object` | Có | Thông tin liên hệ (`name`, `phone`, `email`) |
| `status` | `string` | Có | Trạng thái (`active`, `pending`, `expired`, `deleted`) |
| `publishedAt` | `Date` | Có | Thời điểm xuất bản |
| `updatedAt` | `Date` | Có | Thời điểm cập nhật cuối cùng |

**Chỉ mục MongoDB bắt buộc:**
```javascript
db.real_estate.createIndex({ status: 1, provinceSlug: 1, wardSlug: 1, publishedAt: -1 });
db.real_estate.createIndex({ shortId: 1 }, { unique: true, sparse: true });
db.real_estate.createIndex({ coordinates: "2dsphere" });
```

---

### 2.2 Collection `projects` (Dự án bất động sản)
Quản lý các khu đô thị, dự án chung cư, biệt thự, khu công nghiệp.

| Tên trường | Kiểu dữ liệu | Mô tả |
|---|---|---|
| `_id` | `ObjectId` | Khóa chính |
| `shortId` | `string` | Mã định danh rút gọn trực tiếp tránh redirect hop |
| `name` | `string` | Tên dự án |
| `slug` | `string` | Slug chuẩn SEO |
| `developer` | `string` | Chủ đầu tư |
| `location` | `object` | Tỉnh/thành, quận/huyện, tọa độ |
| `scale` | `object` | Quy mô, số tòa, số căn hộ, diện tích tổng thể |
| `priceRange` | `object` | Mức giá tham chiếu theo m² |
| `status` | `string` | Tiến độ (`sap-mo-ban`, `dang-xay-dung`, `da-ban-giao`) |

---

### 2.3 Collection `indexing_queue` & `indexing_logs`
Hàng đợi điều phối việc gửi URL lên Google Indexing API và IndexNow protocol.

```typescript
// Interface hàng đợi Indexing
export interface IndexingQueueItem {
  _id?: ObjectId;
  url: string;                      // URL canonical tuyệt đối
  type: 'URL_UPDATED' | 'URL_DELETED'; // Loại sự kiện
  priority: number;                 // Độ ưu tiên (1-10)
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  retryCount: number;               // Số lần đã thử lại
  nextRetryAt?: Date;               // Thời điểm thử lại tiếp theo
  googleSubmittedAt?: Date;
  indexNowSubmittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Interface Nhật ký Indexing Telemetry
export interface IndexingLogItem {
  _id?: ObjectId;
  queueId: ObjectId;
  url: string;
  engine: 'GOOGLE' | 'INDEXNOW';
  status: 'SUCCESS' | 'ERROR';
  httpStatus?: number;
  responsePayload?: any;
  errorMessage?: string;
  timestamp: Date;
}
```

---

### 2.4 Collection `planning_zones` (Lớp quy hoạch không gian)
Chứa dữ liệu vùng quy hoạch sử dụng đất, phân khu xây dựng.

| Tên trường | Kiểu dữ liệu | Mô tả |
|---|---|---|
| `ma_loai_dat` | `string` | Mã loại đất theo quy chuẩn QCVN (`ONT`, `ODT`, `TMD`, `SKC`, `DGT`) |
| `ten_loai_dat` | `string` | Tên diễn giải loại đất |
| `dien_tich` | `number` | Diện tích vùng (m²) |
| `geometry` | `GeoJSON` | Đa giác hình học (Polygon / MultiPolygon) |
| `province_code` | `string` | Mã hành chính tỉnh/thành |
| `district_code` | `string` | Mã hành chính quận/huyện |
| `nam_quy_hoach` | `number` | Năm kỳ quy hoạch (ví dụ: 2030, 2050) |

---

## 3. Ràng buộc toàn vẹn & Validation

1. **Chuẩn hóa URL**:
   - URL tin đăng luôn theo cấu trúc: `https://nhadat.city/[provinceSlug]/[wardSlug]/[id]/[slug]`
   - URL dự án luôn theo cấu trúc: `https://nhadat.city/du-an/[shortId]/[slug]`
2. **Không phân mảnh SEO**: Khi xóa hoặc ẩn tin, tự động enqueue `URL_DELETED` vào `indexing_queue` để bot thu hồi lập chỉ mục.
3. **Bảo vệ ranh giới Null/Undefined**: Các trường giá trị số (`price`, `area`) luôn fallback về 0 hoặc chuỗi mặc định, không để lỗi crash giao diện.
