import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { sql } from '@/lib/db/pg';
import { findUserById } from '@/lib/db/repo/userRepo';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, phone, notifications } = body;

    const userId = (session.user as any).id;

    const user = await findUserById(String(userId));
    if (!user) {
      return NextResponse.json({ error: 'Không tìm thấy tài khoản' }, { status: 404 });
    }

    const profilePatch: Record<string, any> = {};
    const extraPatch: Record<string, any> = {};
    let newName: string | null = null;
    let newPhone: string | null = null;

    if (typeof name === 'string' && name.trim()) {
      newName = name.trim();
      profilePatch.name = newName;
    }
    if (typeof phone === 'string') {
      newPhone = phone.trim();
      profilePatch.phone = newPhone;
    }
    if (notifications && typeof notifications === 'object') {
      extraPatch.notifications = notifications;
    }

    await sql`
      UPDATE users SET
        name = COALESCE(${newName}, name),
        phone = COALESCE(${newPhone}, phone),
        profile = profile || ${sql.json(profilePatch)},
        extra = extra || ${sql.json(extraPatch)},
        updated_at = NOW()
      WHERE id = ${user.id}`;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API] update user error:', err);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}
