import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { idCond } from '@/lib/db/repo/adminCommon';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const resolvedParams = await params;
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'comment';
    const label = type === 'chat' ? 'tin nhắn' : 'bình luận';

    const rows = type === 'chat'
      ? await sql`DELETE FROM messages WHERE ${idCond(resolvedParams.id)} RETURNING id`
      : await sql`DELETE FROM re_comments WHERE ${idCond(resolvedParams.id)} RETURNING id`;

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: `Không tìm thấy ${label}` }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: `Đã xóa ${label}` });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
