import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { idCond } from '@/lib/db/repo/adminCommon';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const { id } = await params;
    await sql`DELETE FROM help_requests WHERE ${idCond(id)}`;
    return NextResponse.json({ success: true, message: 'Xóa thành công' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
