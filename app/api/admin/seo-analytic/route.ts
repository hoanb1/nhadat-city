import { NextResponse } from 'next/server';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { SEOAnalyticClient } from '@/lib/seoAnalyticClient';

export async function GET(request: Request) {
  if (!verifyAdminAuth(request)) return unauthorizedResponse();
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain') || 'nhadat.city';
  const action = searchParams.get('action') || 'overview';
  const query = searchParams.get('query') || '';

  try {
    if (action === 'keywords') {
      const data = await SEOAnalyticClient.getKeywords(domain);
      return NextResponse.json({ success: true, data });
    }

    if (action === 'serp' && query) {
      const data = await SEOAnalyticClient.analyzeSERP(query);
      return NextResponse.json({ success: true, data });
    }

    if (action === 'ai') {
      const data = await SEOAnalyticClient.getAIAnalysis();
      return NextResponse.json({ success: true, data });
    }

    if (action === 'trending') {
      const data = await SEOAnalyticClient.getTrendingClusters();
      return NextResponse.json({ success: true, data });
    }

    if (action === 'crawls') {
      const data = await SEOAnalyticClient.getCrawlStats();
      return NextResponse.json({ success: true, data });
    }

    // Default: Return combined SEO overview & keywords
    const [keywords, aiAnalysis, crawlStats, trending] = await Promise.all([
      SEOAnalyticClient.getKeywords(domain),
      SEOAnalyticClient.getAIAnalysis(),
      SEOAnalyticClient.getCrawlStats(),
      SEOAnalyticClient.getTrendingClusters(),
    ]);

    return NextResponse.json({
      success: true,
      domain,
      keywords,
      aiAnalysis,
      crawlStats,
      trending,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal SEO Analytic API error' },
      { status: 500 }
    );
  }
}
