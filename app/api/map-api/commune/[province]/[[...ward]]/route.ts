import { NextRequest, NextResponse } from 'next/server';
import { mapProxyService } from '@/lib/map/mapProxyService';
import { cacheManager } from '@/lib/utils/cacheManager';
import { getProvinceInfo, getWardInfo } from '@/lib/geo/geoService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getBBoxFromCoordinates(coordinates: any[], paddingPercent = 0.02) {
  const lons: number[] = [];
  const lats: number[] = [];

  const extract = (coords: any[]) => {
    if (typeof coords[0] === 'number') {
      lons.push(coords[0]);
      lats.push(coords[1]);
    } else {
      coords.forEach(extract);
    }
  };
  extract(coordinates);

  let minLon = Math.min(...lons);
  let maxLon = Math.max(...lons);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);

  const lonPadding = (maxLon - minLon) * paddingPercent;
  const latPadding = (maxLat - minLat) * paddingPercent;

  return [
    minLon - lonPadding,
    minLat - latPadding,
    maxLon + lonPadding,
    maxLat + latPadding
  ];
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ province: string; ward?: string[] }> }
) {
  try {
    const params = await context.params;
    let provinceCodeName = params.province;
    let wardCodeName = params.ward?.[0];
    let format = 'png';

    // Parse extension from ward or province
    if (wardCodeName) {
      const match = wardCodeName.match(/^(.+)\.(png|webp)$/);
      if (match) {
        wardCodeName = match[1];
        format = match[2];
      }
    } else {
      const match = provinceCodeName.match(/^(.+)\.(png|webp)$/);
      if (match) {
        provinceCodeName = match[1];
        format = match[2];
      }
    }

    const { searchParams } = new URL(request.url);
    const width = parseInt(searchParams.get('width') || '768', 10);
    const height = parseInt(searchParams.get('height') || '768', 10);

    if (isNaN(width) || isNaN(height) || width < 100 || width > 2048 || height < 100 || height > 2048) {
      return new NextResponse('Invalid width or height', { status: 400 });
    }

    let layer = '';
    let cqlFilter = '';
    let maCode = '';
    let geoCoords: any[] = [];

    if (wardCodeName) {
      const wardInfo = await getWardInfo(wardCodeName, provinceCodeName);
      if (!wardInfo || !wardInfo.maXa) {
        return new NextResponse('Ward not found', { status: 404 });
      }
      maCode = wardInfo.maXa;
      layer = 'adminunit:communes2025fixed';
      cqlFilter = `maXa='${maCode}'`;
      geoCoords = wardInfo.Location?.coordinates || [];
    } else {
      const provinceInfo = await getProvinceInfo(provinceCodeName);
      if (!provinceInfo || !provinceInfo.maTinh) {
        return new NextResponse('Province not found', { status: 404 });
      }
      maCode = provinceInfo.maTinh;
      layer = 'adminunit:provinces20251fixed';
      cqlFilter = `maTinh='${maCode}'`;
      geoCoords = provinceInfo.Location?.coordinates || [];
    }

    const cacheKey = `map:${layer}:${maCode}:${width}x${height}:${format}`;
    const cachedImage = await cacheManager.getBufferCache(cacheKey);

    if (cachedImage) {
      return new NextResponse(cachedImage as any, {
        status: 200,
        headers: {
          'Content-Type': `image/${format}`,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Default bbox fallback if no coords
    let bbox = [102.14, 8.56, 109.46, 23.39]; // Vietnam bbox
    if (geoCoords.length > 0) {
      bbox = getBBoxFromCoordinates(geoCoords);
    }

    let imageBuffer = await mapProxyService.fetchWMSImage({
      layer,
      bbox,
      width,
      height,
      format: 'png',
      cqlFilter
    });

    if (!imageBuffer || imageBuffer.length < 100) {
      return new NextResponse(null, { status: 204 });
    }

    let finalFormat = format;
    if (format === 'webp') {
      const converted = await mapProxyService.convertToWebP(imageBuffer, 80);
      if (converted && converted.length > 0) {
        imageBuffer = converted;
      } else {
        finalFormat = 'png';
      }
    }

    await cacheManager.setBufferCache(cacheKey, imageBuffer);

    return new NextResponse(imageBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': `image/${finalFormat}`,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error(`Map commune proxy error:`, error);
    return new NextResponse('Internal server error', { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
