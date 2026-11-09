import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { mapRealEstateRow } from '@/lib/db/realEstate';
import { escapeLike } from '@/lib/db/pgUtil';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '6'), 10);

    if (!q || q.length < 2) {
      return NextResponse.json({ success: true, data: [] });
    }

    const cols = sql`id, mongo_id, title, total_price, area, address, images[1:1] AS images,
      province_slug, district_slug, ward_slug, longitude, latitude, property_type`;
    let rows;
    if (q.length >= 3) {
      rows = await sql`SELECT ${cols} FROM real_estates
        WHERE status >= 1 AND search_tsv @@ websearch_to_tsquery('simple', f_unaccent(${q}))
        ORDER BY ts_rank(search_tsv, websearch_to_tsquery('simple', f_unaccent(${q}))) DESC, created_at DESC
        LIMIT ${limit}`;
    } else {
      const like = `%${escapeLike(q)}%`;
      rows = await sql`SELECT ${cols} FROM real_estates
        WHERE status >= 1 AND f_unaccent(title) ILIKE f_unaccent(${like})
        ORDER BY created_at DESC LIMIT ${limit}`;
    }
    const items = rows.map(mapRealEstateRow);

    return NextResponse.json(
      { success: true, data: items },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  } catch (error) {
    console.error('[API] /api/real-estate/search error:', error);
    return NextResponse.json({ success: false, data: [] });
  }
}
