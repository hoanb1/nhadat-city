/**
 * AI Tools — Tập công cụ (allowlist) cho AI Real Estate Advisor
 * 
 * ai@6.x API: tool({ description, inputSchema, execute })
 * execute: (input: INPUT, options: ToolExecutionOptions) => Promise<OUTPUT>
 */

import { tool } from 'ai';
import { z } from 'zod';
import { sql } from '@/lib/db/pg';
import { and, type Frag } from '@/lib/db/pgUtil';
import { mapRealEstateRow } from '@/lib/db/realEstate';
import { makeUrlSlug } from '@/lib/utils/utils';

// Service URLs — imported from SSOT config, never redeclared here
import { GEOSERVER_URL, GEOSERVER_WORKSPACE, GEOSERVER_PARCEL_LAYER, NOMINATIM_URL, ML_API_URL } from '@/lib/config/server';
import { vn2000PolygonToWgs84 } from '@/lib/geo/vn2000';

/**
 * Columns safe to expose to the AI (NEVER contact / user ids / phone / email).
 * `extra` is reduced to bedrooms/floors so mapRealEstateRow() yields the old SAFE_PROJECTION shape.
 */
const SAFE_COLS = sql`id, mongo_id, short_id, title, total_price, price, area, address, property_type, listing_mode,
  province_slug, district_slug, ward_slug,
  jsonb_build_object('bedrooms', extra->'bedrooms', 'floors', extra->'floors') AS extra`;

function safeListing(r: any): any {
  const d = mapRealEstateRow(r);
  if (d.bedrooms === null) delete d.bedrooms;
  if (d.floors === null) delete d.floors;
  return d;
}

/** $geoWithin/$box equivalent on geom (GIST-indexed envelope). */
function boxCond(mapBounds: any): Frag | null {
  if (!mapBounds) return null;
  return sql`geom && ST_MakeEnvelope(${mapBounds.sw[0]}, ${mapBounds.sw[1]}, ${mapBounds.ne[0]}, ${mapBounds.ne[1]}, 4326)`;
}

const PRICE_EXPR = sql`COALESCE(total_price, price)`;

function formatPrice(val: number): string {
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(2)} tỷ`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)} triệu`;
  return `${val.toLocaleString()} đồng`;
}

function buildLink(l: any, filters?: any): string {
  const prov = l.adminunit?.province || filters?.province || '';
  const ward = l.adminunit?.ward || filters?.ward || '';
  const slug = makeUrlSlug(l.title || '');
  return `https://nhadat.city/${prov}/${ward}/${l.shortId || l._id}/${slug}`;
}

