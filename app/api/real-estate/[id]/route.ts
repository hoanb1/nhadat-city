import { NextRequest, NextResponse } from 'next/server';
import { getRealEstateById, getProjectById } from '@/lib/db/realEstate';

export const runtime = 'nodejs';
export const revalidate = 3600; // Cache 1 hour

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
    }

    let item = await getRealEstateById(id);

    // Fallback: If not found in realEstate, try fetching from projects
    if (!item) {
      const project = await getProjectById(id);
      if (project) {
        return NextResponse.json(
          { success: true, data: project },
          {
            headers: {
              'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
          }
        );
      }
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(
      { success: true, data: item },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    console.error('[API] /api/real-estate/[id] error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
