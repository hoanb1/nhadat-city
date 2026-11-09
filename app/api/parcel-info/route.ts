// app/api/parcel-info/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminUnitByCoords } from '@/lib/geo/parcelAdminUnit';
import { getLandTypeName } from '@/lib/geo/landTypeLabels';
import { GEOSERVER_URL, GEOSERVER_PARCEL_LAYER } from '@/lib/config/server';
import { obfuscateParcelId } from '@/lib/utils/idObfuscator';
import {
  checkRateLimit,
  getClientIp,
  isAllowedOrigin,
  rateLimitHeaders,
} from '@/lib/middleware/rateLimiter';

export const runtime = 'nodejs';

const PARCEL_LAYERS = [GEOSERVER_PARCEL_LAYER];

/** Point-BBOX size in degrees (~1 cm) for exact intersection queries. */
const POINT_DELTA = 0.0000001;

/** Domains allowed to call this API. */
const ALLOWED_DOMAINS = ['nhadat.city', 'localhost', '127.0.0.1'];

/** Strict rate limit: 15 requests/minute per IP (normal user clicks ~2-5 parcels/min). */
const PARCEL_RATE_LIMIT = { maxRequests: 15, windowMs: 60_000 };

export async function GET(request: NextRequest) {
  // ── 1. Origin check ────────────────────────────────────────────────────
  if (!isAllowedOrigin(request, ALLOWED_DOMAINS)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── 2. Rate limit ─────────────────────────────────────────────────────
  const clientIp = getClientIp(request);
  const rl = checkRateLimit(clientIp, 'parcel-info', PARCEL_RATE_LIMIT);

  if (!rl.allowed) {
    console.warn(`[ParcelInfo] Rate limit hit: ip=${clientIp}, current=${rl.current}`);
    return NextResponse.json(
      { error: 'Too many requests. Please wait and try again.' },
      {
        status: 429,
        headers: rateLimitHeaders(rl, PARCEL_RATE_LIMIT.windowMs),
      }
    );
  }

  // ── 3. Validate params ────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const lng = parseFloat(searchParams.get('lng') || '');
  const lat = parseFloat(searchParams.get('lat') || '');

  if (isNaN(lng) || isNaN(lat)) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }

  // Sanity check: coordinates must be within Vietnam's bounding box
  if (lng < 102 || lng > 110 || lat < 8 || lat > 24) {
    return NextResponse.json({ error: 'Coordinates out of range' }, { status: 400 });
  }

  // ── 4. Query GeoServer ────────────────────────────────────────────────
  for (const layer of PARCEL_LAYERS) {
    try {
      const bbox = `${lng - POINT_DELTA},${lat - POINT_DELTA},${lng + POINT_DELTA},${lat + POINT_DELTA},EPSG:4326`;
      const url =
        `${GEOSERVER_URL}/wfs?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature` +
        `&TYPENAME=${encodeURIComponent(layer)}&OUTPUTFORMAT=application/json` +
        `&BBOX=${bbox}&MAXFEATURES=1`;

      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;

      const data = await res.json();
      if (!data?.features?.length) continue;

      const feat  = data.features[0];
      const props = feat.properties;

      const loaiDatCode = props.loai_dat || '';
      const adminUnit   = await getAdminUnitByCoords(lng, lat);

      return NextResponse.json({
        success: true,
        data: {
          soTo:         props.so_to,
          soThua:       props.so_thua,
          dienTich:     props.dien_tich ? Number(props.dien_tich) : null,
          loaiDat:      loaiDatCode,
          loaiDatName:  getLandTypeName(loaiDatCode),
          maXa:         props.ma_xa || '',
          thuaId:       obfuscateParcelId(props.uuid || props.thua_id || feat.id),
          layer,
          geometry:     feat.geometry,
          address:      adminUnit?.address      || '',
          wardName:     adminUnit?.wardName      || '',
          districtName: adminUnit?.districtName  || '',
          provinceName: adminUnit?.provinceName  || '',
          provinceSlug: adminUnit?.provinceSlug  || '',
          wardSlug:     adminUnit?.wardSlug      || '',
        },
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ success: false, data: null });
}
