import { NextResponse } from 'next/server';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { sql } from '@/lib/db/pg';

export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    // 1. Fetch overview statistics
    const [ovRow] = await sql`SELECT value FROM app_config WHERE key = 'global_overview'`;
    const overviewDoc = (ovRow?.value ?? null) as Record<string, any> | null;

    // 2. Fetch daily traffic for the last 30 days
    const dailyStats = await sql`
      SELECT to_char(day, 'YYYY-MM-DD') AS id, views, visitors
      FROM analytics_daily ORDER BY day DESC LIMIT 30`;

    // 3. Fetch top SEO keywords
    const topKeywords = await sql`SELECT keyword, volume, extra FROM seo_keywords ORDER BY volume DESC`;

    // Format overview with fallback defaults
    const overview = {
      pageViews: overviewDoc?.pageViews || 0,
      uniqueVisitors: overviewDoc?.uniqueVisitors || 0,
      avgSessionDuration: overviewDoc?.avgSessionDuration || '3m 45s',
      bounceRate: overviewDoc?.bounceRate || '42.5%'
    };

    // Construct 30-day dynamic timeline ending today
    const chartData = Array.from({ length: 30 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      
      const options = { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' } as const;
      const formatter = new Intl.DateTimeFormat('en-CA', options);
      const dateStr = formatter.format(d); // e.g. "2026-05-22"

      const matchedDateStr = `${d.getDate()}/${d.getMonth() + 1}`;

      const dbRecord = dailyStats.find(item => item.id === dateStr);
      return {
        date: matchedDateStr,
        views: dbRecord?.views || 0,
        visitors: dbRecord?.visitors || 0
      };
    });

    const keywords = topKeywords.map(k => ({
      keyword: k.keyword,
      volume: k.volume,
      position: (k.extra as any)?.position
    }));

    return NextResponse.json({
      success: true,
      data: {
        overview,
        chartData,
        topKeywords: keywords
      }
    });
  } catch (error: any) {
    console.error('[Admin Analytics Route Error]:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
