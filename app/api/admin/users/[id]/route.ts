import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { idCond } from '@/lib/db/repo/adminCommon';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const resolvedParams = await params;
    const body = await req.json();
    const { name, role, password } = body;

    const sets = [];

    if (name !== undefined) {
      sets.push(sql`name = ${name == null ? null : String(name)}`);
    }

    if (role !== undefined) {
      if (role === 'admin') {
        sets.push(sql`roles = CASE WHEN 'admin' = ANY(roles) THEN roles ELSE array_append(roles, 'admin') END`);
      } else {
        sets.push(sql`roles = array_remove(roles, 'admin')`);
      }
    }

    if (password) {
      const sha256Password = crypto.createHash("sha256").update(password).digest("hex");
      const hash = bcrypt.hashSync(sha256Password, 10);
      sets.push(sql`password_hash = ${hash}`);
    }

    if (sets.length === 0) {
      return NextResponse.json({ success: true, message: 'Không có thay đổi' });
    }

    const setClause = sets.reduce((acc, s, i) => (i === 0 ? s : sql`${acc}, ${s}`));
    const rows = await sql`
      UPDATE users SET ${setClause}, updated_at = now()
      WHERE ${idCond(resolvedParams.id)}
      RETURNING id`;

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy user' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Cập nhật thành công' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const resolvedParams = await params;

    // Ban the user by adding a banned flag instead of hard delete,
    // to preserve relations in the database. Remove admin if banned.
    const rows = await sql`
      UPDATE users SET
        profile = profile || '{"banned": true}'::jsonb,
        roles = array_remove(roles, 'admin'),
        updated_at = now()
      WHERE ${idCond(resolvedParams.id)}
      RETURNING id`;

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy user' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Đã vô hiệu hóa tài khoản' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
