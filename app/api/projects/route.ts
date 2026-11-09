import { NextRequest, NextResponse } from 'next/server';
import { searchProjects } from '@/lib/db/project';
import type { ProjectFilters } from '@/lib/db/project';
import type { GeoPolygon } from '@/lib/db/realEstate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const query = searchParams.get('q') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const province = searchParams.get('province') || undefined;
    const district = searchParams.get('district') || undefined;
    const ward = searchParams.get('ward') || undefined;
    
    // Status filters
    const statusParam = searchParams.get('status');
    let status: number[] | undefined;
    if (statusParam) {
      status = statusParam.split(',').map(Number).filter(n => !isNaN(n));
    }

    const filters: ProjectFilters = {};
    if (province) filters.province = province;
    if (district) filters.district = district;
    if (ward) filters.ward = ward;
    if (status) filters.status = status;

    // Optional polygon from query
    let polygon: GeoPolygon | null = null;
    const polygonParam = searchParams.get('polygon');
    if (polygonParam) {
      try {
        polygon = JSON.parse(decodeURIComponent(polygonParam));
      } catch {
        // ignore invalid
      }
    }

    const items = await searchProjects(query, filters, polygon, limit, offset);

    return NextResponse.json(
      { success: true, data: items, count: items.length },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    );
  } catch (error) {
    console.error('[API] /api/projects error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
