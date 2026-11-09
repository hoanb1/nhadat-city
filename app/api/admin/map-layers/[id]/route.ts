import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { layerCols } from '@/lib/db/repo/adminMapLayers';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await req.json();
    const { cols, rest } = layerCols(body);
    const colNames = Object.keys(cols);

    const rows = await sql`
      UPDATE planning_layers SET
        ${colNames.length > 0 ? sql`${sql(cols, ...colNames)},` : sql``}
        extra = extra || ${sql.json(rest as any)},
        updated_at = now()
      WHERE id = ${id} OR mongo_id = ${id}
      RETURNING id`;

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy lớp bản đồ' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Cập nhật thành công' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const { id } = await params;
    const rows = await sql`DELETE FROM planning_layers WHERE id = ${id} OR mongo_id = ${id} RETURNING id`;

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy lớp bản đồ' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Xóa thành công' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
