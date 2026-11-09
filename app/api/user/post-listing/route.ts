import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { sql } from '@/lib/db/pg';
import { resolveUserPk } from '@/lib/db/repo/userRepo';
import { makeUrlSlug, getRealEstateUrl } from '@/lib/utils/utils';
import { enqueueIndexingUrl } from '@/lib/indexing/indexingEngine';

export const runtime = 'nodejs';

function generateId(len = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      title, description, propertyType, area, totalPrice,
      legalDocs, direction, address, adminunit, coordinates,
      dynamicFields, contact,
    } = body;

    if (!title?.trim()) return NextResponse.json({ success: false, error: 'Tiêu đề không được để trống' }, { status: 400 });
    if (!area || area <= 0) return NextResponse.json({ success: false, error: 'Diện tích không hợp lệ' }, { status: 400 });
    if (!totalPrice || totalPrice <= 0) return NextResponse.json({ success: false, error: 'Giá không hợp lệ' }, { status: 400 });

    const userId = String((session.user as any).id);

    const now = new Date();
    const expireAt = new Date(now);
    expireAt.setDate(expireAt.getDate() + 30); // 30 days

    const adminunitIn = adminunit && typeof adminunit === 'object' ? adminunit : {};
    const coordsOk =
      Array.isArray(coordinates) && coordinates.length >= 2 &&
      Number.isFinite(Number(coordinates[0])) && Number.isFinite(Number(coordinates[1]));
    const lng = coordsOk ? Number(coordinates[0]) : null;
    const lat = coordsOk ? Number(coordinates[1]) : null;
    const userPk = await resolveUserPk(userId);

    const base = {
      title: title.trim(),
      description: description?.trim() || '',
      propertyType: propertyType || 'nha_o',
      area: Number(area),
      totalPrice: Number(totalPrice),
      price: Number(totalPrice),
      pricePerM2: area > 0 ? Math.round(Number(totalPrice) / Number(area)) : 0,
      legalDocs: legalDocs || '',
      direction: direction || '',
      address: address?.trim() || '',
      adminunit: adminunitIn,
      coordinates: coordinates || [],
      dynamicFields: dynamicFields || [],
      contact: {
        name: contact?.name?.trim() || session.user.name || '',
        phone: contact?.phone?.trim() || '',
        email: contact?.email?.trim() || session.user.email || '',
      },
      images: [] as string[],
      userId,
      status: 1, // active
      views: 0,
      createdAt: now,
      postedAt: now,
      expireAt,
      postDuration: 30,
      slug: makeUrlSlug(title),
    };

    // short_id is UNIQUE in PG: retry on (rare) collision
    let shortId = '';
    let inserted = false;
    for (let attempt = 0; attempt < 8 && !inserted; attempt++) {
      shortId = generateId();
      const rows = await sql`
        INSERT INTO real_estates (
          mongo_id, short_id, slug, status, property_type, title, description, area, price, total_price,
          price_per_m2, legal_docs, direction, address, province_slug, district_slug, ward_slug,
          longitude, latitude, geom, images, contact, user_id, user_mongo_id, views, post_duration,
          dynamic_fields, created_at, posted_at, expire_at, extra
        ) VALUES (
          ${shortId}, ${shortId}, ${base.slug}, 1, ${base.propertyType}, ${base.title}, ${base.description},
          ${base.area}, ${base.price}, ${base.totalPrice}, ${base.pricePerM2}, ${base.legalDocs},
          ${base.direction}, ${base.address},
          ${adminunitIn.province ?? null}, ${adminunitIn.district ?? null}, ${adminunitIn.ward ?? null},
          ${lng}, ${lat},
          ${lng !== null && lat !== null ? sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)` : null},
          ${sql.array([] as string[])}::text[], ${sql.json(base.contact)}, ${userPk}, ${userId}, 0, 30,
          ${sql.json(base.dynamicFields)}, ${now}, ${now}, ${expireAt}, '{}'::jsonb
        )
        ON CONFLICT DO NOTHING
        RETURNING id`;
      inserted = rows.length > 0;
    }
    if (!inserted) throw new Error('Could not allocate unique short_id');
    const listing = { ...base, _id: shortId, shortId };

    // Trigger instant indexing enqueue
    try {
      const listingUrl = `https://nhadat.city${getRealEstateUrl(listing)}`;
      await enqueueIndexingUrl(listingUrl, 'URL_UPDATED', 1, 'user-post');
    } catch (hookErr: any) {
      console.warn('[IndexingHook:UserPost Warning] Failed to enqueue indexing task:', hookErr?.message || hookErr);
    }

    return NextResponse.json({
      success: true,
      data: { _id: listing._id, slug: listing.slug },
    });
  } catch (err) {
    console.error('[API] post listing error:', err);
    return NextResponse.json({ success: false, error: 'Lỗi server' }, { status: 500 });
  }
}
