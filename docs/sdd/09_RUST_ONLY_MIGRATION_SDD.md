# 09 — Chuyển toàn bộ sang Rust, bỏ Node.js (SDD)

Trạng thái: bắt đầu 2026-10-23, sau cutover Postgres (SDD 08, P6). Mục tiêu: **không còn process Node.js nào trên server prod**. Node chỉ được phép làm công cụ build trên máy dev nếu thật sự không có thay thế (mục 6).

**Quyết định 2026-10-23 (chủ dự án):** viết lại từ đầu, không port nguyên. Chỉ giữ **dữ liệu Postgres** và **URL đã index**; mọi code Next/Astro/scripts là tài liệu tham khảo, không phải ràng buộc. Ưu tiên tuyệt đối: tốc độ trang + SEO. Bỏ nhadat-astro (Astro SSR cần Node). Không route tạm về Next — R1 lên càng sớm càng tốt. Frontend **modern-only, mobile-first, không fallback** (mục 2a). Phạm vi cắt theo mục 4.

## 1. Hiện trạng (kiểm kê 2026-10-23)
| Khối | Node hiện tại | LOC | Rust v2 có sẵn |
|---|---|---|---|
| Trang SEO public (tin đăng, tỉnh/phường, dự án, blog, quy hoạch, thống kê, từ khóa, user) | Next app/ | 7.6k | Không (Rust chỉ có JSON API) |
| API public + user + admin | app/api | 5.8k | 27 route: tỉnh/phường, dự án, pháp lý, công cụ, quy hoạch, tiles, parcel |
| lib (db, ai, map, indexing, geo) | lib/ | 7.0k | db.rs, geo.rs, quant.rs |
| Client islands (MapLibre, form đăng tin, chat, chart) | components/ | 10.2k | 7 island vanilla JS trong nhadat-astro |
| Admin SPA (React/Vite) + Express :4000 | admin-ui/ | 4.0k | — |
| Scraper + cron | scripts/scraper | 1.9k | — |
| Indexing (Google Indexing, IndexNow) | scripts + lib/indexing | 0.9k | — |
| SEO monitor (GSC, Gemini, Telegram) | scripts/seo-monitor | 1.7k | — |
| Agent Trần Nhung (daemon + web :3100 + MCP) | scripts/tran-nhung-agent | 7.5k | — |
| Frontend v2 (Astro SSR, Node) | nhadat-astro | 10.5k | chưa chạy prod |

nhadat-ml (Python FastAPI) **giữ nguyên** — không phải Node.

## 2. Kiến trúc đích
```
HAProxy -> Varnish -> nhadat-web (Rust, Axum, :3005)  -- HTML SSR + JSON API + /image-api + /map-api + static
                       nhadat-worker (Rust, cùng crate, binary thứ 2) -- cron: scraper, indexing, seo-monitor, analytics rollup
                       nhadat-ml (Python, :8001) không đổi
Postgres internal.example/nhadat_city, Redis (tùy chọn), GeoServer, Nominatim
```
- **Một Cargo workspace** `nhadat-rs/`: crate `core` (db, models, geo, quant, auth), bin `nhadat-web`, bin `nhadat-worker`.
- **HTML**: `askama` (template biên dịch, lỗi bắt lúc compile). Giao diện **thiết kế lại mobile-first** theo mục 2a; markup Next chỉ là tham khảo. Thứ phải giữ cho SEO là nội dung + URL + title/canonical/JSON-LD, không phải markup cũ.
- **CSS**: Tailwind **standalone CLI** (binary, không cần Node) quét `templates/**/*.html` + `static/js/**/*.js` → `static/css/app.css`.
- **JS client**: ES module gốc + import map, không bundler bắt buộc (esbuild binary chỉ để minify nếu cần). MapLibre GL (bản ESM) và chart (uPlot) vendor vào `static/vendor/` — không npm, không UMD. Island = custom element, xem mục 2a.
- **Auth**: hoãn cùng R4. Khi làm: chỉ Google One Tap (verify ID token) + cookie session ký HMAC; không port đăng nhập mật khẩu Meteor.
- **Admin**: vài trang askama nội bộ (R5), basic auth/IP allowlist. Bỏ admin-ui React, Express :4000 và hợp đồng `/api/admin/*`.
- **Background**: `tokio-cron-scheduler` trong nhadat-worker. Scraper API (Meeyland/Meeyproject) bằng reqwest; site HTML (tinbds, alonhadat) bằng `reqwest + scraper` — nếu bắt buộc JS render thì dùng `chromiumoxide` (Chrome headless, không Node).
- **AI chat** `/api/chat`: **bỏ** (không mang lại SEO, tốn chi phí API).
- **Cache**: Varnish cache HTML như hiện tại; Rust đặt `Cache-Control` tương đương `revalidate` của Next; cache trong process bằng `moka` (thay Map/Redis cho stats); Redis chỉ giữ nếu còn chỗ cần.

