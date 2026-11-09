import { sql } from '@/lib/db/pg';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const UPLOAD_BASE = '/DATA/nhadat/uploads/realEstate/public_webp';
const IMG_BASE = '/home/data/images/realEstate';

function generateId(len = 17) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function convertToWebp(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });
    const proc = spawn('convert', [inputPath, '-quality', '85', outputPath]);
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`convert failed: ${code}`)));
  });
}

/**
 * Download a remote image URL (e.g. Google avatar) to local storage,
 * create a RealEstateImages record, and return the image ID.
 * If the URL is already stored, returns the existing ID.
 */
export async function downloadAvatarToLocal(remoteUrl: string, userId: string): Promise<string | null> {
  if (!remoteUrl || remoteUrl.startsWith('/')) return null;

  try {
    // Check if already downloaded for this user (users.profile.avatarId; avoids scanning 6.5M image rows)
    const prior = await sql`
      SELECT profile->>'avatarId' AS avatar_id FROM users
      WHERE mongo_id = ${userId} OR (mongo_id IS NULL AND id::text = ${userId}) LIMIT 1`;
    if (prior[0]?.avatar_id) return String(prior[0].avatar_id);

    // Download the image
    const res = await fetch(remoteUrl, {
      headers: { 'User-Agent': 'NhaDat.City/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';

    const id = generateId();
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '/');

    // Save original
    const originalDir = path.join(IMG_BASE, dateStr);
    const originalPath = path.join(originalDir, `${id}.${ext}`);
    fs.mkdirSync(originalDir, { recursive: true });
    fs.writeFileSync(originalPath, buffer);

    // Convert to webp
    const webpDir = path.join(UPLOAD_BASE, dateStr);
    const webpPath = path.join(webpDir, `${id}.webp`);
    await convertToWebp(originalPath, webpPath);

    const webpStat = fs.statSync(webpPath);

    // Save record to real_estate_images
    await sql`
      INSERT INTO real_estate_images (
        mongo_id, name, ext, mime, size_bytes, path, original_path, original_width, original_height,
        preprocess_path, processed, source_url, user_mongo_id, upload_date, created_at, meta
      ) VALUES (
        ${id}, ${`avatar-${userId}.${ext}`}, ${ext}, ${contentType}, ${buffer.length}, ${originalPath},
        ${webpPath}, 200, 200, ${originalPath}, TRUE, ${remoteUrl}, ${userId}, ${now.toISOString().slice(0, 10)},
        ${now},
        ${sql.json({
          avatarUserId: userId,
          extension: ext,
          extensionWithDot: `.${ext}`,
          type: contentType,
          isImage: true,
          versions: {
            original: { path: webpPath, size: webpStat.size, type: 'image/webp', extension: 'webp', width: 200, height: 200 },
            preprocess: { path: originalPath, size: buffer.length, type: contentType, extension: ext },
          },
        })}
      )
      ON CONFLICT (mongo_id) DO NOTHING`;

    // Update user profile.avatar to local image ID
    await sql`
      UPDATE users SET profile = profile || ${sql.json({ avatarId: id, avatarCached: true })}, updated_at = NOW()
      WHERE mongo_id = ${userId} OR (mongo_id IS NULL AND id::text = ${userId})`;

    return id;
  } catch (err) {
    console.error('[avatar] download error:', err);
    return null;
  }
}

/**
 * Get the local CDN URL for an avatar.
 * Falls back to the original remote URL if not yet cached.
 */
export function getAvatarUrl(avatarId: string | null | undefined, fallbackUrl?: string | null): string {
  if (avatarId) {
    return `/api/image-api/v1/200/200/${avatarId}.webp`;
  }
  return fallbackUrl || '';
}
