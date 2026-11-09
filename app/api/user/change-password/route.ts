import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { findUserById, verifyPassword, hashPassword, setPasswordHash } from '@/lib/db/repo/userRepo';

export const runtime = 'nodejs';

// POST /api/user/change-password
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: 'Mật khẩu mới phải ít nhất 6 ký tự' }, { status: 400 });
  }

  const userId = (session.user as any).id;
  const user = await findUserById(String(userId));

  if (!user) return NextResponse.json({ error: 'Không tìm thấy tài khoản' }, { status: 404 });

  // If user has existing password, verify current one
  if (user.password_hash) {
    if (!currentPassword) {
      return NextResponse.json({ error: 'Vui lòng nhập mật khẩu hiện tại' }, { status: 400 });
    }
    if (!verifyPassword(currentPassword, user.password_hash)) {
      return NextResponse.json({ error: 'Mật khẩu hiện tại không đúng' }, { status: 400 });
    }
  }

  // Hash new password using Meteor-compatible format (sha256 + bcrypt)
  await setPasswordHash(user.id, hashPassword(newPassword));

  return NextResponse.json({ success: true });
}
