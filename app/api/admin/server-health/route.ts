import { NextResponse } from 'next/server';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';

const execAsync = promisify(exec);

export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    // 1. Memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = (usedMem / totalMem) * 100;

    // 2. CPU
    const cpus = os.cpus();
    const cpuModel = cpus[0].model;
    const loadAvg = os.loadavg(); // [1, 5, 15] minute averages
    
    // We can approximate CPU usage using loadavg[0] relative to number of cores
    // It's not exact real-time CPU %, but a good server load indicator
    const cpuUsagePercent = Math.min((loadAvg[0] / cpus.length) * 100, 100);

    // 3. Disk (df -h /)
    let diskData = { total: '0', used: '0', usePercent: 0 };
    try {
      const { stdout } = await execAsync("df -k / | tail -1 | awk '{print $2, $3, $5}'");
      const parts = stdout.trim().split(/\s+/);
      if (parts.length >= 3) {
        const totalKb = parseInt(parts[0], 10);
        const usedKb = parseInt(parts[1], 10);
        const percentStr = parts[2].replace('%', '');
        
        diskData = {
          total: (totalKb / 1024 / 1024).toFixed(1) + ' GB',
          used: (usedKb / 1024 / 1024).toFixed(1) + ' GB',
          usePercent: parseInt(percentStr, 10)
        };
      }
    } catch (err) {
      console.error('Disk check error:', err);
    }

    // 4. PM2 Logs (tail last 20 lines)
    let pm2Logs: string[] = [];
    try {
      // Assuming pm2 logs are in ~/.pm2/logs/
      // This is a quick hack to get recent logs for nhadat-next
      const { stdout } = await execAsync("tail -n 20 ~/.pm2/logs/nhadat-next-out.log || echo 'No PM2 logs found'");
      pm2Logs = stdout.trim().split('\n');
    } catch (err) {
      pm2Logs = ['Failed to read PM2 logs'];
    }

    return NextResponse.json({
      success: true,
      data: {
        cpu: {
          model: cpuModel,
          cores: cpus.length,
          usagePercent: cpuUsagePercent.toFixed(1)
        },
        memory: {
          total: (totalMem / 1024 / 1024 / 1024).toFixed(1) + ' GB',
          used: (usedMem / 1024 / 1024 / 1024).toFixed(1) + ' GB',
          usagePercent: memUsagePercent.toFixed(1)
        },
        disk: diskData,
        logs: pm2Logs,
        uptime: os.uptime() // in seconds
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
