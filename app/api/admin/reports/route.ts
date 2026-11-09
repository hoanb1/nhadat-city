import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { pageParams } from '@/lib/db/repo/adminCommon';

export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(req.url);
    const { page, limit, offset } = pageParams(searchParams, 50);
    const statusFilter = searchParams.get('status') || 'all';

    const where = statusFilter === 'pending' ? sql`WHERE reviewed IS NOT TRUE`
      : statusFilter === 'reviewed' ? sql`WHERE reviewed IS TRUE`
      : sql``;

    const [rows, [cnt]] = await Promise.all([
      sql`
        SELECT x.id, x.mongo_id, x.post_mongo_id, x.reported_by, x.reason, x.details, x.client_info,
               x.created_at, x.reviewed, r.*
        FROM (SELECT * FROM reports ${where} ORDER BY created_at DESC OFFSET ${offset} LIMIT ${limit}) x
        LEFT JOIN LATERAL (
          SELECT id AS l_id, mongo_id AS l_mongo_id, title AS l_title, short_id AS l_short_id,
                 province_slug AS l_province, district_slug AS l_district, ward_slug AS l_ward
          FROM real_estates
          WHERE mongo_id = x.post_mongo_id OR short_id = x.post_mongo_id
          LIMIT 1
        ) r ON true
        ORDER BY x.created_at DESC`,
      sql`SELECT count(*)::int AS n FROM reports ${where}`,
    ]);
    const total: number = cnt.n;

    const reports = rows.map((r) => {
      const o: Record<string, any> = {
        _id: r.mongo_id ?? String(r.id),
        postId: r.post_mongo_id,
        clientInfo: r.client_info ?? {},
        createdAt: r.created_at,
        reviewed: r.reviewed,
      };
      if (r.reported_by != null) o.reportedBy = r.reported_by;
      if (r.reason != null) o.reason = r.reason;
      if (r.details != null) o.details = r.details;
      if (r.l_id != null) {
        const adminunit: Record<string, string> = {};
        if (r.l_province != null) adminunit.province = r.l_province;
        if (r.l_district != null) adminunit.district = r.l_district;
        if (r.l_ward != null) adminunit.ward = r.l_ward;
        o.listing = { _id: r.l_mongo_id ?? String(r.l_id), title: r.l_title, adminunit, ...(r.l_short_id != null ? { shortId: r.l_short_id } : {}) };
      }
      return o;
    });

    return NextResponse.json({
      success: true,
      data: {
        reports,
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
