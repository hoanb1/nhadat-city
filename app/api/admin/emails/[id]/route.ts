import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { idCond } from '@/lib/db/repo/adminCommon';
import { emailOut } from '@/lib/db/repo/adminEmails';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const { id } = await context.params;

    const [email] = await sql`SELECT * FROM emails WHERE ${idCond(id)} LIMIT 1`;
    if (!email) {
      return NextResponse.json({ success: false, message: 'Email not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: emailOut(email) });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
