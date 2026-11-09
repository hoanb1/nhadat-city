import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { verifyAdminAuth, unauthorizedResponse } from '@/lib/adminAuth';
import { and, escapeLike } from '@/lib/db/pgUtil';
import { pageParams } from '@/lib/db/repo/adminCommon';
import { userOut } from '@/lib/db/repo/adminUsers';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const ADMIN_ROLES = ['admin', 'super-admin'];

export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(req.url);
    const { page, limit, offset } = pageParams(searchParams, 20);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';

    const conds = [];

    if (search) {
      const pat = `%${escapeLike(search)}%`;
      conds.push(sql`(
        name ILIKE ${pat}
        OR username::text ILIKE ${pat}
        OR EXISTS (SELECT 1 FROM unnest(emails) e WHERE e::text ILIKE ${pat})
      )`);
    }

    if (role && role !== 'all') {
      if (role === 'admin') {
        conds.push(sql`roles && ${ADMIN_ROLES}::text[]`);
      } else {
        conds.push(sql`NOT (roles && ${ADMIN_ROLES}::text[])`);
      }
    }
    const where = and(conds);

    const [rows, [cnt]] = await Promise.all([
      sql`
        SELECT id, mongo_id, username::text AS username, email::text AS email, email_verified,
               emails::text[] AS emails, name, phone, address, avatar_url, roles, profile, created_at
        FROM users WHERE ${where}
        ORDER BY created_at DESC
        OFFSET ${offset} LIMIT ${limit}`,
      sql`SELECT count(*)::float8 AS n FROM users WHERE ${where}`,
    ]);
    const users = rows.map(userOut);
    const total = Number(cnt.n);

    return NextResponse.json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!verifyAdminAuth(req)) return unauthorizedResponse();

  try {
    const body = await req.json();
    const { email, password, name, role } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email và mật khẩu là bắt buộc' }, { status: 400 });
    }

    const emailLc = String(email).toLowerCase();
    const [existing] = await sql`
      SELECT id FROM users WHERE email = ${emailLc}::citext OR ${emailLc}::citext = ANY(emails) LIMIT 1`;

    if (existing) {
      return NextResponse.json({ success: false, message: 'Email đã tồn tại' }, { status: 400 });
    }

    // Meteor-compatible password hashing
    const sha256Password = crypto.createHash("sha256").update(password).digest("hex");
    const hash = bcrypt.hashSync(sha256Password, 10);

    const roles = role === 'admin' ? ['admin'] : ['user'];
    const displayName = name || emailLc.split('@')[0];
    const createdAt = new Date();

    const [row] = await sql`
      INSERT INTO users (email, email_verified, emails, password_hash, name, roles, created_at)
      VALUES (${emailLc}::citext, TRUE, ARRAY[${emailLc}]::citext[], ${hash}, ${displayName}, ${roles}::text[], ${createdAt})
      RETURNING id, mongo_id`;

    return NextResponse.json({
      success: true,
      data: {
        _id: row.mongo_id ?? String(row.id),
        createdAt,
        emails: [{ address: emailLc, verified: true }],
        profile: { name: displayName },
        roles,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
