import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { kindOf } from '@/lib/db/repo/adminMasterData';

export async function PUT(req: Request, { params }: { params: Promise<{ collection: string, id: string }> }) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  const { collection, id } = await params;
  const kind = kindOf(collection);
  if (!kind) {
    return NextResponse.json({ success: false, message: 'Invalid collection' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { _id, name, order, description, type, fields, ...rest } = body || {};

    const set: Record<string, any> = {};
    if (name !== undefined) set.name = name == null ? '' : String(name);
    if (order !== undefined && Number.isFinite(Number(order))) set.sort_order = Math.round(Number(order));
    if (description !== undefined) set.description = description;
    if (type !== undefined) set.type = type;
    if (fields !== undefined) set.fields = sql.json((Array.isArray(fields) ? fields : []) as any);
    const setNames = Object.keys(set);

    await sql`
      UPDATE master_data SET
        ${setNames.length > 0 ? sql`${sql(set, ...setNames)},` : sql``}
        extra = extra || ${sql.json(rest as any)}
      WHERE kind = ${kind} AND mongo_id = ${id}`;

    return NextResponse.json({ success: true, message: 'Cập nhật thành công' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ collection: string, id: string }> }) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  const { collection, id } = await params;
  const kind = kindOf(collection);
  if (!kind) {
    return NextResponse.json({ success: false, message: 'Invalid collection' }, { status: 400 });
  }

  try {
    await sql`DELETE FROM master_data WHERE kind = ${kind} AND mongo_id = ${id}`;
    return NextResponse.json({ success: true, message: 'Xóa thành công' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