## 2a. Frontend: modern-only, mobile-first, không fallback
**Trình duyệt mục tiêu:** Chrome/Edge/Samsung Internet 2 bản gần nhất, Safari/iOS Safari ≥ 18, Firefox 2 bản gần nhất. Không polyfill, không transpile xuống dưới ES2022, không bản no-JS/legacy song song.

**Ngoại lệ duy nhất — không phải fallback trình duyệt mà là kiến trúc SEO:** toàn bộ nội dung chính (tiêu đề, giá, mô tả, breadcrumb, danh sách tin, bảng giá, link nội bộ, JSON-LD) nằm sẵn trong HTML do server render. JS chỉ thêm tương tác, không bao giờ là nơi sinh nội dung cần index.

**Mobile-first:**
- CSS viết cho màn 360px trước, breakpoint chỉ dùng `min-width` (Tailwind v4 mặc định). Desktop là bản mở rộng.
- Mobile-first indexing: nội dung mobile = desktop, không ẩn khối nội dung trên mobile (chỉ đổi bố cục).
- Vùng chạm ≥ 48px, thanh điều hướng dưới cho trang tin/bản đồ, `dvh`/`svh` cho chiều cao, `env(safe-area-inset-*)`.
- Bản đồ: ảnh tĩnh/placeholder trước, MapLibre chỉ tải khi người dùng chạm vào (không chặn LCP).

**Nền tảng web dùng thẳng (không fallback):**
- MPA thuần + **View Transitions cross-document** (`@view-transition { navigation: auto; }`) cho cảm giác SPA.
- **Speculation Rules** (`<script type="speculationrules">`): prerender link nội bộ khi hover/chạm (eagerness `moderate`), prefetch trang kế trong phân trang.
- CSS: Tailwind v4 (cascade layers, `@property`, `oklch`, `color-mix`), container queries, `:has()`, native nesting, `content-visibility: auto` cho danh sách dài, `<dialog>` + Popover API thay modal JS, `scrollbar-gutter`, `text-wrap: balance/pretty`.
- JS: ES module gốc + import map, không framework. Island = custom element (`<map-island>`, `<loan-calc>`), tự đăng ký khi vào viewport (`IntersectionObserver`) hoặc khi tương tác.
- Ảnh: chỉ **AVIF**, `srcset` + `sizes`, `width`/`height` cố định (CLS = 0), ảnh LCP `fetchpriority="high"` + không lazy, còn lại `loading="lazy" decoding="async"`. Image-api Rust resize sẵn các bậc 360/640/960/1280.
- Font: system font stack (`system-ui`) — không tải web font. Nếu cần thương hiệu: 1 file WOFF2 variable, subset tiếng Việt, preload.
- HTTP: HTTP/3 + Early Hints 103 (Cloudflare), Brotli, asset có hash trong tên + `Cache-Control: immutable`, HTML `stale-while-revalidate` qua Varnish.

