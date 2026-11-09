import { NextRequest, NextResponse } from 'next/server';
import { getParcelByUuid } from '@/lib/geo/parcelService';
import { getAdminUnitByCoords, computeCentroid } from '@/lib/geo/parcelAdminUnit';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uuid = searchParams.get('uuid');

  if (!uuid) {
    return NextResponse.json({ error: 'Missing uuid' }, { status: 400 });
  }

  const data = await getParcelByUuid(uuid);
  if (!data) {
    return NextResponse.json({ success: false, data: null });
  }

  // Compute centroid from geometry to look up admin unit info
  const centroid = computeCentroid(data.geometry);
  let adminUnit = null;
  if (centroid) {
    adminUnit = await getAdminUnitByCoords(centroid[0], centroid[1]);
  }

  return NextResponse.json({
    success: true,
    data: {
      ...data,
      // Centroid coords (useful for client map positioning)
      lng: centroid?.[0] ?? null,
      lat: centroid?.[1] ?? null,
      // Address enrichment from GeoServer admin unit layers
      address:      adminUnit?.address      || '',
      wardName:     adminUnit?.wardName     || '',
      districtName: adminUnit?.districtName || '',
      provinceName: adminUnit?.provinceName || '',
      wardSlug:     adminUnit?.wardSlug     || '',
      provinceSlug: adminUnit?.provinceSlug || '',
    }
  });
}
