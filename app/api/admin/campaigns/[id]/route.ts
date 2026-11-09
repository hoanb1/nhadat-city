import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { dateOnly, idCond, splitBody } from '@/lib/db/repo/adminCommon';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await req.json();
    const { cols, rest } = splitBody(body, {
      name: 'name', location: 'location', description: 'description',
      startDate: 'start_date', endDate: 'end_date', status: 'status',
    });
    if ('start_date' in cols) cols.start_date = dateOnly(cols.start_date);
    if ('end_date' in cols) cols.end_date = dateOnly(cols.end_date);
    const colNames = Object.keys(cols);
    const hasRest = Object.keys(rest).length > 0;

    if (colNames.length > 0 || hasRest) {
      await sql`
        UPDATE campaigns SET
          ${colNames.length > 0 ? sql`${sql(cols, ...colNames)},` : sql``}
          extra = extra || ${sql.json(rest as any)}
        WHERE ${idCond(id)}`;
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
    await sql`DELETE FROM campaigns WHERE ${idCond(id)}`;
    return NextResponse.json({ success: true, message: 'Xóa thành công' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
