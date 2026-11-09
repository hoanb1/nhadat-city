import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { and } from '@/lib/db/pgUtil';
import { LOG_SUCCESS, indexingLogOut } from '@/lib/db/repo/adminIndexing';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50') || 50));
    const provider = searchParams.get('provider');
    const successParam = searchParams.get('success');

    const conds = [];
    if (provider && provider !== 'all') {
      conds.push(sql`provider = ${provider}`);
    }
    if (successParam !== null && successParam !== undefined && successParam !== '') {
      conds.push(successParam === 'true' ? sql`(${LOG_SUCCESS()}) IS TRUE` : sql`(${LOG_SUCCESS()}) IS NOT TRUE`);
    }
    const where = and(conds);

    const skip = (page - 1) * limit;

    const [rows, [cnt]] = await Promise.all([
      sql`
        SELECT *, ${LOG_SUCCESS()} AS success
        FROM indexing_logs WHERE ${where}
        ORDER BY created_at DESC
        OFFSET ${skip} LIMIT ${limit}`,
      sql`SELECT count(*)::int AS n FROM indexing_logs WHERE ${where}`,
    ]);
    const total: number = cnt.n;

    return NextResponse.json({
      success: true,
      data: {
        logs: rows.map(indexingLogOut),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    console.error('[AdminIndexing:Logs Error]', error?.message || error);
    return NextResponse.json({ success: false, message: error?.message || 'Lỗi server' }, { status: 500 });
  }
}
