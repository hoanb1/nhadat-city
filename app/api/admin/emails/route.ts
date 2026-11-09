import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { pageParams } from '@/lib/db/repo/adminCommon';
import { emailOut } from '@/lib/db/repo/adminEmails';

export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const url = new URL(req.url);
    const folder = url.searchParams.get('folder') || 'inbox';
    const { page, limit, offset } = pageParams(url.searchParams, 50);

    const [rows, [cnt]] = await Promise.all([
      // Exclude bodies in list view for performance
      sql`
        SELECT id, mongo_id, folder, uid, message_id, subject, from_addrs, to_addrs, date, synced_at, extra
        FROM emails WHERE folder = ${folder}
        ORDER BY date DESC NULLS LAST
        OFFSET ${offset} LIMIT ${limit}`,
      sql`SELECT count(*)::int AS n FROM emails WHERE folder = ${folder}`,
    ]);

    return NextResponse.json({ success: true, data: { emails: rows.map(emailOut), total: cnt.n, page, limit } });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
