# SDD 08: Chuyển toàn bộ dữ liệu MongoDB → PostgreSQL/PostGIS

> Trạng thái: DRAFT (2026-10-23). Mục tiêu: PostgreSQL là SSOT duy nhất; gỡ bỏ hoàn toàn MongoDB (driver, env, server).

## 1. Hiện trạng
- Mongo `charity` @internal.example: ~25 collection, 93 file import `lib/db/*`, ~54 file gọi driver `mongodb` trực tiếp (chủ yếu `scripts/` + vài `app/api`).
- Postgres `nhadat_city` @internal.example (dùng bởi `nhadat-rs`): 10 bảng tham chiếu (`001_init_schema.sql`), nạp qua `scripts/etl/01-07`.
- Tính năng Mongo đặc thù cần thay: `$geoWithin` (→ `ST_Within/ST_Intersects`), aggregate cluster bản đồ (→ `ST_SnapToGrid` + `GROUP BY`), `$text` (→ `tsvector` + `unaccent`/`pg_trgm`), `$regex` (→ `ILIKE`/trigram), `$bucket` (→ `width_bucket`), `$lookup` (→ `JOIN`). Không dùng change stream/GridFS/TTL.

## 2. Nguyên tắc thiết kế
1. **Một DB, một schema migrations**: mọi DDL nằm ở `nhadat-rs/migrations/NNN_*.sql` (đánh số tiếp 003…), chạy bằng `sqlx migrate run`. Next/Python/scripts không tự tạo bảng.
2. **Hybrid typed + jsonb**: cột typed cho trường được lọc/sắp xếp/join; phần còn lại vào `extra jsonb` để không mất dữ liệu.
3. **Giữ ID công khai**: URL dùng `short_id` (unique) → SEO không đổi. Mỗi bảng có `mongo_id text UNIQUE` để ETL upsert idempotent và map các route cũ dùng `ObjectId`.
4. **Geo**: `geom geometry(Point,4326)` + GIST. Polygon dùng `geometry(MultiPolygon,4326)`.
5. **Không secret trong source**: mọi kết nối qua env (`DATABASE_URL`), fail-fast nếu thiếu.
6. **Driver Node**: `postgres` (porsager/postgres.js), SQL thuần + interface TS cho row; pool singleton `lib/db/pg.ts` (max 10, `statement_timeout` 10s).
7. **Python**: `psycopg[binary]` 3, đọc qua `DATABASE_URL`.

## 3. Quyết định theo collection (45 collection Mongo `charity`, đếm 2026-10-23)
Migration: `003` (state_land_prices), `004` (users, real_estates, real_estate_images, ALTER projects), `005` (bảng phụ), `006` (index nặng, chạy SAU khi nạp dữ liệu). Mọi bảng có `mongo_id text UNIQUE` (id Mongo dạng chuỗi/ObjectId hex) + `extra jsonb`.

### MIGRATE (32)
| Mongo (số doc) | Postgres | Ghi chú |
|---|---|---|
| realEstate (985,271) | `real_estates` | short_id UNIQUE (Mongo không unique, ước tính ~8 va chạm -> ETL phải gán lại), status smallint, province/district/ward_slug (+old_*), price/total_price/price_per_m2 numeric(20,2), geom Point GIST, images text[] + `first_image` (generated), contact jsonb, user_id FK NULL, `search_tsv` GIN (unaccent) |
| RealEstateImages (6,498,564) | `real_estate_images` | chỉ metadata; FK real_estate_id NULL cho mồ côi |
| users (60,546) + role-assignment (434) | `users` | email citext UNIQUE, `emails citext[]`, `password_hash` = services.password.bcrypt, roles text[] (gộp từ role-assignment), google_id/facebook_id; KHÔNG copy loginTokens/accessToken/reset tokens |
| projects (4,551) | `projects` (đã có, ALTER) | thêm mongo_id (backfill theo short_id), description, images, juridical..., search_tsv |
| blog (1,061) | `blog_posts` | slug UNIQUE |
| districts (704) | `districts` | chỉ đọc |
| province2025 (34), ward2025 (3,322) | `provinces_2025`, `wards_2025` | ĐÃ nạp bởi scripts/etl/01-02, không làm gì thêm |
| mapLayers (32) / mapLayerTypes (6) | `planning_layers` (ALTER, id = mongo _id) / `map_layer_types` | |
| propertyTypes (20), directions (8), legalDocumentTypes (5), roadTypes (6), dynamicFields (12) | `master_data` (kind, mongo_id) | admin master-data -> allow-list `kind` |
| indexing_queue (441) / indexing_logs (2) | `indexing_queue` / `indexing_logs` | queue: `FOR UPDATE SKIP LOCKED` |
| scraping_logs (4), ai_logs (14,984) | `scraping_logs`, `ai_logs` | |
| analytics_daily (165), analytics_overview (1) | `analytics_daily`, `app_config` (key `global_overview`) | |
| seo_keywords (0) | `seo_keywords` | rỗng nhưng code đọc/ghi |
| api_cache (43,029; 110MB) | `api_cache` | chỉ cache, ETL có thể bỏ qua dữ liệu |
| notifications (502,959) | `notifications` | email PII |
| push_subscriptions (22), chat_sessions (3), helpRequests (5,208), reports (65), campaigns (2), messages (109) | `push_subscriptions`, `chat_sessions`, `help_requests`, `reports`, `campaigns` (flatten `name.*`), `messages` | FK user_id NULL |
| comments (11) | `re_comments` | gộp với reComments (code-only) |
| (code-only, chưa có trong Mongo) ai_config, user_ai_preferences, reComments, emails | `app_config` (`ai_config:router`), `user_ai_preferences`, `re_comments`, `emails` | tạo bảng sẵn |
| (drift) | `state_land_prices` | KHÔNG tồn tại ở prod lẫn 001 (Rust nuốt lỗi bằng unwrap_or_default); DDL dựng từ struct `StateLandPrice` |

