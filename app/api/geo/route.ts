import { NextRequest, NextResponse } from 'next/server';
import { fetchGeoFeatures } from '@/lib/geo/geoService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const province = searchParams.get('province');
    const ward = searchParams.get('ward') || undefined;

    if (!province) {
      return NextResponse.json({ success: false, error: 'province is required' }, { status: 400 });
    }

    const features = await fetchGeoFeatures(province, ward);

    if (!features || features.features.length === 0) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(features, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[API] /api/geo error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
