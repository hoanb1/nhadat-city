import { NextRequest, NextResponse } from 'next/server';
import { getAggregatedMapClusters } from '@/lib/db/realEstate';
import type { RealEstateFilters, GeoPolygon } from '@/lib/db/realEstate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const limit = Math.min(parseInt(searchParams.get('limit') || '2000'), 5000);
    const province = searchParams.get('province') || undefined;
    const ward = searchParams.get('ward') || undefined;
    const district = searchParams.get('district') || undefined;
    const propertyType = searchParams.get('propertyType')?.split(',').filter(Boolean);
    const direction = searchParams.get('direction')?.split(',').filter(Boolean);
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const minArea = searchParams.get('minArea');
    const maxArea = searchParams.get('maxArea');
    const minPricePerM2 = searchParams.get('minPricePerM2');
    const maxPricePerM2 = searchParams.get('maxPricePerM2');
    const dateRange = searchParams.get('dateRange');

    const filters: RealEstateFilters = {};
    if (province) filters.province = province;
    if (ward) filters.ward = ward;
    if (district) filters.district = district;
    if (propertyType?.length) filters.propertyType = propertyType;
    if (direction?.length) filters.direction = direction;
    if (minPrice || maxPrice) {
      filters.totalPriceRange = [
        minPrice ? Number(minPrice) : null,
        maxPrice ? Number(maxPrice) : null,
      ];
    }
    if (minArea || maxArea) {
      filters.areaRange = [
        minArea ? Number(minArea) : null,
        maxArea ? Number(maxArea) : null,
      ];
    }
    if (minPricePerM2 || maxPricePerM2) {
      filters.pricePerM2Range = [
        minPricePerM2 ? Number(minPricePerM2) : null,
        maxPricePerM2 ? Number(maxPricePerM2) : null,
      ];
    }
    if (dateRange && dateRange !== 'all') {
      filters.dateRange = Number(dateRange);
    }

    // Optional polygon from body or query
    let polygon: GeoPolygon | null = null;
    const polygonParam = searchParams.get('polygon');
    if (polygonParam) {
      try {
        polygon = JSON.parse(decodeURIComponent(polygonParam));
      } catch {
        // ignore invalid polygon
      }
    }

    const items = await getAggregatedMapClusters(polygon, filters, limit);

    return NextResponse.json(
      { success: true, data: items, count: items.length },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('[API] /api/real-estate/map-clusters error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
