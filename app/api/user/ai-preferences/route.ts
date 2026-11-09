import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { sql } from '@/lib/db/pg';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userId = (session.user as any).id || session.user.email;

    const rows = await sql`SELECT preferences FROM user_ai_preferences WHERE user_key = ${userId} LIMIT 1`;

    return NextResponse.json({ success: true, data: rows[0]?.preferences || {} });
  } catch (error) {
    console.error('[API] GET ai-preferences error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { preferences } = body;
    const userId = (session.user as any).id || session.user.email;

    await sql`
      INSERT INTO user_ai_preferences (user_key, preferences, updated_at)
      VALUES (${userId}, ${sql.json(preferences ?? {})}, NOW())
      ON CONFLICT (user_key) DO UPDATE SET preferences = EXCLUDED.preferences, updated_at = NOW()`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] POST ai-preferences error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
