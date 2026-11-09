import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { layerCols, layerOut } from '@/lib/db/repo/adminMapLayers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    // sort by name
    const rows = await sql`SELECT * FROM planning_layers ORDER BY name ASC`;
    return NextResponse.json(rows.map(layerOut));
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const body = await req.json();

    const newLayer = {
      ...body,
      createdAt: new Date(),
    };

    const { cols, rest } = layerCols(body);
    const values: Record<string, any> = {
      id: randomUUID().replace(/-/g, '').slice(0, 24),
      name: 'Lớp bản đồ',
      tile_url: '',
      ...cols,
      created_at: newLayer.createdAt,
      extra: sql.json(rest as any),
    };
    const [row] = await sql`
      INSERT INTO planning_layers ${sql(values, ...Object.keys(values))}
      RETURNING id, mongo_id`;

    return NextResponse.json({ success: true, message: 'Thêm lớp bản đồ thành công', layer: { ...newLayer, _id: row.mongo_id ?? String(row.id) } });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
