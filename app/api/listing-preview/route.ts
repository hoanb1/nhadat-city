import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { makeUrlSlug } from '@/lib/utils/utils';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400 });
  }

  try {
    // Route param may be the Mongo id or the public shortId
    const rows = await sql`
      SELECT id, mongo_id, title, total_price, price, area, images[1:1] AS images, short_id, province_slug, ward_slug
      FROM real_estates
      WHERE mongo_id = ${id} OR short_id = ${id}
      ORDER BY (mongo_id = ${id}) DESC LIMIT 1`;
    const r = rows[0];
    const listing: any = r && {
      _id: r.mongo_id ?? String(r.id),
      title: r.title,
      totalPrice: r.total_price,
      price: r.price,
      area: r.area,
      images: r.images,
      shortId: r.short_id,
      adminunit: { province: r.province_slug, ward: r.ward_slug },
    };

    if (!listing) {
      return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
    }

    // Format data for preview
    const price = listing.totalPrice || listing.price || 0;
    const priceStr = price >= 1_000_000_000 
      ? `${(price / 1_000_000_000).toFixed(2)} tỷ` 
      : price >= 1_000_000 
        ? `${(price / 1_000_000).toFixed(0)} triệu` 
        : `${price.toLocaleString()} đ`;

    const thumbnail = listing.images?.[0] || null;
    
    // Build link
    const prov = listing.adminunit?.province || 'vietnam';
    const ward = listing.adminunit?.ward || 'khu-vuc';
    const slug = makeUrlSlug(listing.title || '');
    const link = `https://nhadat.city/${prov}/${ward}/${listing.shortId || listing._id}/${slug}`;

    return NextResponse.json({
      success: true,
      data: {
        id: listing._id.toString(),
        title: listing.title,
        price: priceStr,
        area: listing.area ? `${listing.area}m2` : 'N/A',
        thumbnail,
        link,
      }
    });

  } catch (error) {
    console.error('Listing preview error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
