import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { kindOf, masterOut } from '@/lib/db/repo/adminMasterData';

export async function GET(req: Request, { params }: { params: Promise<{ collection: string }> }) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  const { collection } = await params;
  const kind = kindOf(collection);
  if (!kind) {
    return NextResponse.json({ success: false, message: 'Invalid collection' }, { status: 400 });
  }

  try {
    const rows = await sql`SELECT * FROM master_data WHERE kind = ${kind} ORDER BY sort_order ASC, id ASC`;
    return NextResponse.json(rows.map(masterOut));
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ collection: string }> }) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  const { collection } = await params;
  const kind = kindOf(collection);
  if (!kind) {
    return NextResponse.json({ success: false, message: 'Invalid collection' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { _id, name, order, description, type, fields, ...rest } = body || {};

    // master_data.mongo_id is the stable code used by listings; generate one when not supplied
    const code = _id ? String(_id) : randomUUID().replace(/-/g, '').slice(0, 24);
    const sortOrder = Number.isFinite(Number(order)) ? Math.round(Number(order)) : 0;

    await sql`
      INSERT INTO master_data (kind, mongo_id, name, description, sort_order, type, fields, extra)
      VALUES (${kind}, ${code}, ${name == null ? '' : String(name)}, ${description ?? null}, ${sortOrder},
              ${type ?? null}, ${sql.json((Array.isArray(fields) ? fields : []) as any)}, ${sql.json(rest as any)})`;

    return NextResponse.json({ success: true, message: 'Thêm mới thành công', data: { ...body, _id: code } });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
