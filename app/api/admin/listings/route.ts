import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { and, escapeLike } from '@/lib/db/pgUtil';
import { mapRealEstateRow } from '@/lib/db/realEstate';
import { pageParams } from '@/lib/db/repo/adminCommon';

export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(req.url);
    const { page, limit, offset } = pageParams(searchParams, 20);
    const search = searchParams.get('search') || '';
    const statusFilter = searchParams.get('status') || 'all';

    const conds = [];
    if (search) {
      const pat = `%${escapeLike(search)}%`;
      conds.push(sql`(title ILIKE ${pat} OR address ILIKE ${pat} OR contact->>'name' ILIKE ${pat})`);
    }
    if (statusFilter !== 'all') {
      const st = parseInt(statusFilter);
      if (Number.isFinite(st)) conds.push(sql`status = ${st}`);
    }
    const where = and(conds);

    // Slim column set: avoid fetching huge description bodies
    const [rows, [cnt]] = await Promise.all([
      sql`
        SELECT id, mongo_id, title, price, area, status, created_at, images[1:1] AS images, address, views,
               province_slug, district_slug, ward_slug, short_id
        FROM real_estates WHERE ${where}
        ORDER BY created_at DESC
        OFFSET ${offset} LIMIT ${limit}`,
      sql`SELECT count(*)::float8 AS n FROM real_estates WHERE ${where}`,
    ]);
    const listings = rows.map(mapRealEstateRow);
    const total = Number(cnt.n);

    return NextResponse.json({
      success: true,
      data: {
        listings,
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
