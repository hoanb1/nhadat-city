import { NextRequest, NextResponse } from 'next/server';
import { GEOSERVER_URL, GEOSERVER_PARCEL_LAYER } from '@/lib/config/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bbox = searchParams.get('bbox');
    
    if (!bbox) {
      return new NextResponse('Missing bbox parameter', { status: 400 });
    }

    // Build the query string for GeoServer internally to hide configuration from the client
    const targetUrl = new URL(`${GEOSERVER_URL}/wms`);
    targetUrl.searchParams.set('service', 'WMS');
    targetUrl.searchParams.set('version', '1.1.1');
    targetUrl.searchParams.set('request', 'GetMap');
    targetUrl.searchParams.set('layers', GEOSERVER_PARCEL_LAYER);
    targetUrl.searchParams.set('styles', '');
    targetUrl.searchParams.set('format', 'image/png');
    targetUrl.searchParams.set('transparent', 'true');
    targetUrl.searchParams.set('srs', 'EPSG:3857');
    targetUrl.searchParams.set('bbox', bbox);
    targetUrl.searchParams.set('width', '256');
    targetUrl.searchParams.set('height', '256');

    const res = await fetch(targetUrl.toString(), {
      headers: {
        'Accept': request.headers.get('Accept') || 'image/png,image/*',
      },
      // Timeout for tile fetching
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) {
      return new NextResponse(`GeoServer Error: ${res.status}`, { status: res.status });
    }

    const headers = new Headers();
    headers.set('Content-Type', res.headers.get('Content-Type') || 'image/png');
    headers.set('Cache-Control', 'public, max-age=86400'); // Cache tiles for 1 day
    headers.set('Access-Control-Allow-Origin', '*');

    // Return the binary stream
    return new NextResponse(res.body, {
      status: 200,
      headers
    });
  } catch (error) {
    return new NextResponse('WMS Proxy Error', { status: 500 });
  }
}
