import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { idCond } from '@/lib/db/repo/adminCommon';

export async function POST(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const { jobId, action } = await req.json();
    
    if (!jobId || !['pause', 'resume', 'stop'].includes(action)) {
      return NextResponse.json({ success: false, message: 'Invalid action or jobId' }, { status: 400 });
    }

    const statusMap: any = {
      'pause': 'paused',
      'resume': 'running',
      'stop': 'stopped'
    };

    const targetStatus = statusMap[action];

    const rows = await sql`
      UPDATE scraping_logs SET status = ${targetStatus}
      WHERE ${idCond(String(jobId))} AND status IS DISTINCT FROM ${targetStatus}
      RETURNING id`;

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Job not found or status already set' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: `Job ${action}d successfully`, status: targetStatus });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