**Ngân sách hiệu năng (đo trên Moto G Power / 4G chậm, bắt buộc trong CI parity):**
| Chỉ số | Ngưỡng |
|---|---|
| LCP (p75 thực tế, CrUX) | < 1.8 s |
| INP | < 150 ms |
| CLS | < 0.05 |
| HTML trang tin (brotli) | < 40 KB |
| CSS toàn site (brotli) | < 20 KB |
| JS trên trang nội dung | 0 KB (trừ speculation rules inline) |
| JS trang bản đồ | < 60 KB + MapLibre tải lười |
| TTFB qua Varnish HIT | < 100 ms |

## 3. Nguyên tắc chuyển đổi (strangler fig)
1. Rust và Next chạy song song. **Varnish định tuyến theo path**: route nào Rust đã port và đạt kiểm thử parity thì chuyển backend sang :3005; còn lại vẫn :3000.
2. Mỗi route chỉ chuyển khi đạt **parity**: status code, `<title>`, meta description, canonical, JSON-LD (so khớp sau chuẩn hóa), số tin trong danh sách, redirect. Script `tests/parity/compare.rs` (hoặc shell + `jq`) chạy trên mẫu URL lấy từ sitemap.
3. Không đổi URL, không đổi schema DB (chỉ thêm migration nếu cần, đánh số tiếp 008+, hiện áp tay bằng psql theo `migrations/README.md`. Muốn dùng `sqlx::migrate!` phải baseline trước: ghi sẵn 001–007 vào `_sqlx_migrations` với checksum đúng, nếu không nó sẽ chạy lại 001 trên prod).
4. Rollback mỗi bước = đổi backend Varnish về :3000.

## 4. Các pha
| Pha | Nội dung | Xong khi |
|---|---|---|
| R0 Nền tảng | Workspace + askama + Tailwind standalone + static/vendor; layout (header/footer/menu như Next); kiểu lỗi chung + trang 404/500; config env; bỏ log DATABASE_URL; systemd unit `nhadat-web` trên 241 (:3005, MemoryMax); rule Varnish theo path (chưa route gì) | `/healthz` + trang thử render qua Varnish trên prod |
| R1 Tin đăng (lõi SEO) | `/`, `/[province]`, `/[province]/[ward]` (+ propertyType), `/[province]/[ward]/[id]/[slug]`, `/realestate/[id]`, `/mua-ban`, `/cho-thue`; redirect của `proxy.ts` + `next.config.js`; `/image-api` (resize, cache đĩa); sitemap index/listings/static, robots, indexnow-key | parity ≥ 99% trên 2k URL mẫu; chuyển Varnish |
| R2 Trang public còn lại | `/du-an*`, `/blog*`, `/quy-hoach*`, `/thong-ke*`, `/tu-khoa/*`, `/phap-ly/*`, `/user/[id]`, about/contact/privacy/terms; sitemap projects/blog/quyhoach/admin-unit; thêm các trang v2 (gia-dat, sap-nhap-hanh-chinh, cong-cu, ma-loai-dat) | parity + chuyển Varnish |
| R3 Bản đồ | `/map-api/*` (token HMAC, origin, rate limit, tiles), `/api/real-estate/map-clusters`, `/api/projects/map-clusters`, `/api/map-layers`, `/api/parcel-*`, `/api/nearby`; MapLibre client vanilla (thay MainMapClient/ProjectMapClient) | bản đồ chạy trên prod qua Rust |
| R4 Người dùng | **HOÃN** (quyết định 2026-10-23): không mang lại SEO. Khi cần: chỉ Google One Tap + đăng tin tối giản. Bỏ comments, push, chat sessions. Analytics = log Varnish/Cloudflare, không endpoint ghi ẩn danh | — |
| R5 Admin | **VIẾT LẠI TỐI GIẢN**: vài trang HTML askama nội bộ (duyệt/ẩn tin, xem queue indexing), sau basic auth/IP allowlist. Bỏ admin-ui React + hợp đồng `/api/admin/*` | thao tác quản trị tối thiểu chạy trên Rust |
| R6 Jobs + AI | nhadat-worker: scraper 4 nguồn, indexing queue (Google + IndexNow), submit indexing, seo-monitor (GSC, Gemini, Telegram), retrain trigger; `/api/chat` + tool calling; `/api/ml/*` proxy | tắt `nhadat-cron`, crontab Node |
| R7 Agent Trần Nhung | **BỎ** (quyết định 2026-10-23). Chỉ giữ instant indexing + báo cáo Telegram, gộp vào R6. Không port contentFactory (blog AI = nội dung mỏng, rủi ro SEO) | tắt `tran-nhung-*` |
| R8 Gỡ Node | Varnish 100% về Rust; xóa app/, components/, lib/, admin-ui server.js, nhadat-astro, scripts Node, package.json; gỡ PM2 apps Node; gỡ nodejs khỏi 241 | `pgrep node` rỗng trên prod |

