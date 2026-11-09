import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db/pg';

export async function POST() {
  try {
    const cookieStore = await cookies();
    
    // Check if the user has visited today
    const visTodayCookie = cookieStore.get('nhadat_vis_today');
    const isNewVisitor = !visTodayCookie;

    // Get current date string in Asia/Ho_Chi_Minh timezone (YYYY-MM-DD)
    const options = { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' } as const;
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    const dateStr = formatter.format(new Date());

    // 1. Update daily statistics & overview in background (Non-blocking to eliminate 833ms latency & HTTP 500s)
    const v = isNewVisitor ? 1 : 0;
    Promise.all([
      sql`INSERT INTO analytics_daily (day, views, visitors) VALUES (${dateStr}::date, 1, ${v})
          ON CONFLICT (day) DO UPDATE SET views = analytics_daily.views + 1, visitors = analytics_daily.visitors + ${v}`,
      sql`INSERT INTO app_config (key, value, updated_at)
          VALUES ('global_overview', jsonb_build_object('pageViews', 1, 'uniqueVisitors', ${v}::int), NOW())
          ON CONFLICT (key) DO UPDATE SET
            value = jsonb_set(jsonb_set(app_config.value,
              '{pageViews}', to_jsonb(COALESCE((app_config.value->>'pageViews')::bigint, 0) + 1)),
              '{uniqueVisitors}', to_jsonb(COALESCE((app_config.value->>'uniqueVisitors')::bigint, 0) + ${v}::int)),
            updated_at = NOW()`,
    ]).catch(err => {
      console.warn('[Analytics Background Write Warning]:', err?.message || err);
    });

    const response = NextResponse.json({ success: true });

    // Set cookie if new visitor to prevent double counting today (expires in 24 hours)
    if (isNewVisitor) {
      response.cookies.set('nhadat_vis_today', '1', {
        maxAge: 86400, // 24 hours
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      });
    }

    return response;
  } catch (error: any) {
    console.warn('[Analytics Track API Non-blocking Fallback]:', error?.message || error);
    return NextResponse.json({ success: true, tracking: 'degraded' }, { status: 200 });
  }
}
