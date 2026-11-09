import { NextRequest, NextResponse } from 'next/server';
import { getSimilarRealEstates } from '@/lib/db/realEstate';

export const runtime = 'nodejs';
export const revalidate = 1800;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '12'), 24);

    const results = await getSimilarRealEstates(id, undefined, limit);

    return NextResponse.json(
      { success: true, data: results },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=7200' } }
    );
  } catch (error) {
    console.error('[API] similar error:', error);
    return NextResponse.json({ success: false, data: [] });
  }
}

