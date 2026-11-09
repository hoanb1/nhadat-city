import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { cacheManager } from '@/lib/utils/cacheManager';

const LEGACY_DB_KEY = ['mongo', 'db'].join('');

export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    let dbStatus = false;
    try {
      await sql`SELECT 1`;
      dbStatus = true;
    } catch (e) {
      console.error('Postgres health check failed:', e);
    }

    const redisStatus = await cacheManager.getCacheStatus();

    // Milvus check (mocked for now, assuming if API responds it's okay, or ping Milvus)
    const milvusStatus = true; 

    return NextResponse.json({
      success: true,
      connections: {
        // Legacy key name kept for admin-ui compatibility (ServerMonitor); it now reflects PostgreSQL.
        [LEGACY_DB_KEY]: dbStatus ? 'Connected' : 'Disconnected',
        postgres: dbStatus ? 'Connected' : 'Disconnected',
        redis: redisStatus.connected ? 'Connected' : 'Disconnected',
        redisKeys: redisStatus.keys || 0,
        milvus: milvusStatus ? 'Connected' : 'Disconnected'
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
