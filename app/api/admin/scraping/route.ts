import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { outRow } from '@/lib/db/repo/adminCommon';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';

const VALID_TARGETS = [
  'meeyland.com',
  'meeyproject.com', 
  'tinbds.com',
  'tinbds.com/du-an',
  'alonhadat.com.vn',
  'batdongsan.com.vn',
  'chotot.com',
];

export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const logRows = await sql`SELECT * FROM scraping_logs ORDER BY started_at DESC LIMIT 50`;
    const logs = logRows.map((r) => outRow(r));

    // Stats
    const [j] = await sql`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE status = 'success')::int AS success,
             count(*) FILTER (WHERE status = 'failed')::int AS failed,
             count(*) FILTER (WHERE status = 'running')::int AS running
      FROM scraping_logs`;
    const totalJobs: number = j.total;
    const successJobs: number = j.success;
    const failedJobs: number = j.failed;
    const runningJobs: number = j.running;

    // Data counts
    const [[l], [p]] = await Promise.all([
      sql`SELECT count(*)::float8 AS n FROM real_estates WHERE is_scraped`,
      sql`SELECT count(*)::float8 AS n FROM projects WHERE is_scraped`,
    ]);
    const totalListings = Number(l.n);
    const totalProjects = Number(p.n);

    const stats = {
      totalJobs, successJobs, failedJobs, runningJobs,
      totalListings, totalProjects,
      validTargets: VALID_TARGETS,
    };

    return NextResponse.json({ success: true, data: { logs, stats } });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const body = await req.json();
    const { target, durationLimit } = body;
    
    if (!target) return NextResponse.json({ success: false, message: 'Thiếu tham số target' }, { status: 400 });

    // Validate target
    if (!VALID_TARGETS.includes(target)) {
      return NextResponse.json({ 
        success: false, 
        message: `Target "${target}" không hợp lệ. Cho phép: ${VALID_TARGETS.join(', ')}` 
      }, { status: 400 });
    }

    // Check if there's already a running job for this target
    const [runningJob] = await sql`SELECT id FROM scraping_logs WHERE target = ${target} AND status = 'running' LIMIT 1`;
    if (runningJob) {
      return NextResponse.json({ 
        success: false, 
        message: `Đã có tiến trình đang chạy cho ${target}. Vui lòng đợi hoặc dừng tiến trình hiện tại.` 
      }, { status: 409 });
    }
    
    const newJob = {
      target,
      status: 'running',
      startedAt: new Date(),
      itemsScraped: 0,
      errors: 0,
      durationLimit: durationLimit || 3600,
    };

    const [inserted] = await sql`
      INSERT INTO scraping_logs (target, status, started_at, items_scraped, errors, duration_limit)
      VALUES (${newJob.target}, ${newJob.status}, ${newJob.startedAt}, 0, 0, ${Math.round(Number(newJob.durationLimit)) || 3600})
      RETURNING id, mongo_id`;
    const jobIdStr: string = inserted.mongo_id ?? String(inserted.id);

    // Spawn the scraper in background using exec to avoid Turbopack resolution
    const { exec } = await import('child_process');
    const cmd = `node ${process.cwd()}/scripts/scraper/index.js "${target}" "${jobIdStr}" &`;
    exec(cmd, { timeout: (durationLimit || 3600) * 1000 });

    return NextResponse.json({ 
      success: true, 
      message: `Đã khởi động tiến trình cào dữ liệu từ ${target}`, 
      job: { ...newJob, _id: jobIdStr }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
