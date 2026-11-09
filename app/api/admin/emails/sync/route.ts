import { NextResponse } from 'next/server';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { syncAllEmails } from '@/lib/emailSync';

export async function POST(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const result = await syncAllEmails();
    return NextResponse.json({ 
      success: true, 
      message: `Đã đồng bộ ${result.inbox} email đến và ${result.sent} email đã gửi.`,
      data: result 
    });
  } catch (error: any) {
    console.error("Email sync error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
