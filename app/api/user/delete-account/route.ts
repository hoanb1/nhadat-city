import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { sql } from '@/lib/db/pg';
import { findUserById } from '@/lib/db/repo/userRepo';

export const runtime = 'nodejs';

// DELETE /api/user/delete-account
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = String((session.user as any).id);
  const user = await findUserById(userId);
  const deletedEmail = `deleted-${userId}@deleted.local`;

  await sql.begin(async (tx) => {
    if (user) {
      // Soft delete: mark as deleted, anonymize PII, drop credentials/oauth link
      await tx`
        UPDATE users SET
          email = ${deletedEmail},
          emails = ARRAY[${deletedEmail}]::citext[],
          email_verified = FALSE,
          name = 'Tài khoản đã xóa',
          avatar_url = NULL,
          profile = profile || ${tx.json({ name: 'Tài khoản đã xóa', avatar: null })},
          extra = extra || ${tx.json({ status: 'deleted', deletedAt: new Date().toISOString() })},
          google_id = NULL,
          oauth = oauth - 'google',
          password_hash = NULL,
          updated_at = NOW()
        WHERE id = ${user.id}`;
    }

    // Soft delete their listings
    await tx`UPDATE real_estates SET status = -1 WHERE user_mongo_id = ${userId}${user ? tx` OR user_id = ${user.id}` : tx``}`;
  });

  return NextResponse.json({ success: true });
}
