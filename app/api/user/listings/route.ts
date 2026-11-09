import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { sql } from '@/lib/db/pg';

export const runtime = 'nodejs';

// GET /api/user/listings — fetch listings by current user
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userId = String((session.user as any).id);
    const email = session.user.email?.toLowerCase() ?? null;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'active' | 'expired' | 'all'

    // Owner = user_mongo_id match OR contact email match (same as the old $or)
    const owner = email
      ? sql`(user_mongo_id = ${userId} OR lower(contact->>'email') = ${email})`
      : sql`user_mongo_id = ${userId}`;
    const statusCond =
      status === 'active' ? sql`AND status >= 1` : status === 'expired' ? sql`AND status = 0` : sql``;

    const rows = await sql`
      SELECT id, mongo_id, title, total_price, price, area, images, province_slug, district_slug, ward_slug,
             status, created_at, views, property_type, expire_at
      FROM real_estates
      WHERE ${owner} ${statusCond}
      ORDER BY created_at DESC
      LIMIT 100`;

    const listings = rows.map((r) => {
      const adminunit: Record<string, string> = {};
      if (r.province_slug != null) adminunit.province = r.province_slug;
      if (r.district_slug != null) adminunit.district = r.district_slug;
      if (r.ward_slug != null) adminunit.ward = r.ward_slug;
      const d: Record<string, any> = { _id: r.mongo_id ?? String(r.id) };
      const put = (k: string, v: any) => { if (v !== null && v !== undefined) d[k] = v; };
      put('title', r.title);
      put('totalPrice', r.total_price);
      put('price', r.price);
      put('area', r.area);
      put('images', r.images);
      if (Object.keys(adminunit).length) d.adminunit = adminunit;
      put('status', r.status);
      put('createdAt', r.created_at);
      put('views', r.views);
      put('propertyType', r.property_type);
      put('expireAt', r.expire_at);
      return d;
    });

    return NextResponse.json({ success: true, data: listings });
  } catch (err) {
    console.error('[API] user listings error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/user/listings?id=xxx — delete listing
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

  try {
    const userId = String((session.user as any).id);
    const email = session.user.email?.toLowerCase() ?? null;
    const numId = /^\d{1,15}$/.test(id) ? Number(id) : -1;
    const owner = email
      ? sql`(user_mongo_id = ${userId} OR lower(contact->>'email') = ${email})`
      : sql`user_mongo_id = ${userId}`;
    const res = await sql`
      UPDATE real_estates
      SET status = -1, extra = extra || ${sql.json({ deletedAt: new Date().toISOString() })}
      WHERE (mongo_id = ${id} OR (mongo_id IS NULL AND id = ${numId})) AND ${owner}`;
    if (res.count === 0) {
      return NextResponse.json({ success: false, error: 'Not found or not authorized' }, { status: 403 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
