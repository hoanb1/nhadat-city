import { NextResponse } from 'next/server';
import { ML_API_URL } from '@/lib/config/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const response = await fetch(`${ML_API_URL}/detect_anomaly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      throw new Error(`ML Service responded with ${response.status}`);
    }
    
    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('ML API Error:', error);
    return NextResponse.json({ success: false, error: 'Hệ thống ML đang bận' }, { status: 500 });
  }
}
