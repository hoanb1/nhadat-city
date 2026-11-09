import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { sql } from '@/lib/db/pg';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import crypto from 'crypto';

export const runtime = 'nodejs';
// Allow large image uploads
export const maxDuration = 30;

const BASE_UPLOAD_DIR = '/DATA/nhadat/uploads/realEstate/public_webp';
const BASE_PREPROCESS_DIR = '/home/data/images/realEstate';

function randomId(len = 17) {
  return crypto.randomBytes(Math.ceil(len * 3 / 4)).toString('base64url').slice(0, len);
}

function datePath() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function convertToWebp(src: string, dest: string, width = 1280, quality = 82): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [src, '-resize', `${width}x${width}>`, '-strip', '-quality', String(quality), dest];
    const proc = spawn('convert', args, { timeout: 20000 });
    const errs: Buffer[] = [];
    proc.stderr.on('data', d => errs.push(d));
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`ImageMagick exit ${code}: ${Buffer.concat(errs).toString()}`));
    });
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as any).id || (session.user as any)._id || '';
  const formData = await req.formData();
  const files = formData.getAll('images') as File[];

  if (!files.length) return NextResponse.json({ error: 'No files' }, { status: 400 });
  if (files.length > 20) return NextResponse.json({ error: 'Tối đa 20 ảnh' }, { status: 400 });

  const dp = datePath();
  const preprocessDir = join(BASE_PREPROCESS_DIR, dp);
  const webpDir = join(BASE_UPLOAD_DIR, dp);

  await mkdir(preprocessDir, { recursive: true });
  await mkdir(webpDir, { recursive: true });

  const results: { id: string; url: string }[] = [];

  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    if (file.size > 20 * 1024 * 1024) continue; // skip > 20MB

    const id = randomId();
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const srcPath = join(preprocessDir, `${id}.${ext}`);
    const webpPath = join(webpDir, `${id}.webp`);

    // Write original
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(srcPath, buf);

    // Convert to webp
    await convertToWebp(srcPath, webpPath);

    const webpStat = existsSync(webpPath) ? (await import('fs')).statSync(webpPath).size : buf.length;

    // Insert DB record matching existing schema
    const uploadDate = new Date().toISOString().slice(0, 10);
    await sql`
      INSERT INTO real_estate_images (
        mongo_id, name, ext, mime, size_bytes, path, original_path, preprocess_path,
        processed, source_url, user_mongo_id, upload_date, created_at, meta
      ) VALUES (
        ${id}, ${file.name || `${id}.${ext}`}, ${ext}, ${file.type}, ${buf.length}, ${srcPath}, ${webpPath},
        ${srcPath}, TRUE, 'user-upload', ${String(userId)}, ${uploadDate}, NOW(),
        ${sql.json({
          extension: ext,
          extensionWithDot: `.${ext}`,
          type: file.type,
          versions: {
            original: { path: webpPath, size: webpStat, type: 'image/webp', extension: 'webp' },
            preprocess: { path: srcPath, size: buf.length, type: file.type, extension: ext },
          },
        })}
      )`;

    results.push({
      id,
      url: `/api/image-api/v1/800/600/${id}.webp`,
    });
  }

  return NextResponse.json({ success: true, images: results });
}
