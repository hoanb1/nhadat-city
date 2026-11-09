import { NextRequest, NextResponse } from 'next/server';
import { mapProxyService } from '@/lib/map/mapProxyService';
import { cacheManager } from '@/lib/utils/cacheManager';
import { sql } from '@/lib/db/pg';
import {
  isAllowedOrigin,
} from '@/lib/middleware/rateLimiter';
import { validateMapToken } from '@/lib/middleware/mapToken';
import { TOKEN_REQUIRED_LAYERS, RASTER_ONLY_LAYERS } from '@/lib/config/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Anti-scraping config ─────────────────────────────────────────────────────

const ALLOWED_DOMAINS = ['nhadat.city', 'localhost', '127.0.0.1'];

// NOTE: Tile rate limiting is intentionally DISABLED for this endpoint.
// Real users generate 1000+ tiles/min browsing across basemap + parcel +
// planning layers. Protection is via: Bearer auth, origin check, raster-only.
// Rate limiting is kept on parcel-info API (individual queries) where it's effective.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
};

function response204() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ layer: string; z: string; x: string; y: string }> }
) {
  try {
    const params = await context.params;
    const { layer, z, x } = params;
    let { y } = params;

    // ── 1. Origin / Referer check ──────────────────────────────────────────
    if (!isAllowedOrigin(request, ALLOWED_DOMAINS)) {
      return new NextResponse('Forbidden', { status: 403, headers: CORS_HEADERS });
    }

    // ── 3. Parse URL ───────────────────────────────────────────────────────
    const match = y.match(/^(\d+)\.(png|webp|pbf)$/);
    if (!match) {
      return new NextResponse('Invalid URL format', { status: 400, headers: CORS_HEADERS });
    }

    const yVal = parseInt(match[1], 10);
    let format = match[2];
    const zVal = parseInt(z, 10);
    const xVal = parseInt(x, 10);

    // ── 4. Resolve GeoServer layer metadata ────────────────────────────────
    let cachedMeta = await cacheManager.getCache<{
      geoServerLayer: string;
      zoomMin: number;
      zoomMax: number;
      boundingBox?: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
      };
    }>(`layer_meta:${layer}`);

    if (!cachedMeta) {
      const rows = await sql`
        SELECT geoserver_layer, min_zoom, max_zoom, bbox FROM planning_layers
        WHERE mongo_id = ${layer} AND active IS TRUE LIMIT 1`;
      const mapLayer = rows[0];

      if (!mapLayer || !mapLayer.geoserver_layer) {
        return new NextResponse('Layer not found or inactive', { 
          status: 404, 
          headers: CORS_HEADERS 
        });
      }

      const bb = mapLayer.bbox && typeof mapLayer.bbox === 'object' && 'minX' in mapLayer.bbox ? mapLayer.bbox : undefined;
      cachedMeta = {
        geoServerLayer: mapLayer.geoserver_layer,
        zoomMin: mapLayer.min_zoom != null ? Number(mapLayer.min_zoom) : 0,
        zoomMax: mapLayer.max_zoom != null ? Number(mapLayer.max_zoom) : 24,
        boundingBox: bb
      };
      await cacheManager.setCache(`layer_meta:${layer}`, cachedMeta, 900);
    }

    const { geoServerLayer, zoomMin, zoomMax } = cachedMeta;

    // ── 4b. Enforce zoom boundaries to prevent low-zoom scraping ────────────
    if (zVal < zoomMin || zVal > zoomMax) {
      return response204();
    }

    // ── 4c. Enforce bounding box boundary checks ───────────────────────────
    if (cachedMeta.boundingBox) {
      const { minX, minY, maxX, maxY } = cachedMeta.boundingBox;
      
      const n = Math.pow(2, zVal);
      const tileMinLng = (xVal / n) * 360 - 180;
      const tileMaxLng = ((xVal + 1) / n) * 360 - 180;
      
      const latRadMin = Math.atan(Math.sinh(Math.PI * (1 - 2 * (yVal + 1) / n)));
      const tileMinLat = latRadMin * 180 / Math.PI;
      
      const latRadMax = Math.atan(Math.sinh(Math.PI * (1 - 2 * yVal / n)));
      const tileMaxLat = latRadMax * 180 / Math.PI;

      const overlaps = (
        tileMinLng <= maxX &&
        tileMaxLng >= minX &&
        tileMinLat <= maxY &&
        tileMaxLat >= minY
      );

      if (!overlaps) {
        return response204();
      }
    }

    // ── 5. Token validation for sensitive layers ───────────────────────────
    if (TOKEN_REQUIRED_LAYERS.includes(layer)) {
      const authHeader = request.headers.get('authorization') || '';
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : '';
      const tokenError = validateMapToken(token);
      if (tokenError) {
        return new NextResponse(`Unauthorized: ${tokenError}`, { status: 401, headers: CORS_HEADERS });
      }
    }

    // ── 6. Block PBF requests for raster-only layers ─────────────────────────
    if (RASTER_ONLY_LAYERS.includes(layer) && format === 'pbf') {
      return new NextResponse('Vector format (PBF) is not allowed for this layer', { 
        status: 403, 
        headers: CORS_HEADERS 
      });
    }

    // Serve the format requested in the URL extension strictly to align with CDN caching.
    let targetFormat = format;

    // ── 7. Cache check ─────────────────────────────────────────────────────
    const cacheKey = `geomap:${layer}:${zVal}:${xVal}:${yVal}:${targetFormat}`;
    const cachedTile = await cacheManager.getBufferCache(cacheKey);

    if (cachedTile) {
      const contentType = targetFormat === 'pbf'
        ? 'application/vnd.mapbox-vector-tile'
        : `image/${targetFormat}`;
      return new NextResponse(cachedTile as any, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // ── 8. Fetch from GeoServer ────────────────────────────────────────────
    const tileData = await mapProxyService.fetchWMSTile(geoServerLayer!, zVal, xVal, yVal, targetFormat);

    if (!tileData || tileData.length < 100) {
      return response204();
    }

    // ── 9. Cache & respond ─────────────────────────────────────────────────
    await cacheManager.setBufferCache(cacheKey, tileData);

    const contentType = targetFormat === 'pbf'
      ? 'application/vnd.mapbox-vector-tile'
      : `image/${targetFormat}`;

    return new NextResponse(tileData as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error(`[MapProxy] error:`, error);
    return new NextResponse('Internal server error', { status: 500, headers: CORS_HEADERS });
  }
}

export async function OPTIONS(request: NextRequest) {
  if (!isAllowedOrigin(request, ALLOWED_DOMAINS)) {
    return new NextResponse(null, { status: 403, headers: CORS_HEADERS });
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
