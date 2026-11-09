import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { outRow } from '@/lib/db/repo/adminCommon';

export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const rows = await sql`SELECT * FROM help_requests ORDER BY created_at DESC`;
    // requester jsonb = Mongo `user` {id,name}
    const data = rows.map((r) => {
      const o = outRow(r, ['requester']);
      if (r.requester && Object.keys(r.requester).length > 0) o.user = r.requester;
      return o;
    });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