### DROP (13) — không migrate; giữ trong `mongodump` lưu trữ (P7)
| Collection (docs) | Lý do |
|---|---|
| __pre_Avatars, __pre_Images, __pre_RealEstateImages, __pre_userMaps (0) | rỗng, tiền tố tạm |
| meteor_oauth_pendingCredentials, meteor_oauth_pendingRequestTokens (0) | rỗng, rác Meteor |
| meteor_accounts_loginServiceConfiguration (2) | chứa OAuth client secret; cấu hình qua env/NextAuth |
| Avatars (39), userMaps (4) | 0 tham chiếu trong code; file còn trên đĩa (`users.avatar_url` dùng URL) |
| expertise (10), menus (16), pages (2), roles (3) | 0 tham chiếu trong code (grep app/lib/scripts/components/nhadat-ml); `pages` = 2 trang điều khoản tĩnh |

Admin "database explorer" / `master-data/[collection]` (tên collection động) → thay bằng **allow-list** (`master_data.kind`, bảng cố định).

## 4. Các giai đoạn
| Pha | Nội dung | Xong khi |
|---|---|---|
| P0 | Gỡ secret hardcode (`nhadat-rs/src/config.rs`, `scripts/etl/*`, `nhadat-ml/*.py`) → env; `.env.example`; **đổi mật khẩu PG/Mongo (người dùng làm)** | `grep` không còn credential |
| P1 | Migration 003+ (bảng mục 3), `sqlx migrate` tích hợp; DB staging | `sqlx migrate run` sạch trên staging |
| P2 | ETL tổng quát `scripts/etl/mongo2pg/`: batch 5k theo `_id`, upsert `ON CONFLICT (mongo_id)`, checkpoint, chế độ `--since` để chạy delta; báo cáo đối soát count + checksum mẫu | count khớp 100%, mẫu 1k bản ghi khớp |
| P3 | `lib/db/pg.ts` + viết lại `lib/db/realEstate.ts`, `project.ts`, `statistics.ts` giữ nguyên chữ ký hàm | các trang SEO render giống Mongo (so HTML/JSON-LD) |
| P4 | Chuyển ~57 file gọi driver trực tiếp theo nhóm: (a) user/auth/NextAuth, (b) admin/*, (c) indexing, (d) chat/AI/notifications, (e) map/nearby/image-api | `grep -r "from 'mongodb'"` = 0 trong app/lib |
| P5 | Writers ngoài Next: scraper (`scripts/scraper`), `tran-nhung-agent`, `indexing-cron-runner`, `nhadat-ml` train_*.py | không còn pymongo/mongodb |
| P6 | Cutover: dừng scraper/cron → ETL delta → đổi env → start → smoke test (`tests/e2e-seo-suite.mjs`) | prod chạy trên PG |
| P7 | Mongo read-only 2–4 tuần làm backup → dump lưu trữ → tắt; gỡ `mongodb` khỏi package.json, MONGODB_URI khỏi env | |

## 5. Rủi ro
- 4.1M+ tin đăng: ETL phải stream, không load toàn bộ vào RAM (giới hạn Node 512MB–1GB).
- Khác biệt sắp xếp/tìm kiếm tiếng Việt: dùng `unaccent` + `pg_trgm`, kiểm tra kết quả search trước cutover.
- Cluster bản đồ: so số lượng điểm theo bbox giữa 2 bản.
- Rollback: trong P6–P7 giữ Mongo nguyên vẹn; rollback = đổi env về Mongo build cũ (tag git trước cutover).
