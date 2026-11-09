import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { mapRealEstateRow } from '@/lib/db/realEstate';
import { ML_API_URL } from '@/lib/config/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 1. Get Similar IDs from KNN ML Model
    const mlResponse = await fetch(`${ML_API_URL}/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    
    if (!mlResponse.ok) {
      throw new Error(`ML Service responded with ${mlResponse.status}`);
    }
    
    const mlData = await mlResponse.json();
    const similarIds = mlData.similar_ids;
    
    if (!similarIds || similarIds.length === 0) {
      return NextResponse.json({ success: true, listings: [], message: mlData.message });
    }
    
    // 2. Fetch those exact IDs from Postgres
    const rows = await sql`
      SELECT * FROM real_estates
      WHERE short_id IN ${sql((similarIds as unknown[]).map(String))} AND status >= 1`;
    const listings = rows.map(mapRealEstateRow);

    return NextResponse.json({ 
      success: true, 
      listings,
      message: mlData.message 
    });
  } catch (error: any) {
    console.error('ML API Error:', error);
    return NextResponse.json({ success: false, error: 'Hệ thống ML đang bận' }, { status: 500 });
  }
}
