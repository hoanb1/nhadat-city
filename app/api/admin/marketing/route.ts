import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { outRow } from '@/lib/db/repo/adminCommon';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { sendPushNotification } from '@/lib/pushManager';
import { sendEmail } from '@/lib/mailer';

export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const rows = await sql`SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50`;
    const notifications = rows.map((r) => {
      const o = outRow(r);
      if (o.title === undefined && r.subject != null) o.title = r.subject;
      return o;
    });

    return NextResponse.json({ success: true, data: { notifications } });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const body = await req.json();
    const { title, content, targetAudience, link } = body;
    
    if (!title || !content) {
      return NextResponse.json({ success: false, message: 'Thiếu tiêu đề hoặc nội dung' }, { status: 400 });
    }

    const notification = {
      title,
      content,
      targetAudience: targetAudience || 'all',
      link: link || null,
      createdAt: new Date(),
      isRead: false,
      type: 'marketing'
    };

    const [inserted] = await sql`
      INSERT INTO notifications (subject, content, email_sent, created_at, extra)
      VALUES (${title}, ${content}, FALSE, ${notification.createdAt},
              ${sql.json({ title, targetAudience: notification.targetAudience, link: notification.link, isRead: false, type: 'marketing' })})
      RETURNING id, mongo_id`;

    // Bắn WebPush & Email song song ngầm
    // Trong thực tế, dùng Queue/Job worker (như BullMQ) để gửi hàng loạt.
    // Ở đây ta gửi mô phỏng cho người dùng gần đây nhất.
    const pushPayload = {
      title,
      body: content,
      url: link || '/',
      icon: '/logo.png'
    };

    // Lấy danh sách email/user để gửi (Mô phỏng 50 user gần nhất cho an toàn)
    const roleFilter = targetAudience === 'brokers' ? sql`WHERE 'broker' = ANY(roles)`
      : targetAudience === 'users' ? sql`WHERE 'user' = ANY(roles)`
      : sql``;

    const users = await sql`
      SELECT id, mongo_id, email FROM users ${roleFilter}
      ORDER BY created_at DESC LIMIT 50`;

    users.forEach(user => {
      // 1. Send Push
      {
        sendPushNotification(user.mongo_id ?? String(user.id), pushPayload).catch(console.error);
        sendPushNotification(user.email, pushPayload).catch(console.error); // Fallback to email ID
      }
      
      // 2. Send Email
      if (user.email) {
        const html = `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #4f46e5;">${title}</h2>
            <p style="font-size: 16px; color: #333;">${content}</p>
            ${link ? `<a href="${link}" style="display: inline-block; padding: 10px 20px; background: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px;">Xem chi tiết</a>` : ''}
            <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
            <p style="font-size: 12px; color: #999;">Bạn nhận được email này vì đã đăng ký tài khoản tại NhaDat.City.</p>
          </div>
        `;
        sendEmail(user.email, title, html).catch(console.error);
      }
    });

    return NextResponse.json({ success: true, message: 'Đã tạo chiến dịch thông báo', notification: { ...notification, _id: inserted.mongo_id ?? String(inserted.id) } });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
