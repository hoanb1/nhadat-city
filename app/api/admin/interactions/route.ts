import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { pageParams } from '@/lib/db/repo/adminCommon';

function listingOut(r: Record<string, any>) {
  if (r.l_id == null) return undefined;
  const adminunit: Record<string, string> = {};
  if (r.l_province != null) adminunit.province = r.l_province;
  if (r.l_district != null) adminunit.district = r.l_district;
  if (r.l_ward != null) adminunit.ward = r.l_ward;
  const listing: Record<string, any> = { _id: r.l_mongo_id ?? String(r.l_id), title: r.l_title, adminunit };
  if (r.l_short_id != null) listing.shortId = r.l_short_id;
  return listing;
}

export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(req.url);
    const { page, limit, offset } = pageParams(searchParams, 50);
    const type = searchParams.get('type') || 'comment';

    let items: Record<string, any>[];
    let total: number;

    if (type === 'chat') {
      const [rows, [cnt]] = await Promise.all([
        sql`
          SELECT x.id, x.mongo_id, x.real_estate_mongo_id, x.sender_mongo_id, x.receiver_mongo_id,
                 x.message, x.read, x.created_at, r.*
          FROM (SELECT * FROM messages ORDER BY created_at DESC OFFSET ${offset} LIMIT ${limit}) x
          LEFT JOIN LATERAL (
            SELECT id AS l_id, mongo_id AS l_mongo_id, title AS l_title, short_id AS l_short_id,
                   province_slug AS l_province, district_slug AS l_district, ward_slug AS l_ward
            FROM real_estates
            WHERE mongo_id = x.real_estate_mongo_id OR short_id = x.real_estate_mongo_id
            LIMIT 1
          ) r ON true
          ORDER BY x.created_at DESC`,
        sql`SELECT count(*)::int AS n FROM messages`,
      ]);
      total = cnt.n;
      items = rows.map((r) => {
        const it: Record<string, any> = {
          _id: r.mongo_id ?? String(r.id),
          senderId: r.sender_mongo_id,
          receiverId: r.receiver_mongo_id,
          message: r.message,
          timestamp: r.created_at,
          createdAt: r.created_at,
          read: r.read,
        };
        if (r.real_estate_mongo_id != null) it.realEstateId = r.real_estate_mongo_id;
        const listing = listingOut(r);
        if (listing) it.listing = listing;
        return it;
      });
    } else {
      const [rows, [cnt]] = await Promise.all([
        sql`
          SELECT x.id, x.mongo_id, x.real_estate_mongo_id, x.user_mongo_id, x.user_id,
                 x.content, x.parent_comment_mongo_id, x.created_at, r.*
          FROM (SELECT * FROM re_comments ORDER BY created_at DESC OFFSET ${offset} LIMIT ${limit}) x
          LEFT JOIN LATERAL (
            SELECT id AS l_id, mongo_id AS l_mongo_id, title AS l_title, short_id AS l_short_id,
                   province_slug AS l_province, district_slug AS l_district, ward_slug AS l_ward
            FROM real_estates
            WHERE mongo_id = x.real_estate_mongo_id OR short_id = x.real_estate_mongo_id
            LIMIT 1
          ) r ON true
          ORDER BY x.created_at DESC`,
        sql`SELECT count(*)::int AS n FROM re_comments`,
      ]);
      total = cnt.n;
      items = rows.map((r) => {
        const it: Record<string, any> = {
          _id: r.mongo_id ?? String(r.id),
          realEstateId: r.real_estate_mongo_id,
          content: r.content,
          createdAt: r.created_at,
        };
        const uid = r.user_mongo_id ?? (r.user_id != null ? String(r.user_id) : null);
        if (uid != null) it.userId = uid;
        if (r.parent_comment_mongo_id != null) it.parentCommentId = r.parent_comment_mongo_id;
        const listing = listingOut(r);
        if (listing) it.listing = listing;
        return it;
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        items,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();
  // Deletion is served by /api/admin/interactions/[id]
  return NextResponse.json({ success: false }, { status: 400 });
}