// ── Tool Factory — injects request context via closure ────────────────────
export function createTools(context: any) {
  const mapBounds = context?.mapBounds;
  const filters = context?.filters;
  const geoStage = boxCond(mapBounds);

  return {
    // ── 1. Search real listings ───────────────────────────────────────────
    searchListings: tool({
      description: 'Tìm BĐS thật từ database trong khu vực bản đồ hiện tại. Gọi khi user hỏi "gợi ý nhà", "tìm đất khoảng X tỷ", "có gì bán không", "giới thiệu cho tôi một số BĐS".',
      inputSchema: z.object({
        maxPrice: z.number().optional().describe('Giá tối đa (đồng). 5 tỷ = 5000000000'),
        minPrice: z.number().optional().describe('Giá tối thiểu (đồng)'),
        propertyType: z.string().optional().describe('Loại: nha_o, dat_nen, chung_cu, biet_thu'),
        minArea: z.number().optional().describe('Diện tích tối thiểu (m2)'),
        maxArea: z.number().optional().describe('Diện tích tối đa (m2)'),
        listingMode: z.enum(['ban', 'cho_thue']).optional(),
        limit: z.number().min(1).max(5).default(4),
      }),
      execute: async (params) => {
        try {
          const c: Frag[] = [sql`status >= 1`];
          if (geoStage) c.push(geoStage);
          if (params.maxPrice) c.push(sql`${PRICE_EXPR} <= ${params.maxPrice}`);
          if (params.minPrice) c.push(sql`${PRICE_EXPR} >= ${params.minPrice}`);
          if (params.propertyType) c.push(sql`property_type = ${params.propertyType}`);
          if (params.minArea) c.push(sql`area >= ${params.minArea}`);
          if (params.maxArea) c.push(sql`area <= ${params.maxArea}`);
          if (params.listingMode === 'cho_thue') c.push(sql`listing_mode IN ('cho_thue', 'thue')`);
          else if (params.listingMode) c.push(sql`listing_mode = ${params.listingMode}`);

          const listings = (await sql`
            SELECT ${SAFE_COLS} FROM real_estates WHERE ${and(c)}
            ORDER BY created_at DESC LIMIT ${params.limit}`).map(safeListing);

          if (listings.length === 0) {
            return { found: 0, message: 'Không có BĐS phù hợp. Thử mở rộng bản đồ hoặc điều chỉnh ngân sách.' };
          }

          return {
            found: listings.length,
            listings: listings.map(l => ({
              title: l.title,
              price: formatPrice(l.totalPrice || l.price || 0),
              area: l.area ? `${l.area}m2` : 'N/A',
              address: [l.address, l.adminunit?.ward, l.adminunit?.district, l.adminunit?.province].filter(Boolean).join(', '),
              propertyType: l.propertyType,
              bedrooms: l.bedrooms || null,
              link: buildLink(l, filters),
            })),
          };
        } catch (e) {
          return { error: 'Không thể tìm kiếm BĐS lúc này.' };
        }
      },
    }),

    // ── 2. Market statistics ──────────────────────────────────────────────
    getMarketStats: tool({
      description: 'Lấy thống kê thị trường (giá trung bình/m2, số lượng tin, phân bố loại BĐS) khu vực bản đồ. Gọi khi user hỏi "giá khu này", "thị trường thế nào", "đắt không", "so sánh giá".',
      inputSchema: z.object({}),
      execute: async () => {
        if (!mapBounds) return { message: 'Bạn cần zoom vào khu vực cụ thể trên bản đồ để xem thống kê.' };
        try {
          const where = and([sql`status >= 1`, ...(geoStage ? [geoStage] : [])]);

          const [priceData, typeData, modeData] = await Promise.all([
            sql`
              SELECT avg(pm2)::float8 AS avg, count(*)::int AS count, min(pm2)::float8 AS min, max(pm2)::float8 AS max
              FROM (
                SELECT (${PRICE_EXPR} / area) AS pm2 FROM real_estates
                WHERE ${where} AND area > 0 AND ${PRICE_EXPR} IS NOT NULL
              ) t
              WHERE pm2 >= 500000 AND pm2 <= 500000000`,
            sql`
              SELECT property_type AS _id, count(*)::int AS count FROM real_estates WHERE ${where}
              GROUP BY property_type ORDER BY count DESC LIMIT 5`,
            sql`
              SELECT COALESCE(listing_mode, 'ban') AS _id, count(*)::int AS count FROM real_estates WHERE ${where}
              GROUP BY 1`,
          ]);

          const p = priceData[0] && priceData[0].count > 0 ? priceData[0] : undefined;
          return {
            totalListings: p?.count || 0,
            avgPricePerM2: p ? `${(p.avg / 1e6).toFixed(1)} triệu/m2` : 'Không đủ dữ liệu',
            priceRange: p ? `${(p.min / 1e6).toFixed(1)} – ${(p.max / 1e6).toFixed(1)} triệu/m2` : 'N/A',
            byType: typeData.map(t => `${t._id || 'Khác'}: ${t.count} tin`),
            forSale: modeData.find((m: any) => m._id === 'ban')?.count || 0,
            forRent: modeData.filter((m: any) => m._id === 'cho_thue' || m._id === 'thue').reduce((a: number, m: any) => a + m.count, 0),
          };
        } catch (e) {
          return { error: 'Không thể tải thống kê thị trường.' };
        }
      },
    }),

    // ── 3. Current listing detail ─────────────────────────────────────────
    getListingDetail: tool({
      description: 'Lấy thông tin chi tiết BĐS đang được user xem. Gọi khi user nói "nhà này", "căn này", "bất động sản này", "đánh giá cho tôi", "có nên mua không".',
      inputSchema: z.object({}),
      execute: async () => {
        const l = context?.selectedListing;
        if (!l) return { message: 'Chưa có BĐS nào được chọn. Hãy click vào một tin đăng trên bản đồ.' };
        const price = l.totalPrice || l.price || 0;
        return {
          title: l.title,
          price: formatPrice(price),
          pricePerM2: l.area > 0 ? formatPrice(Math.round(price / l.area)) + '/m2' : 'N/A',
          area: l.area ? `${l.area}m2` : 'N/A',
          address: [l.address, l.adminunit?.ward, l.adminunit?.district, l.adminunit?.province].filter(Boolean).join(', '),
          propertyType: l.propertyType,
          listingMode: l.listingMode === 'cho_thue' ? 'Cho thuê' : 'Bán',
          bedrooms: l.bedrooms || null,
          floors: l.floors || null,
          link: buildLink(l, filters),
          description: l.description?.replace(/<[^>]*>/g, '').substring(0, 400) || null,
        };
      },
    }),

    // ── 4. Mortgage calculator ────────────────────────────────────────────
    calculateMortgage: tool({
      description: 'Tính toán khoản vay mua BĐS: tiền trả hàng tháng, tổng lãi, thời hạn vay. Gọi khi user hỏi "vay bao nhiêu tiền", "trả góp bao nhiêu", "có đủ tiền mua không", "vay 70% thì sao".',
      inputSchema: z.object({
        propertyPrice: z.number().describe('Giá BĐS (đồng). Nếu user đang xem BĐS cụ thể, dùng giá đó.'),
        downPaymentPercent: z.number().min(10).max(90).default(30).describe('Tỷ lệ trả trước (%). Mặc định 30%.'),
        annualInterestRate: z.number().min(1).max(30).default(8.5).describe('Lãi suất năm (%). Mặc định 8.5% (lãi suất TB hiện tại VN).'),
        loanTermYears: z.number().min(1).max(30).default(20).describe('Thời hạn vay (năm). Mặc định 20 năm.'),
      }),
      execute: async (params) => {
        const downPayment = params.propertyPrice * (params.downPaymentPercent / 100);
        const loanAmount = params.propertyPrice - downPayment;
        const monthlyRate = (params.annualInterestRate / 100) / 12;
        const totalMonths = params.loanTermYears * 12;

        // PMT formula: monthly payment
        const monthlyPayment = monthlyRate === 0
          ? loanAmount / totalMonths
          : (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalMonths))
            / (Math.pow(1 + monthlyRate, totalMonths) - 1);

        const totalPaid = monthlyPayment * totalMonths;
        const totalInterest = totalPaid - loanAmount;

        // Affordability: based on 30% income rule
        const recommendedMonthlyIncome = monthlyPayment / 0.30;

        // Early payoff scenario (extra 20% payment)
        const extraPayment = monthlyPayment * 0.2;
        const newMonthlyPayment = monthlyPayment + extraPayment;
        // Approx months to payoff with extra payment
        const earlyPayoffMonths = Math.ceil(
          Math.log(newMonthlyPayment / (newMonthlyPayment - loanAmount * monthlyRate))
          / Math.log(1 + monthlyRate)
        );

        return {
          summary: {
            propertyPrice: formatPrice(params.propertyPrice),
            downPayment: `${formatPrice(downPayment)} (${params.downPaymentPercent}%)`,
            loanAmount: formatPrice(loanAmount),
            loanTermYears: params.loanTermYears,
            annualRate: `${params.annualInterestRate}%`,
          },
          monthly: {
            payment: formatPrice(Math.round(monthlyPayment)),
            paymentNote: `Số tiền cần trả mỗi tháng trong ${params.loanTermYears} năm`,
          },
          totalCost: {
            totalPaid: formatPrice(Math.round(totalPaid)),
            totalInterest: formatPrice(Math.round(totalInterest)),
            interestPercent: `${((totalInterest / loanAmount) * 100).toFixed(0)}% so với vốn vay`,
          },
          affordability: {
            recommendedIncome: `Tối thiểu ${formatPrice(Math.round(recommendedMonthlyIncome))}/tháng (quy tắc 30% thu nhập)`,
          },
          tip: loanAmount > 3_000_000_000
            ? 'Đây là khoản vay lớn. Nên so sánh lãi suất từ ít nhất 3 ngân hàng và ưu tiên ngân hàng có lãi suất cố định 2-3 năm đầu.'
            : 'Khoản vay vừa phải. Nên chọn ngân hàng ưu đãi lãi suất 12-24 tháng đầu và có thể tất toán trước hạn không phí.',
        };
      },
    }),

    // ── 5. Search nearby real estate ─────────────────────────────────────────
    searchNearby: tool({
      description: 'Tìm BẤT ĐỘNG SẢN đang bán/cho thuê gần một vị trí cụ thể (theo tọa độ và bán kính). KHÔNG dùng tool này để tìm tiện ích (trường học, bệnh viện...).',
      inputSchema: z.object({
        lat: z.number().describe('Vĩ độ trung tâm. Lấy từ bất động sản đang xem hoặc vị trí bản đồ hiện tại.'),
        lng: z.number().describe('Kinh độ trung tâm.'),
        radiusKm: z.number().min(0.1).max(10).default(1).describe('Bán kính tìm kiếm (km). Mặc định 1km.'),
        limit: z.number().min(1).max(6).default(5),
        propertyType: z.string().optional().describe('Lọc theo loại BĐS nếu cần'),
      }),
      execute: async (params) => {
        try {
          const meters = params.radiusKm * 1000;
          // Envelope prefilter (GIST) then exact geodesic distance
          const degLat = params.radiusKm / 111;
          const degLng = degLat / Math.max(Math.cos((params.lat * Math.PI) / 180), 0.2);
          const pt = sql`ST_SetSRID(ST_MakePoint(${params.lng}, ${params.lat}), 4326)`;
          const c: Frag[] = [
            sql`status >= 1`,
            sql`geom && ST_Expand(${pt}, ${Math.max(degLat, degLng)})`,
            sql`ST_DWithin(geom::geography, ${pt}::geography, ${meters})`,
          ];
          if (params.propertyType) c.push(sql`property_type = ${params.propertyType}`);

          const listings = (await sql`
            SELECT ${SAFE_COLS} FROM real_estates WHERE ${and(c)}
            ORDER BY created_at DESC LIMIT ${params.limit}`).map(safeListing);

          if (listings.length === 0) {
            return { found: 0, message: `Không có BĐS nào trong bán kính ${params.radiusKm}km. Thử mở rộng bán kính hơn.` };
          }

          return {
            found: listings.length,
            searchCenter: `${params.lat.toFixed(5)}, ${params.lng.toFixed(5)}`,
            radius: `${params.radiusKm}km`,
            listings: listings.map(l => ({
              title: l.title,
              price: formatPrice(l.totalPrice || l.price || 0),
              area: l.area ? `${l.area}m2` : 'N/A',
              address: [l.address, l.adminunit?.ward, l.adminunit?.district].filter(Boolean).join(', '),
              propertyType: l.propertyType,
              link: buildLink(l, filters),
            })),
          };
        } catch (e) {
          return { error: 'Không thể tìm kiếm khu vực lân cận.' };
        }
      },
    }),

    // ── 5.5 Get nearby amenities (POIs) ──────────────────────────────────
    getNearbyAmenities: tool({
      description: 'Lấy danh sách các tiện ích xung quanh (trường học, bệnh viện, siêu thị, công viên) của một vị trí. Gọi khi user hỏi "tiện ích quanh đây", "gần đây có trường học nào không", "tiện ích BĐS này".',
      inputSchema: z.object({
        lat: z.number().describe('Vĩ độ trung tâm. Lấy từ bất động sản đang xem hoặc bản đồ.'),
        lng: z.number().describe('Kinh độ trung tâm. Lấy từ bất động sản đang xem hoặc bản đồ.'),
      }),
      execute: async (params) => {
        try {
          const { GET: getNearby } = await import('@/app/api/nearby/route');
          const { NextRequest } = await import('next/server');
          
          const req = new NextRequest(`http://localhost/api/nearby?lat=${params.lat}&lng=${params.lng}&radius=2000`);
          const res = await getNearby(req);
          
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data?.aiContext) {
              return json.data.aiContext;
            }
          }

          return { message: 'Không tìm thấy tiện ích nào xung quanh khu vực này.' };
        } catch (e) {
          console.error('[AI Tool] getNearbyAmenities error:', e);
          return { error: 'Không thể lấy thông tin tiện ích lúc này.' };
        }
      },
    }),

    // ── 6. Price trend ────────────────────────────────────────────────────
    getPriceTrend: tool({
      description: 'Xem xu hướng giá BĐS theo thời gian trong khu vực. Gọi khi user hỏi "giá tăng hay giảm", "xu hướng thị trường", "năm ngoái so với năm nay", "có nên đầu tư không", "thị trường đang hot không".',
      inputSchema: z.object({
        months: z.number().min(3).max(24).default(12).describe('Số tháng lịch sử cần xem. Mặc định 12 tháng.'),
        propertyType: z.string().optional().describe('Lọc theo loại BĐS nếu cần'),
      }),
      execute: async (params) => {
        if (!mapBounds) return { message: 'Bạn cần zoom vào khu vực cụ thể trên bản đồ để xem xu hướng giá.' };
        try {
          const fromDate = new Date();
          fromDate.setMonth(fromDate.getMonth() - params.months);

          const c: Frag[] = [sql`status >= 1`, sql`created_at >= ${fromDate}`];
          if (geoStage) c.push(geoStage);
          if (params.propertyType) c.push(sql`property_type = ${params.propertyType}`);

          const trendRows = await sql`
            SELECT year, month, avg(pm2)::float8 AS avg_pm2, count(*)::int AS count FROM (
              SELECT EXTRACT(YEAR FROM created_at AT TIME ZONE 'UTC')::int AS year,
                     EXTRACT(MONTH FROM created_at AT TIME ZONE 'UTC')::int AS month,
                     (${PRICE_EXPR} / area) AS pm2
              FROM real_estates
              WHERE ${and(c)} AND area > 0 AND ${PRICE_EXPR} IS NOT NULL
            ) t
            WHERE pm2 >= 500000 AND pm2 <= 500000000
            GROUP BY year, month ORDER BY year, month`;
          const trend = trendRows.map((r: any) => ({ _id: { year: r.year, month: r.month }, avgPm2: r.avg_pm2, count: r.count }));

          if (trend.length < 2) {
            return { message: 'Chưa đủ dữ liệu để phân tích xu hướng giá trong khu vực này.' };
          }

          const points = trend.map(t => ({
            period: `T${t._id.month}/${t._id.year}`,
            avgPriceM2: `${(t.avgPm2 / 1e6).toFixed(1)} triệu/m2`,
            listings: t.count,
          }));

          // Calculate trend
          const first = trend[0].avgPm2;
          const last = trend[trend.length - 1].avgPm2;
          const changePercent = ((last - first) / first * 100).toFixed(1);
          const trending = last > first ? 'Tăng' : last < first ? 'Giảm' : 'Ổn định';

          return {
            period: `${params.months} tháng gần nhất`,
            trend: `${trending} ${Math.abs(Number(changePercent))}% so với đầu kỳ`,
            startPrice: `${(first / 1e6).toFixed(1)} triệu/m2`,
            endPrice: `${(last / 1e6).toFixed(1)} triệu/m2`,
            dataPoints: points,
            investmentNote: Number(changePercent) > 5
              ? 'Thị trường đang tăng tốt. Phù hợp đầu tư nếu nhu cầu thực sự cao.'
              : Number(changePercent) < -5
                ? 'Thị trường đang giảm. Cần thận trọng, nên chờ điểm đáy hoặc đàm phán giá mạnh hơn.'
                : 'Thị trường tương đối ổn định. Thích hợp cho người mua ở thực.',
          };
        } catch (e) {
          return { error: 'Không thể tải dữ liệu xu hướng giá.' };
        }
      },
    }),

    // ── 7. Parcel planning info ───────────────────────────────────────────
    getParcelInfo: tool({
      description: 'Lấy thông tin thửa đất (ranh giới địa chính, loại đất, quy hoạch) đang được chọn trên bản đồ. Gọi khi user hỏi về "thửa đất này", "loại đất gì", "quy hoạch như thế nào", "có được xây nhà không", "đất CLN là gì".',
      inputSchema: z.object({}),
      execute: async () => {
        const p = context?.selectedParcel;
        if (!p) return { message: 'Chưa có thửa đất nào được chọn. Hãy click vào ranh giới thửa đất trên bản đồ.' };

        const pSlug = p.provinceSlug || filters?.province || 'unknown';
        const wSlug = p.wardSlug || filters?.ward || 'unknown';
        const link = `https://nhadat.city/parcel-boundary/${pSlug}/${wSlug}/${p.thuaId}`;
        const address = [p.wardName, p.districtName, p.provinceName].filter(Boolean).join(', ');

        // Interpret land type for layman
        const landTypeExplanations: Record<string, string> = {
          'CLN': 'Đất cây lâu năm — thường được chuyển đổi sang đất ở, cần xin phép chuyển mục đích',
          'ONT': 'Đất ở nông thôn — được phép xây dựng nhà ở',
          'ODT': 'Đất ở đô thị — được phép xây dựng nhà ở, giá trị cao',
          'RSX': 'Đất rừng sản xuất — không được xây dựng nhà ở, khó chuyển đổi',
          'NTS': 'Đất nông thôn tổng hợp',
          'LUC': 'Đất lúa — bị hạn chế chuyển đổi, cần phê duyệt đặc biệt',
          'HNK': 'Đất hoa màu/nương rẫy',
          'SKC': 'Đất sản xuất kinh doanh phi nông nghiệp',
          'TMD': 'Đất thương mại dịch vụ',
          'CSD': 'Đất công trình sự nghiệp',
        };

        const loaiDat = p.loaiDat || '';
        const explanation = landTypeExplanations[loaiDat] || `Mã loại đất: ${loaiDat} — Liên hệ UBND địa phương để biết quy định cụ thể`;

        return {
          parcelInfo: {
            soTo: p.soTo || 'N/A',
            soThua: p.soThua || 'N/A',
            dienTich: p.dienTich ? `${p.dienTich}m2` : 'N/A',
            loaiDat: p.loaiDatName || loaiDat,
            loaiDatCode: loaiDat,
            address,
            coordinates: p.lng && p.lat ? `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}` : 'N/A',
            link,
          },
          landTypeExplanation: explanation,
          buildingPermission: ['ONT', 'ODT'].includes(loaiDat)
            ? 'Được phép xây dựng nhà ở'
            : ['CLN', 'HNK', 'LUC'].includes(loaiDat)
              ? 'Cần chuyển đổi mục đích sử dụng trước khi xây dựng nhà ở'
              : ['RSX'].includes(loaiDat)
                ? 'Hạn chế xây dựng nhà ở'
                : 'Cần kiểm tra với cơ quan địa phương',
          note: 'Thông tin từ bản đồ địa chính tham khảo. Để biết chính xác tình trạng pháp lý, cần tra cứu tại Văn phòng Đăng ký Đất đai.',
        };
      },
    }),

    // ── 8. Nominatim geocode (address → coordinates) ──────────────────────
    geocodeAddress: tool({
      description: 'Tìm tọa độ (lat/lng) và thông tin địa lý của một địa chỉ. Gọi khi user hỏi "địa chỉ X ở đâu", "tìm đường X", "tọa độ phường Y", "cách tìm đến địa chỉ Z".',
      inputSchema: z.object({
        query: z.string().describe('Địa chỉ cần tìm. Nên thêm "Việt Nam" vào cuối nếu chưa có.'),
        limit: z.number().min(1).max(5).default(3),
      }),
      execute: async (params) => {
        try {
          const q = encodeURIComponent(params.query.includes('Việt Nam') ? params.query : params.query + ', Việt Nam');
          const url = `${NOMINATIM_URL}/search?format=json&q=${q}&limit=${params.limit}&addressdetails=1&accept-language=vi`;
          const res = await fetch(url, {
            headers: { 'User-Agent': 'NhaDatCity-AI/1.0 (nhadat.city)' },
            signal: AbortSignal.timeout(5000),
          });
          if (!res.ok) throw new Error(`Nominatim ${res.status}`);
          const data = await res.json();

          if (!data || data.length === 0) {
            return { found: 0, message: `Không tìm thấy địa chỉ "${params.query}". Thử nhập đầy đủ hơn (thêm tên phường/quận/tỉnh).` };
          }

          return {
            found: data.length,
            results: data.map((r: any) => ({
              name: r.display_name,
              lat: parseFloat(r.lat),
              lng: parseFloat(r.lon),
              type: r.type,
              ward: r.address?.suburb || r.address?.village || r.address?.town,
              district: r.address?.city_district || r.address?.county,
              province: r.address?.state || r.address?.city,
              mapLink: `https://nhadat.city/?lat=${r.lat}&lng=${r.lon}&zoom=16`,
            })),
          };
        } catch (e: any) {
          return { error: e.name === 'TimeoutError' ? 'Nominatim timeout — thử lại sau.' : 'Không thể tìm địa chỉ lúc này.' };
        }
      },
    }),

    // ── 9. Nominatim reverse geocode (coordinates → address) ─────────────
    reverseGeocode: tool({
      description: 'Tra cứu địa chỉ từ tọa độ GPS. Gọi khi user hỏi "vị trí này là đâu", "tọa độ X,Y là ở đâu", "địa chỉ của điểm này". Dùng tọa độ từ bản đồ hoặc BĐS đang xem.',
      inputSchema: z.object({
        lat: z.number().describe('Vĩ độ'),
        lng: z.number().describe('Kinh độ'),
      }),
      execute: async (params) => {
        try {
          const url = `${NOMINATIM_URL}/reverse?format=json&lat=${params.lat}&lon=${params.lng}&zoom=18&addressdetails=1&accept-language=vi`;
          const res = await fetch(url, {
            headers: { 'User-Agent': 'NhaDatCity-AI/1.0 (nhadat.city)' },
            signal: AbortSignal.timeout(5000),
          });
          if (!res.ok) throw new Error(`Nominatim reverse ${res.status}`);
          const r = await res.json();

          if (r.error) return { message: 'Không xác định được địa chỉ tại tọa độ này.' };

          return {
            fullAddress: r.display_name,
            houseNumber: r.address?.house_number,
            road: r.address?.road,
            ward: r.address?.suburb || r.address?.village || r.address?.town,
            district: r.address?.city_district || r.address?.county,
            province: r.address?.state || r.address?.city,
            country: r.address?.country,
            postcode: r.address?.postcode,
            coordinates: `${params.lat.toFixed(6)}, ${params.lng.toFixed(6)}`,
          };
        } catch (e: any) {
          return { error: e.name === 'TimeoutError' ? 'Timeout khi tra cứu địa chỉ.' : 'Không thể tra cứu địa chỉ.' };
        }
      },
    }),

    // ── 10. GeoServer WFS — query spatial layers ──────────────────────────
    queryGeoServer: tool({
      description: 'Truy vấn dữ liệu không gian từ GeoServer (thửa đất, quy hoạch, ranh giới hành chính). Gọi khi user hỏi "thửa đất gần đây", "ranh giới phường", "quy hoạch khu vực", "có bao nhiêu thửa".',
      inputSchema: z.object({
        queryType: z.enum(['parcels_near_point', 'parcels_in_bbox', 'admin_boundary'])
          .describe('Loại truy vấn: parcels_near_point=thửa đất gần điểm, parcels_in_bbox=thửa đất trong bbox, admin_boundary=ranh giới hành chính'),
        lat: z.number().optional().describe('Vĩ độ (dùng cho parcels_near_point)'),
        lng: z.number().optional().describe('Kinh độ (dùng cho parcels_near_point)'),
        radiusM: z.number().min(50).max(2000).default(200).optional().describe('Bán kính tìm (mét). Mặc định 200m.'),
        maxFeatures: z.number().min(1).max(20).default(5).optional(),
      }),
      execute: async (params) => {
        try {
          let wfsUrl = '';
          const baseWFS = `${GEOSERVER_URL}/ows?service=WFS&version=1.0.0&request=GetFeature&outputFormat=application%2Fjson&maxFeatures=${params.maxFeatures || 5}`;

          if (params.queryType === 'parcels_near_point' && params.lat && params.lng) {
            // Buffer around point in degrees (~radiusM meters)
            const deg = (params.radiusM || 200) / 111320;
            const bbox = [
              params.lng - deg, params.lat - deg,
              params.lng + deg, params.lat + deg
            ].join(',');
            wfsUrl = `${baseWFS}&typeName=${GEOSERVER_PARCEL_LAYER}&bbox=${bbox},EPSG:4326`;

          } else if (params.queryType === 'parcels_in_bbox' && context?.bbox) {
            const [w, s, e, n] = context.bbox;
            // Limit bbox size to prevent huge queries
            const maxDeg = 0.05; // ~5km
            if ((e - w) > maxDeg || (n - s) > maxDeg) {
              return { message: 'Vùng bản đồ quá rộng để truy vấn thửa đất. Zoom gần hơn (zoom ≥ 15).' };
            }
            wfsUrl = `${baseWFS}&typeName=${GEOSERVER_PARCEL_LAYER}&bbox=${w},${s},${e},${n},EPSG:4326`;

          } else if (params.queryType === 'admin_boundary') {
            // Query administrative boundary layer
            wfsUrl = `${baseWFS}&typeName=${GEOSERVER_WORKSPACE}:admin_boundaries`;
            if (context?.center) {
              const deg = 0.01;
              const bbox = [context.center.lng - deg, context.center.lat - deg, context.center.lng + deg, context.center.lat + deg].join(',');
              wfsUrl += `&bbox=${bbox},EPSG:4326`;
            }

          } else {
            return { message: 'Cần cung cấp tọa độ hoặc bbox bản đồ hợp lệ.' };
          }

          const res = await fetch(wfsUrl, { signal: AbortSignal.timeout(8000) });
          if (!res.ok) throw new Error(`GeoServer WFS ${res.status}`);
          const geojson = await res.json();

          const features = geojson.features || [];
          if (features.length === 0) {
            return { found: 0, message: 'Không có dữ liệu không gian trong vùng này.' };
          }

          // Safe: extract only non-sensitive properties
          const results = features.slice(0, 10).map((f: any) => {
            const p = f.properties || {};
            return {
              soTo: p.so_to || p.soTo || p.SO_TO,
              soThua: p.so_thua || p.soThua || p.SO_THUA,
              dienTich: p.dien_tich || p.dienTich || p.DIEN_TICH,
              loaiDat: p.loai_dat || p.loaiDat || p.LOAI_DAT,
              maDVHC: p.ma_dvhc || p.maDVHC,
            };
          });

          return {
            found: features.length,
            queryType: params.queryType,
            parcels: results,
            note: 'Dữ liệu địa chính từ GeoServer. Chỉ mang tính tham khảo.',
          };
        } catch (e: any) {
          if (e.name === 'TimeoutError') return { error: 'GeoServer timeout. Thử lại hoặc zoom gần hơn.' };
          return { error: 'Không thể truy vấn GeoServer lúc này.' };
        }
      },
    }),

    // ── 11. Compare listings ─────────────────────────────────────────────
    compareListings: tool({
      description: 'So sánh chi tiết 2-3 BĐS. Gọi khi user hỏi "so sánh nhà này với nhà kia", "cái nào tốt hơn", "so sánh các BĐS đã chọn".',
      inputSchema: z.object({
        ids: z.array(z.string()).min(2).max(3).describe('Danh sách ID của các BĐS cần so sánh.'),
      }),
      execute: async (params) => {
        try {
          const listings = (await sql`
            SELECT ${SAFE_COLS} FROM real_estates
            WHERE mongo_id IN ${sql(params.ids)} OR short_id IN ${sql(params.ids)}`).map(safeListing);

          if (listings.length === 0) {
            return { message: 'Không tìm thấy BĐS nào để so sánh.' };
          }

          return {
            count: listings.length,
            listings: listings.map(l => ({
              id: String(l._id),
              title: l.title,
              price: formatPrice(l.totalPrice || l.price || 0),
              area: l.area ? `${l.area}m2` : 'N/A',
              pricePerM2: l.area > 0 ? formatPrice(Math.round((l.totalPrice || l.price || 0) / l.area)) + '/m2' : 'N/A',
              address: [l.address, l.adminunit?.ward, l.adminunit?.district].filter(Boolean).join(', '),
              propertyType: l.propertyType,
              bedrooms: l.bedrooms || null,
              floors: l.floors || null,
              link: buildLink(l, context?.filters),
            })),
          };
        } catch (e) {
          return { error: 'Không thể so sánh BĐS lúc này.' };
        }
      },
    }),

    // ── 12. Find similar listings ────────────────────────────────────────
    findSimilarListings: tool({
      description: 'Tìm BĐS tương tự như BĐS đang xem hoặc một BĐS cụ thể. Gọi khi user hỏi "tìm nhà tương tự", "có cái nào giống thế này không".',
      inputSchema: z.object({
        listingId: z.string().describe('ID của BĐS làm mẫu.'),
        limit: z.number().min(1).max(5).default(3),
      }),
      execute: async (params) => {
        try {
          const srcRows = await sql`
            SELECT id, mongo_id, property_type, total_price, price, area, province_slug FROM real_estates
            WHERE mongo_id = ${params.listingId} OR short_id = ${params.listingId} LIMIT 1`;
          if (!srcRows.length) return { message: 'Không tìm thấy BĐS mẫu.' };
          const source = srcRows[0];

          const price = Number(source.total_price ?? source.price ?? 0) || 0;
          const area = Number(source.area || 0);

          const c: Frag[] = [sql`id <> ${source.id}`, sql`status >= 1`];
          if (source.property_type) c.push(sql`property_type = ${source.property_type}`);
          // Similar price (+/- 20%)
          if (price > 0) c.push(sql`${PRICE_EXPR} <= ${price * 1.2} AND ${PRICE_EXPR} >= ${price * 0.8}`);
          // Similar area (+/- 20%)
          if (area > 0) c.push(sql`area >= ${area * 0.8} AND area <= ${area * 1.2}`);
          // Same province at least
          if (source.province_slug) c.push(sql`province_slug = ${source.province_slug}`);

          const listings = (await sql`
            SELECT ${SAFE_COLS} FROM real_estates WHERE ${and(c)} LIMIT ${params.limit}`).map(safeListing);

          return {
            found: listings.length,
            listings: listings.map(l => ({
              title: l.title,
              price: formatPrice(l.totalPrice || l.price || 0),
              area: l.area ? `${l.area}m2` : 'N/A',
              address: [l.address, l.adminunit?.ward, l.adminunit?.district].filter(Boolean).join(', '),
              link: buildLink(l, context?.filters),
            })),
          };
        } catch (e) {
          return { error: 'Không thể tìm BĐS tương tự.' };
        }
      },
    }),

    // ── 13. Estimate rental yield ────────────────────────────────────────
    estimateRentalYield: tool({
      description: 'Tính toán lợi suất cho thuê (ROI) ước tính của BĐS. Gọi khi user hỏi "mua để cho thuê có tốt không", "lợi suất bao nhiêu", "ROI".',
      inputSchema: z.object({
        propertyPrice: z.number().describe('Giá mua BĐS (đồng).'),
        estimatedMonthlyRent: z.number().optional().describe('Giá thuê ước tính mỗi tháng (đồng). Nếu không nhập, AI sẽ tự ước tính.'),
        propertyType: z.string().optional().describe('Loại BĐS (nha_o, chung_cu...) để ước tính giá thuê.'),
      }),
      execute: async (params) => {
        const price = params.propertyPrice;
        let monthlyRent = params.estimatedMonthlyRent;

        // Auto estimate rent if not provided (typical yield in VN: 3-5% for residential, 4-6% for apartment)
        if (!monthlyRent) {
          let yieldRate = 0.04; // 4% default
          if (params.propertyType === 'chung_cu') yieldRate = 0.05;
          if (params.propertyType === 'nha_o') yieldRate = 0.035;
          
          monthlyRent = (price * yieldRate) / 12;
        }

        const annualRent = monthlyRent * 12;
        const grossYield = (annualRent / price) * 100;

        // Net yield estimation (subtracting 15% for costs: maintenance, vacancy, management)
        const netAnnualRent = annualRent * 0.85;
        const netYield = (netAnnualRent / price) * 100;

        return {
          propertyPrice: formatPrice(price),
          estimatedMonthlyRent: formatPrice(Math.round(monthlyRent)),
          annualIncome: formatPrice(Math.round(annualRent)),
          grossYield: `${grossYield.toFixed(2)}% / năm`,
          netYieldEstimate: `${netYield.toFixed(2)}% / năm (sau khi trừ 15% chi phí vận hành, bảo trì, trống phòng)`,
          paybackYears: (100 / netYield).toFixed(1) + ' năm',
          note: 'Đây là ước tính tham khảo. Lợi suất thực tế phụ thuộc vào vị trí cụ thể và tình trạng thị trường.',
        };
      },
    }),

    // ── 14. Save user preferences ────────────────────────────────────────
    savePreferences: tool({
      description: 'Lưu sở thích tìm kiếm của người dùng (ngân sách, loại nhà, khu vực...). Gọi khi user nói "tôi thích nhà...", "gu của tôi là...", "lưu tìm kiếm này".',
      inputSchema: z.object({
        preferences: z.object({
          budget: z.object({
            min: z.number().optional(),
            max: z.number().optional(),
          }).optional(),
          propertyTypes: z.array(z.string()).optional(),
          bedrooms: z.number().optional(),
          preferredAreas: z.array(z.string()).optional(),
          purpose: z.enum(['o_thuc', 'dau_tu']).optional(),
        }).describe('Sở thích của người dùng.'),
      }),
      execute: async (params) => {
        const userId = context?.userId;
        if (!userId) return { message: 'Bạn cần đăng nhập để lưu sở thích.' };

        try {
          await sql`
            INSERT INTO user_ai_preferences (user_key, preferences, updated_at)
            VALUES (${String(userId)}, ${sql.json(params.preferences as any)}, NOW())
            ON CONFLICT (user_key) DO UPDATE SET preferences = EXCLUDED.preferences, updated_at = NOW()`;

          return { success: true, message: 'Đã lưu sở thích của bạn.' };
        } catch (e) {
          return { error: 'Không thể lưu sở thích lúc này.' };
        }
      },
    }),

    // ── 15. Get user preferences ────────────────────────────────────────
    getMyPreferences: tool({
      description: 'Lấy sở thích tìm kiếm đã lưu của người dùng. Gọi khi user hỏi "tôi thích gì", "nhắc lại gu của tôi", "tìm theo sở thích".',
      inputSchema: z.object({}),
      execute: async () => {
        const userId = context?.userId;
        if (!userId) return { message: 'Bạn cần đăng nhập để xem sở thích.' };

        try {
          const prefRows = await sql`SELECT preferences FROM user_ai_preferences WHERE user_key = ${String(userId)} LIMIT 1`;
          const prefs = prefRows[0];

          if (!prefs || !prefs.preferences) {
            return { message: 'Bạn chưa lưu sở thích nào. Hãy nói cho tôi biết gu của bạn!' };
          }

          return { success: true, preferences: prefs.preferences };
        } catch (e) {
          return { error: 'Không thể lấy sở thích lúc này.' };
        }
      },
    }),

    // ── 16. Valuate property (ML integration) ────────────────────────────────
    valuateProperty: tool({
      description: 'Định giá bất động sản tự động sử dụng AI/ML. Gọi khi user hỏi "nhà này giá bao nhiêu thì hợp lý", "định giá giúp tôi căn nhà", "giá thị trường của đất này".',
      inputSchema: z.object({
        property_type_name: z.enum(['Nhà', 'Căn hộ chung cư', 'Đất', 'Biệt thự, liền kề']).default('Nhà').describe('Loại bất động sản.'),
        province_name: z.string().describe('Tỉnh/Thành phố (VD: Hà Nội, Hồ Chí Minh, Đà Nẵng).'),
        district_name: z.string().describe('Quận/Huyện (VD: Cầu Giấy, Quận 1).'),
        ward_name: z.string().describe('Phường/Xã (VD: Dịch Vọng, Phường Bến Nghé).'),
        street_name: z.string().default('Unknown').describe('Tên đường/phố (VD: Nguyễn Trãi, Lê Lợi). Nhập Unknown nếu không biết.'),
        area: z.number().min(10).describe('Diện tích (m2).'),
        bedroom_count: z.number().default(0).describe('Số phòng ngủ. Nhập 0 nếu là Đất.'),
        bathroom_count: z.number().default(0).describe('Số phòng tắm/WC.'),
        floor_count: z.number().default(1).describe('Số tầng.'),
        frontage_width: z.number().default(0).describe('Mặt tiền (m). Nhập 0 nếu không biết.'),
        house_direction: z.string().default('Unknown').describe('Hướng nhà (Đông, Tây, Nam, Bắc...). Nhập Unknown nếu không biết.')
      }),
      execute: async (params) => {
        try {
          const res = await fetch(`${ML_API_URL}/predict`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
            signal: AbortSignal.timeout(5000),
          });
          if (!res.ok) throw new Error(`ML API error ${res.status}`);
          const data = await res.json();
          return {
            success: true,
            estimated_price: data.estimated_price,
            formatted_price: data.formatted_price,
            message: `Mô hình AI định giá bất động sản này khoảng **${data.formatted_price}**. LƯU Ý: Đây là kết quả dự đoán từ mô hình Machine Learning dựa trên đặc điểm của bất động sản, chỉ mang tính chất tham khảo.`
          };
        } catch (e) {
          console.error('[AI Tool] valuateProperty error:', e);
          return { error: 'Hệ thống định giá AI đang bận hoặc không phản hồi. Vui lòng thử lại sau.' };
        }
      },
    }),

    // ── 17. Analyze Investment Deal (Săn món hời) ─────────────────────────
    analyzeInvestmentDeal: tool({
      description: 'Phân tích cơ hội đầu tư (săn món hời). So sánh giá rao bán với giá trị thực do AI định giá để đưa ra đánh giá mức độ hấp dẫn (Deal Score). Gọi khi user cung cấp giá của một BĐS và hỏi "căn này mua được không", "giá này đắt hay rẻ", "có hời không".',
      inputSchema: z.object({
        listed_price: z.number().describe('Giá đang rao bán (VND). Ví dụ: 5 tỷ = 5000000000.'),
        property_type_name: z.enum(['Nhà', 'Căn hộ chung cư', 'Đất', 'Biệt thự, liền kề']).default('Nhà').describe('Loại bất động sản.'),
        province_name: z.string().describe('Tỉnh/Thành phố (VD: Hà Nội).'),
        district_name: z.string().describe('Quận/Huyện.'),
        ward_name: z.string().describe('Phường/Xã.'),
        street_name: z.string().default('Unknown').describe('Tên đường/phố. Càng chi tiết càng chính xác.'),
        area: z.number().min(10).describe('Diện tích (m2).'),
        bedroom_count: z.number().default(0),
        bathroom_count: z.number().default(0),
        floor_count: z.number().default(1),
        frontage_width: z.number().default(0),
        house_direction: z.string().default('Unknown')
      }),
      execute: async (params) => {
        try {
          const res = await fetch(`${ML_API_URL}/analyze_deal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
            signal: AbortSignal.timeout(5000),
          });
          if (!res.ok) throw new Error(`ML API error ${res.status}`);
          const data = await res.json();
          return {
            success: true,
            deal_score: data.deal_score,
            evaluation: data.evaluation,
            expected_price: data.formatted_expected_price,
            analysis_message: data.message,
            advice: `Dựa trên AI, giá trị thực của tài sản là **${data.formatted_expected_price}**. Với giá rao bán bạn cung cấp, độ hấp dẫn của cơ hội này là **${data.deal_score}/100** (${data.evaluation}). ${data.message}`
          };
        } catch (e) {
          console.error('[AI Tool] analyzeInvestmentDeal error:', e);
          return { error: 'Hệ thống phân tích giá đang bận. Vui lòng thử lại sau.' };
        }
      },
    }),

    // ── 18. Detect Fake / Anomaly Listing ────────────────────────────────
    detectFakeListing: tool({
      description: 'Phát hiện tin ảo, tin đăng rác, hoặc giá bất thường bằng mô hình AI Isolation Forest. Gọi khi user hỏi "tin này có đáng tin không", "giá này có ảo không", "kiểm tra độ an toàn của tin này".',
      inputSchema: z.object({
        listed_price: z.number().describe('Giá đang rao bán (VND).'),
        property_type_name: z.enum(['Nhà', 'Căn hộ chung cư', 'Đất', 'Biệt thự, liền kề']).default('Nhà'),
        province_name: z.string().describe('Tỉnh/Thành phố.'),
        district_name: z.string().describe('Quận/Huyện.'),
        ward_name: z.string().describe('Phường/Xã.'),
        street_name: z.string().default('Unknown'),
        area: z.number().min(10),
        bedroom_count: z.number().default(0),
        bathroom_count: z.number().default(0),
        floor_count: z.number().default(1),
        frontage_width: z.number().default(0),
        house_direction: z.string().default('Unknown')
      }),
      execute: async (params) => {
        try {
          const res = await fetch(`${ML_API_URL}/detect_anomaly`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
            signal: AbortSignal.timeout(5000),
          });
          if (!res.ok) throw new Error(`ML API error ${res.status}`);
          const data = await res.json();
          return {
            success: true,
            is_anomaly: data.is_anomaly,
            anomaly_score: data.anomaly_score,
            message: data.message,
            advice: data.is_anomaly 
              ? `Cảnh báo từ AI: Dựa trên thuật toán Anomaly Detection, tin đăng này có điểm tin cậy rất thấp (${data.anomaly_score.toFixed(2)}). Các thông số mâu thuẫn hoặc giá bán rẻ bất thường. Hãy cẩn thận bị lừa đảo hoặc mất thời gian với tin ảo!`
              : `AI xác nhận: Bất động sản này có mức giá và thông số kỹ thuật hợp lý với thị trường khu vực (Điểm an toàn: ${data.anomaly_score.toFixed(2)}).`
          };
        } catch (e) {
          console.error('[AI Tool] detectFakeListing error:', e);
          return { error: 'Hệ thống quét tin ảo đang bảo trì. Vui lòng thử lại sau.' };
        }
      },
    }),

    // ── 19. Smart Recommendations using KNN Vector Embeddings ────────────
    recommendSmartListings: tool({
      description: 'Gợi ý các bất động sản giống hệt căn user đang xem bằng mô hình AI KNN Vector (tìm theo DNA của BĐS). Gọi khi user yêu cầu "tìm căn tương tự căn này", "có căn nào giống thế này không", "gợi ý thêm nhà kiểu này".',
      inputSchema: z.object({
        property_type_name: z.enum(['Nhà', 'Căn hộ chung cư', 'Đất', 'Biệt thự, liền kề']).default('Nhà'),
        province_name: z.string(),
        district_name: z.string(),
        ward_name: z.string(),
        area: z.number(),
        price: z.number()
      }),
      execute: async (params) => {
        try {
          // 1. Get Similar IDs from KNN ML Model
          const res = await fetch(`${ML_API_URL}/recommend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
            signal: AbortSignal.timeout(5000),
          });
          if (!res.ok) throw new Error(`ML API error ${res.status}`);
          const mlData = await res.json();
          const similarIds = mlData.similar_ids;
          
          if (!similarIds || similarIds.length === 0) {
            return { message: 'Mô hình AI chưa tìm thấy căn nhà nào có DNA tương đồng 100% lúc này.' };
          }
          
          // 2. Fetch those exact IDs from Postgres
          const listings = (await sql`
            SELECT ${SAFE_COLS} FROM real_estates
            WHERE short_id IN ${sql(similarIds.map(String))} AND status >= 1`).map(safeListing);
            
          if (listings.length === 0) {
             return { message: 'Các căn nhà tương tự có thể đã giao dịch xong và bị gỡ khỏi hệ thống.' };
          }
          
          return {
            found: listings.length,
            ai_message: mlData.message,
            listings: listings.map(l => ({
              title: l.title,
              price: formatPrice(l.totalPrice || l.price || 0),
              area: l.area ? `${l.area}m2` : 'N/A',
              address: [l.address, l.adminunit?.ward, l.adminunit?.district].filter(Boolean).join(', '),
              link: buildLink(l, context?.filters),
            })),
          };
        } catch (e) {
          console.error('[AI Tool] recommendSmartListings error:', e);
          return { error: 'Hệ thống AI Gợi ý đang bận. Vui lòng thử lại sau.' };
        }
      },
    }),

    // ── 20. VN2000 Coordinate Converter & Parcel Location Finder ────────────
    locateVN2000Parcel: tool({
      description: 'Chuyển đổi bảng tọa độ VN2000 (trích xuất từ ảnh Sổ đỏ, trích đo địa chính, sơ đồ thửa đất) sang tọa độ WGS84 (Kinh độ, Vĩ độ) và tìm định vị thửa đất trên bản đồ nhadat.city. Gọi tool này ngay khi trích xuất được các điểm tọa độ X, Y VN2000.',
      inputSchema: z.object({
        points: z.array(z.object({
          pointId: z.union([z.string(), z.number()]).optional().describe('Tên/Số thứ tự điểm góc ranh (1, 2, 3...)'),
          x: z.number().describe('Tọa độ X VN2000 (Northing, ~1.000.000m - 2.300.000m)'),
          y: z.number().describe('Tọa độ Y VN2000 (Easting, ~300.000m - 700.000m)'),
        })).describe('Danh sách các điểm góc ranh thửa đất từ bảng tọa độ VN2000'),
        province: z.string().optional().describe('Tỉnh/Thành phố của thửa đất'),
        centralMeridian: z.number().optional().describe('Kinh tuyến trục 3° (nếu ghi rõ trên sơ đồ, ví dụ 105.0 hay 105.75)'),
        soTo: z.union([z.string(), z.number()]).optional().describe('Số tờ bản đồ'),
        soThua: z.union([z.string(), z.number()]).optional().describe('Số thửa đất'),
        dienTich: z.number().optional().describe('Diện tích thửa đất (m2)'),
      }),
      execute: async (params) => {
        try {
          if (!params.points || params.points.length === 0) {
            return { error: 'Không tìm thấy bảng tọa độ VN2000 hợp lệ.' };
          }

          const prov = params.province || context?.province || context?.locationName;
          const parsed = vn2000PolygonToWgs84(params.points, params.centralMeridian || prov);

          // Try querying GeoServer WFS at centroid to check matching parcel layer
          let matchedParcel: any = null;
          try {
            const baseWFS = `${GEOSERVER_URL}/ows?service=WFS&version=1.0.0&request=GetFeature&outputFormat=application%2Fjson&maxFeatures=1`;
            const deg = 0.0005; // ~50m search radius
            const bbox = [
              parsed.centroid.lng - deg, parsed.centroid.lat - deg,
              parsed.centroid.lng + deg, parsed.centroid.lat + deg
            ].join(',');
            const wfsUrl = `${baseWFS}&typeName=${GEOSERVER_PARCEL_LAYER}&bbox=${bbox},EPSG:4326`;

            const res = await fetch(wfsUrl, { signal: AbortSignal.timeout(4000) });
            if (res.ok) {
              const geojson = await res.json();
              if (geojson?.features?.length > 0) {
                const props = geojson.features[0].properties || {};
                matchedParcel = {
                  soTo: props.so_to || props.soTo,
                  soThua: props.so_thua || props.soThua,
                  dienTich: props.dien_tich || props.dienTich,
                  loaiDat: props.loai_dat || props.loaiDat,
                  address: props.address,
                };
              }
            }
          } catch (e) {
            // WFS match failure is non-blocking
          }

          return {
            success: true,
            province: prov || 'Tỉnh/Thành chưa xác định',
            centralMeridian: parsed.centralMeridian,
            soTo: params.soTo || matchedParcel?.soTo || 'N/A',
            soThua: params.soThua || matchedParcel?.soThua || 'N/A',
            dienTich: params.dienTich || matchedParcel?.dienTich || null,
            centroid: parsed.centroid,
            bbox: parsed.bbox,
            convertedPoints: parsed.points,
            geoJsonPolygon: parsed.geoJsonPolygon,
            matchedParcel,
            mapUrl: `https://nhadat.city/?lat=${parsed.centroid.lat}&lng=${parsed.centroid.lng}&zoom=19&poly=${encodeURIComponent(JSON.stringify(parsed.geoJsonPolygon.coordinates))}`,
            markdownLink: `[Xem & Đánh dấu thửa đất trên bản đồ](https://nhadat.city/?lat=${parsed.centroid.lat}&lng=${parsed.centroid.lng}&zoom=19&poly=${encodeURIComponent(JSON.stringify(parsed.geoJsonPolygon.coordinates))})`,
          };
        } catch (err: any) {
          console.error('[AI Tool] locateVN2000Parcel error:', err);
          return { error: `Lỗi chuyển đổi tọa độ VN2000: ${err?.message || err}` };
        }
      },
    }),
  };
}

