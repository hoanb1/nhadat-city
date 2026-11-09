import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { idCond } from '@/lib/db/repo/adminCommon';
import { mapRealEstateRow } from '@/lib/db/realEstate';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { getRealEstateUrl } from '@/lib/utils/utils';
import { enqueueIndexingUrl } from '@/lib/indexing/indexingEngine';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const resolvedParams = await params;
    const { status } = await req.json();

    if (status === undefined) {
      return NextResponse.json({ success: false, message: 'Thiếu trường status' }, { status: 400 });
    }

    const newStatus = parseInt(status);
    if (!Number.isFinite(newStatus)) {
      return NextResponse.json({ success: false, message: 'status không hợp lệ' }, { status: 400 });
    }

    const [updated] = await sql`
      UPDATE real_estates SET status = ${newStatus}, updated_at = now()
      WHERE ${idCond(resolvedParams.id)}
      RETURNING id, mongo_id, short_id, title, province_slug, district_slug, ward_slug`;
    if (!updated) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy tin đăng' }, { status: 404 });
    }
    const listing = mapRealEstateRow(updated);

    // Trigger instant indexing enqueue
    try {
      const listingUrl = `https://nhadat.city${getRealEstateUrl(listing as any)}`;
      const indexingType = (newStatus === 1 || newStatus === 2) ? 'URL_UPDATED' : 'URL_DELETED';
      const indexingSource = (newStatus === 1 || newStatus === 2) ? 'admin-approval' : 'admin-deactivation';
      await enqueueIndexingUrl(listingUrl, indexingType, 1, indexingSource);
    } catch (hookErr: any) {
      console.warn('[IndexingHook:AdminPUT Warning] Failed to enqueue indexing task:', hookErr?.message || hookErr);
    }

    return NextResponse.json({ success: true, message: 'Cập nhật trạng thái thành công' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const resolvedParams = await params;
    const [deleted] = await sql`
      DELETE FROM real_estates WHERE ${idCond(resolvedParams.id)}
      RETURNING id, mongo_id, short_id, title, province_slug, district_slug, ward_slug`;

    if (!deleted) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy tin đăng' }, { status: 404 });
    }
    const listing = mapRealEstateRow(deleted);

    // Trigger instant indexing deletion hook
    if (listing) {
      try {
        const listingUrl = `https://nhadat.city${getRealEstateUrl(listing as any)}`;
        await enqueueIndexingUrl(listingUrl, 'URL_DELETED', 1, 'admin-delete');
      } catch (hookErr: any) {
        console.warn('[IndexingHook:AdminDELETE Warning] Failed to enqueue indexing task:', hookErr?.message || hookErr);
      }
    }

    return NextResponse.json({ success: true, message: 'Đã xóa tin đăng' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
