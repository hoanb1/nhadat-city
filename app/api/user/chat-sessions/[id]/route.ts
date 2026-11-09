import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { sql } from '@/lib/db/pg';

export const runtime = 'nodejs';

// GET /api/user/chat-sessions/[id]
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userId = (session.user as any).id || session.user.email;
    const params = await props.params;
    const id = params.id;
    const numId = /^\d{1,15}$/.test(id) ? Number(id) : -1;

    const rows = await sql`
      SELECT id, mongo_id, user_mongo_id, title, messages, created_at, updated_at FROM chat_sessions
      WHERE user_mongo_id = ${userId} AND (mongo_id = ${id} OR (mongo_id IS NULL AND id = ${numId}))
      LIMIT 1`;

    if (!rows.length) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    const r = rows[0];
    const chatSession = {
      _id: r.mongo_id ?? String(r.id),
      userId: r.user_mongo_id,
      title: r.title,
      messages: r.messages,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };

    return NextResponse.json({ success: true, data: chatSession });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/user/chat-sessions/[id]
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userId = (session.user as any).id || session.user.email;
    const params = await props.params;
    const id = params.id;
    const numId = /^\d{1,15}$/.test(id) ? Number(id) : -1;

    const res = await sql`
      DELETE FROM chat_sessions
      WHERE user_mongo_id = ${userId} AND (mongo_id = ${id} OR (mongo_id IS NULL AND id = ${numId}))`;

    if (res.count === 0) {
      return NextResponse.json({ success: false, error: 'Not found or not authorized' }, { status: 403 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
