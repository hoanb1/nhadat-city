import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';

export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [[u], [re]] = await Promise.all([
      // 1. Total users
      sql`SELECT count(*)::float8 AS n FROM users`,
      // 2. Total active listings, 3. Pending listings (0 = pending/draft), 4. listings added today
      sql`
        SELECT count(*) FILTER (WHERE status >= 1)::float8 AS active,
               count(*) FILTER (WHERE status = 0)::float8 AS pending,
               count(*) FILTER (WHERE created_at >= ${today})::float8 AS today
        FROM real_estates`,
    ]);
    const totalUsers = Number(u.n);
    const totalListings = Number(re.active);
    const pendingListings = Number(re.pending);
    const dailyCrawls = Number(re.today);

    // Chart data (mocked for now, need historical stats collection)
    const chartData = [
      { name: 'T2', listings: 4000, users: 240 },
      { name: 'T3', listings: 3000, users: 138 },
      { name: 'T4', listings: 2000, users: 980 },
      { name: 'T5', listings: 2780, users: 390 },
      { name: 'T6', listings: 1890, users: 480 },
      { name: 'T7', listings: 2390, users: 380 },
      { name: 'CN', listings: 3490, users: 430 },
    ];

    return NextResponse.json({
      success: true,
      data: {
        totalUsers,
        totalListings,
        pendingListings,
        dailyCrawls,
        chartData
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
