import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { findUserById, findUserByShortId, userIdOf } from '@/lib/db/repo/userRepo';
import { mapRealEstateRow } from '@/lib/db/realEstate';
import { cacheManager } from '@/lib/utils/cacheManager';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const cacheKey = `user_profile_${id}`;
    const cachedData = await cacheManager.getCache<any>(cacheKey);
    if (cachedData) {
      return NextResponse.json({ success: true, data: cachedData });
    }

    let user = await findUserById(id);

    if (!user) {
      user = await findUserByShortId(id);
    }

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Fetch user's listings (user_mongo_id also covers contact.userId, per ETL)
    const rows = await sql`
      SELECT id, mongo_id, short_id, slug, status, listing_mode, property_type, title, description,
        area, price, total_price, price_per_m2, legal_docs, direction, address,
        province_slug, district_slug, ward_slug, old_address, old_province_slug, old_district_slug, old_ward_slug,
        longitude, latitude, images, thumbnail_url, contact, user_mongo_id, source_mongo_id, source_url,
        source_type, source_code, user_type, is_scraped, views, post_duration, dynamic_fields,
        created_at, updated_at, posted_at, published_at, expire_at, extra
      FROM real_estates
      WHERE (user_mongo_id = ${id} OR user_mongo_id = ${userIdOf(user)} OR user_id = ${user.id})
        AND status >= 1
      LIMIT 20`;
    const listings = rows.map(mapRealEstateRow);

    const profileData = {
      user: {
        id: userIdOf(user),
        name: user.profile?.name || user.name || 'Thành viên',
        email: user.emails?.[0] ?? user.email ?? undefined,
        phone: user.profile?.phone ?? user.phone ?? undefined,
        image: user.extra?.image || user.profile?.image,
      },
      listings
    };

    // Cache for 5 minutes
    await cacheManager.setCache(cacheKey, profileData, 300);

    return NextResponse.json({
      success: true,
      data: profileData
    });
  } catch (err) {
    console.error('[API] user profile error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
