import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rows = await sql`
      SELECT id, mongo_id, real_estate_mongo_id, name, content, created_at FROM re_comments
      WHERE real_estate_mongo_id = ${id}
      ORDER BY created_at DESC LIMIT 50`;
    const comments = rows.map((r) => ({
      _id: r.mongo_id ?? String(r.id),
      listingId: r.real_estate_mongo_id,
      name: r.name,
      content: r.content,
      createdAt: r.created_at,
      likes: 0,
    }));

    return NextResponse.json({ success: true, data: comments });
  } catch (error) {
    return NextResponse.json({ success: false, data: [] });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ success: false, error: 'Nội dung không được trống' }, { status: 400 });
    }
    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'Vui lòng nhập tên' }, { status: 400 });
    }
    if (content.length > 1000) {
      return NextResponse.json({ success: false, error: 'Nội dung quá dài' }, { status: 400 });
    }

    const comment = {
      listingId: id,
      name: name.trim().substring(0, 50),
      content: content.trim(),
      createdAt: new Date(),
      likes: 0,
    };

    const [row] = await sql`
      INSERT INTO re_comments (real_estate_mongo_id, real_estate_id, name, content, created_at)
      VALUES (${id}, (SELECT id FROM real_estates WHERE mongo_id = ${id} OR short_id = ${id} LIMIT 1),
              ${comment.name}, ${comment.content}, ${comment.createdAt})
      RETURNING id, mongo_id`;

    return NextResponse.json({
      success: true,
      data: { ...comment, _id: row.mongo_id ?? String(row.id) },
    });
  } catch (error) {
    console.error('[API] comment POST error:', error);
    return NextResponse.json({ success: false, error: 'Lỗi server' }, { status: 500 });
  }
}
