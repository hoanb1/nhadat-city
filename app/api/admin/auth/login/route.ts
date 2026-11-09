import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/adminAuth';


export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Thiếu email hoặc mật khẩu' }, { status: 400 });
    }

    const emailLc = String(email).toLowerCase();
    const [user] = await sql`
      SELECT id, mongo_id, username, name, password_hash, roles
      FROM users
      WHERE email = ${emailLc}::citext OR ${emailLc}::citext = ANY(emails)
      LIMIT 1`;

    if (!user || !user.password_hash) {
      return NextResponse.json({ success: false, message: 'Sai thông tin đăng nhập' }, { status: 401 });
    }

    const meteorBcryptHash = user.password_hash as string;
    const sha256Password = crypto.createHash("sha256").update(password).digest("hex");
    const isValid = bcrypt.compareSync(sha256Password, meteorBcryptHash);

    if (!isValid) {
      return NextResponse.json({ success: false, message: 'Sai thông tin đăng nhập' }, { status: 401 });
    }

    // Check admin role
    const userId: string = user.mongo_id ?? String(user.id);
    const isAdmin = user.roles && (user.roles.includes("admin") || user.roles.includes("super-admin"));
    if (!isAdmin) {
      return NextResponse.json({ success: false, message: 'Bạn không có quyền truy cập Admin' }, { status: 403 });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: userId, email: email, role: 'admin' },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      success: true,
      data: {
        token,
        user: {
          id: userId,
          name: user.name || user.username || email,
          email: email
        }
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
