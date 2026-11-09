import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import crypto from 'crypto';
import { sql } from '@/lib/db/pg';

export const runtime = 'nodejs';

// GET /api/user/chat-sessions — get list of chat sessions
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userId = (session.user as any).id || session.user.email;

    const rows = await sql`
      SELECT id, mongo_id, title, updated_at FROM chat_sessions
      WHERE user_mongo_id = ${userId}
      ORDER BY updated_at DESC LIMIT 50`;
    const sessions = rows.map((r) => ({
      _id: r.mongo_id ?? String(r.id),
      title: r.title,
      updatedAt: r.updated_at,
    }));

    return NextResponse.json({ success: true, data: sessions });
  } catch (err) {
    console.error('[API] GET chat-sessions error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// POST /api/user/chat-sessions — create or update session
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sessionId, messages } = body;
    const userId = (session.user as any).id || session.user.email;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ success: false, error: 'No messages provided' }, { status: 400 });
    }

    let title = "Hội thoại mới";
    const firstUserMsg = messages.find((m: any) => m.role === 'user');
    if (firstUserMsg) {
       title = firstUserMsg.content.substring(0, 40) + (firstUserMsg.content.length > 40 ? '...' : '');
    }

    if (sessionId) {
      const sid = String(sessionId);
      const numId = /^\d{1,15}$/.test(sid) ? Number(sid) : -1;
      await sql`
        UPDATE chat_sessions SET messages = ${sql.json(messages)}, updated_at = NOW(), title = ${title}
        WHERE user_mongo_id = ${userId} AND (mongo_id = ${sid} OR (mongo_id IS NULL AND id = ${numId}))`;
      return NextResponse.json({ success: true, sessionId });
    } else {
      const newId = crypto.randomBytes(12).toString('hex'); // ObjectId-shaped id, as before
      await sql`
        INSERT INTO chat_sessions (mongo_id, user_id, user_mongo_id, title, messages, created_at, updated_at)
        VALUES (${newId}, (SELECT id FROM users WHERE mongo_id = ${userId}), ${userId}, ${title},
                ${sql.json(messages)}, NOW(), NOW())`;
      return NextResponse.json({ success: true, sessionId: newId });
    }
  } catch (err) {
    console.error('[API] POST chat-sessions error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
