import { NextResponse } from 'next/server';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { EXPLORER_TABLES, estimateCount } from '@/lib/db/repo/adminDb';

export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    // Get (estimated) row count for each allow-listed table
    const data = await Promise.all(
      Object.keys(EXPLORER_TABLES).map(async (name) => {
        let count = 0;
        try {
          count = await estimateCount(name);
        } catch {
          // table not migrated yet
        }
        return { name, type: 'collection', count };
      })
    );

    data.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