Thứ tự ưu tiên theo traffic SEO: R0 → R1 → R2 → R3 → R6 → R5 → R8. R4 hoãn, R7 bỏ. R6 có thể làm song song với R2/R3 (không chung file). Trong R2 thứ tự: `/gia-dat` → `/quy-hoach` → `/sap-nhap-hanh-chinh` → `/du-an` → `/cong-cu` → còn lại; route GSC 90 ngày không có impression thì không port (301 về hub gần nhất hoặc 410).

**Quy tắc SEO bắt buộc mọi pha:**
- URL đã index giữ nguyên; phải đổi thì **301 đúng một bước** về trang tương đương. Cấm 301 tin/trang chi tiết về trang danh mục (Google coi là soft 404) — lỗi hiện tại của nhadat-astro.
- Tin hết hạn/đã bán: **200** + nhãn "đã bán" + tin tương tự cùng phường + giá khu vực; tin rác/trùng: **410**. Không 301.
- Tin cào = nội dung trùng nguồn → mỗi trang tin phải có khối giá trị riêng: giá/m² so với trung vị phường, lớp quy hoạch tại vị trí, định giá ML, thông tin sáp nhập. Tin không đủ dữ liệu cho khối này: `noindex,follow`.
- Mỗi trang: title/description duy nhất, canonical tuyệt đối, JSON-LD (`RealEstateListing`/`Offer`, `BreadcrumbList`, `Place`; `FAQPage` cho giá đất), liên kết hub tỉnh → phường → tin và chéo giá đất ↔ quy hoạch ↔ tin cùng phường.
- Sitemap tách theo loại, `lastmod` thật; sau mỗi lần chuyển Varnish đẩy URL qua IndexNow + Google Indexing.

## 5. Rủi ro
- **Parity SEO**: lệch title/canonical/JSON-LD làm tụt index → bắt buộc kiểm parity trước khi chuyển từng route; giữ nguyên URL.
- **Bản đồ client** là phần JS nặng nhất (≈3k LOC React) → viết lại vanilla, kiểm thủ công trên mobile.
- **Phiên đăng nhập**: mọi user phải đăng nhập lại sau R4.
- **Scraper dùng Puppeteer**: có thể cần Chrome headless (chromiumoxide).
- **Bảo mật mang theo** (sửa khi port, không sao chép): credential hardcode trong `scripts/tran-nhung-agent/config.js` và IndexNow key; endpoint ghi ẩn danh (comments, chat, analytics, ml) cần rate limit; `images.remotePatterns: '**'` (SSRF) — image-api Rust chỉ đọc ảnh nội bộ; MAP_TOKEN_SECRET phải bắt buộc (không random); cron retrain trùng 05:00/06:00.

## 6. Build & deploy
- Build release trên máy dev hoặc LXC build (`cargo build --release`, `tailwindcss` standalone, `esbuild` binary); rsync binary + `static/` + `templates` không cần (askama nhúng vào binary).
- systemd: `nhadat-web.service`, `nhadat-worker.service` (Restart=always, MemoryMax, CPUQuota), thay PM2 dần.
- Rollback: binary trước giữ ở `/opt/nhadat/releases/<ts>`, symlink `current`.
