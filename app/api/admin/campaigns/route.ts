import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { dateOnly, splitBody } from '@/lib/db/repo/adminCommon';
import { campaignOut } from '@/lib/db/repo/adminCampaigns';

export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const rows = await sql`
      SELECT id, mongo_id, name, location, description,
             to_char(start_date, 'YYYY-MM-DD') AS start_date,
             to_char(end_date, 'YYYY-MM-DD') AS end_date,
             status, created_at, extra
      FROM campaigns ORDER BY created_at DESC`;
    return NextResponse.json(rows.map(campaignOut));
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const body = await req.json();

    const doc = {
      ...body,
      createdAt: new Date()
    };

    const { cols, rest } = splitBody(body, {
      name: 'name', location: 'location', description: 'description',
      startDate: 'start_date', endDate: 'end_date', status: 'status',
    });
    const [row] = await sql`
      INSERT INTO campaigns (name, location, description, start_date, end_date, status, created_at, extra)
      VALUES (${cols.name ?? null}, ${cols.location ?? null}, ${cols.description ?? null},
              ${dateOnly(cols.start_date)}::date, ${dateOnly(cols.end_date)}::date, ${cols.status ?? null},
              ${doc.createdAt}, ${sql.json(rest as any)})
      RETURNING id, mongo_id`;
    return NextResponse.json({ success: true, message: 'Thêm mới chiến dịch thành công', data: { ...doc, _id: row.mongo_id ?? String(row.id) } });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
