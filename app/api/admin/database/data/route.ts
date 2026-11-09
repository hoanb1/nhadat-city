import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { EXPLORER_TABLES, estimateCount, resolveExplorerTable } from '@/lib/db/repo/adminDb';
import { pageParams } from '@/lib/db/repo/adminCommon';

export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(req.url);
    const col = searchParams.get('col');
    const { page, limit, offset } = pageParams(searchParams, 50, 200);

    if (!col) {
      return NextResponse.json({ success: false, message: 'Missing collection name' }, { status: 400 });
    }

    const table = resolveExplorerTable(col);
    if (!table) {
      return NextResponse.json({ success: false, message: 'Invalid collection' }, { status: 400 });
    }
    const orderCol = EXPLORER_TABLES[table];

    const [rows, total] = await Promise.all([
      // never expose credentials / push keys / heavy derived columns
      sql`
        SELECT to_jsonb(t) - 'password_hash' - 'keys' - 'search_tsv' - 'geom' AS doc
        FROM ${sql(table)} t
        ORDER BY ${sql(orderCol)} DESC
        OFFSET ${offset} LIMIT ${limit}`,
      estimateCount(table),
    ]);

    const documents = rows.map((r) => {
      const d = r.doc as Record<string, any>;
      return { _id: d.mongo_id ?? d.id ?? d.key ?? d.day ?? d.user_key ?? d.code ?? null, ...d };
    });

    return NextResponse.json({
      success: true,
      data: {
        documents,
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
