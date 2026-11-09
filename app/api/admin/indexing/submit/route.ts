import { NextResponse } from 'next/server';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import {
  enqueueIndexingUrl,
  submitToGoogleIndexing,
  submitToIndexNow,
  getGoogleQuotaRemaining,
} from '@/lib/indexing/indexingEngine';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const body = await req.json();
    let { urls, url, type, immediate, priority } = body;

    const rawList: string[] = [];
    if (Array.isArray(urls)) {
      rawList.push(...urls);
    } else if (typeof urls === 'string') {
      rawList.push(urls);
    }
    if (typeof url === 'string') {
      rawList.push(url);
    }

    const cleanUrls = Array.from(new Set(rawList.map(u => u?.trim()).filter(Boolean)));
    if (cleanUrls.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Vui lòng cung cấp ít nhất một URL hợp lệ' },
        { status: 400 }
      );
    }

    const actionType: 'URL_UPDATED' | 'URL_DELETED' = type === 'URL_DELETED' ? 'URL_DELETED' : 'URL_UPDATED';

    if (immediate) {
      // Immediate mode: Broadcast directly to Google and IndexNow
      console.log(`[AdminIndexing:Submit] Executing immediate dispatch for ${cleanUrls.length} URLs...`);

      const googleQuota = await getGoogleQuotaRemaining();
      const googleResults = [];

      for (let i = 0; i < cleanUrls.length; i++) {
        const targetUrl = cleanUrls[i];
        if (i < googleQuota.remaining) {
          const res = await submitToGoogleIndexing(targetUrl, actionType);
          googleResults.push({ url: targetUrl, ...res });
        } else {
          googleResults.push({
            url: targetUrl,
            success: false,
            httpStatus: 429,
            error: 'Google daily quota limit (200/day) exceeded',
          });
        }
        if (i < cleanUrls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }

      const indexNowResult = await submitToIndexNow(cleanUrls);

      return NextResponse.json({
        success: true,
        message: 'Đã gửi trực tiếp tới các công cụ tìm kiếm',
        totalUrls: cleanUrls.length,
        googleResults,
        indexNowResult,
      });
    }

    // Default: Enqueue into indexing_queue
    const enqueuePriority = Number(priority) || 1;
    let enqueuedCount = 0;

    for (const targetUrl of cleanUrls) {
      const res = await enqueueIndexingUrl(targetUrl, actionType, enqueuePriority, 'admin-manual');
      if (res.success) {
        enqueuedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Đã đưa ${enqueuedCount}/${cleanUrls.length} URL vào hàng đợi indexing`,
      enqueuedCount,
      totalRequested: cleanUrls.length,
    });
  } catch (error: any) {
    console.error('[AdminIndexing:Submit Error]', error?.message || error);
    return NextResponse.json({ success: false, message: error?.message || 'Lỗi server' }, { status: 500 });
  }
}
