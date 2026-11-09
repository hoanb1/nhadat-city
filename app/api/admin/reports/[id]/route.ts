import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { idCond } from '@/lib/db/repo/adminCommon';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const resolvedParams = await params;
    const { reviewed } = await req.json();

    const rows = await sql`
      UPDATE reports SET reviewed = ${!!reviewed}, updated_at = now()
      WHERE ${idCond(resolvedParams.id)}
      RETURNING id`;

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy báo cáo' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Cập nhật trạng thái báo cáo thành công' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
