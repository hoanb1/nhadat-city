import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { outRow } from '@/lib/db/repo/adminCommon';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';

export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const url = new URL(req.url);
    const viewMode = url.searchParams.get('view') || 'logs'; // 'logs' | 'sessions'

    const rows = await sql`SELECT * FROM ai_logs ORDER BY created_at DESC LIMIT 200`;
    const logs = rows.map((r) => outRow(r));

    const [agg] = await sql`SELECT count(*)::float8 AS total_requests, COALESCE(sum(tokens_used), 0)::float8 AS total_tokens FROM ai_logs`;

    const stats = {
      totalRequests: Number(agg?.total_requests ?? 0),
      totalTokens: Number(agg?.total_tokens ?? 0),
    };

    if (viewMode === 'sessions') {
      // Group logs by sessionId; logs without sessionId get their own entry
      const sessionMap = new Map<string, any>();

      for (const log of logs) {
        const key = log.sessionId || `solo_${log._id}`;
        if (!sessionMap.has(key)) {
          sessionMap.set(key, {
            sessionId: log.sessionId || null,
            firstAt: log.createdAt,
            lastAt: log.createdAt,
            totalTokens: 0,
            requestCount: 0,
            models: new Set<string>(),
            logs: []
          });
        }
        const s = sessionMap.get(key)!;
        s.totalTokens += log.tokensUsed || 0;
        s.requestCount++;
        s.models.add(log.model);
        if (new Date(log.createdAt) > new Date(s.lastAt)) s.lastAt = log.createdAt;
        s.logs.push(log);
      }

      const sessions = Array.from(sessionMap.values()).map(s => ({
        ...s,
        models: Array.from(s.models)
      }));

      return NextResponse.json({ success: true, data: { sessions, stats } });
    }

    return NextResponse.json({ success: true, data: { logs, stats } });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const body = await req.json();
    const { action } = body;

    // This could be used to clear logs, update AI limits, etc.
    if (action === 'clear') {
      await sql`DELETE FROM ai_logs`;
      return NextResponse.json({ success: true, message: 'Đã xóa lịch sử AI' });
    }

    return NextResponse.json({ success: false, message: 'Action không hợp lệ' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
