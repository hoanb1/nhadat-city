import { NextResponse } from 'next/server';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { cacheManager } from '@/lib/utils/cacheManager';

export async function POST(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    await cacheManager.flushCache();
    return NextResponse.json({ success: true, message: 'Đã xóa toàn bộ bộ nhớ đệm (Cache)' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
