import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';

export const runtime = 'nodejs';

// GET /api/admin/ai-config — fetch current config
export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const [row] = await sql`SELECT value FROM app_config WHERE key = 'ai_config:router'`;
    const config = row ? { _id: 'router', ...(row.value as Record<string, any>) } : null;
    
    // If no config yet, return defaults that reflect the hardcoded priority
    const defaults = {
      providers: [
        { id: 'groq', name: 'Groq (llama-3.3-70b)', enabled: true, priority: 5, keyCount: 2 },
        { id: 'google', name: 'Gemini 2.0 Flash', enabled: true, priority: 10, keyCount: 6 },
        { id: 'mistral', name: 'Mistral Small', enabled: true, priority: 30, keyCount: 2 },
        { id: 'openrouter', name: 'OpenRouter (aggregator)', enabled: true, priority: 40, keyCount: 1 },
        { id: 'google_25', name: 'Gemini 2.5 Flash (paid)', enabled: true, priority: 50, keyCount: 6 },
      ],
      maxRetries: 3,
      sessionTimeoutMinutes: 30,
    };

    return NextResponse.json({ success: true, data: config || defaults });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST /api/admin/ai-config — save config
export async function POST(req: NextRequest) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const body = await req.json();
    const { _id, ...rest } = body || {};
    const value = { ...rest, updatedAt: new Date().toISOString() };

    await sql`
      INSERT INTO app_config (key, value, updated_at)
      VALUES ('ai_config:router', ${sql.json(value as any)}, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;

    return NextResponse.json({ success: true, message: 'Đã lưu cấu hình AI Router' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
