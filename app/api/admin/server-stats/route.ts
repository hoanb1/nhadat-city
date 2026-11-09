import { NextResponse } from 'next/server';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import os from 'os';
import { execSync } from 'child_process';

export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    // 1. CPU
    const cpus = os.cpus();
    const cpuModel = cpus[0].model;
    const cpuCount = cpus.length;
    const loadAvg = os.loadavg(); // [1, 5, 15] minutes

    // 2. RAM
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = Math.round((usedMem / totalMem) * 100);

    // 3. Uptime
    const uptimeSeconds = os.uptime();
    const days = Math.floor(uptimeSeconds / (3600 * 24));
    const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
    const uptimeStr = `${days} ngày, ${hours} giờ`;

    // 4. Disk Usage (Linux specific)
    let diskTotal = 0;
    let diskUsed = 0;
    let diskFree = 0;
    let diskPercent = 0;

    try {
      // df -B1 / | tail -1 | awk '{print $2, $3, $4, $5}'
      const dfOutput = execSync("df -B1 / | tail -1 | awk '{print $2, $3, $4, $5}'").toString().trim().split(' ');
      if (dfOutput.length === 4) {
        diskTotal = parseInt(dfOutput[0]);
        diskUsed = parseInt(dfOutput[1]);
        diskFree = parseInt(dfOutput[2]);
        diskPercent = parseInt(dfOutput[3].replace('%', ''));
      }
    } catch (e) {
      console.warn("Could not get disk info via df command");
    }

    return NextResponse.json({
      success: true,
      data: {
        cpu: {
          model: cpuModel,
          cores: cpuCount,
          load: loadAvg
        },
        memory: {
          total: totalMem,
          used: usedMem,
          free: freeMem,
          percent: memUsagePercent
        },
        disk: {
          total: diskTotal,
          used: diskUsed,
          free: diskFree,
          percent: diskPercent
        },
        uptime: uptimeStr
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
