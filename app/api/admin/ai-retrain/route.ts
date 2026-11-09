import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { exec } from 'child_process';
import path from 'path';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    // Execute the bash script asynchronously
    const scriptPath = path.join(process.cwd(), 'nhadat-ml', 'retrain.sh');
    
    // We execute it in the background to prevent API timeout
    exec(`bash ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`AI Retrain Error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`AI Retrain Stderr: ${stderr}`);
        return;
      }
      console.log(`AI Retrain Output: ${stdout}`);
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Lệnh huấn luyện AI đã được kích hoạt chạy ngầm. Vui lòng đợi 1-2 phút để hệ thống hoàn tất.' 
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
