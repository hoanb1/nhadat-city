import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { Readable } from 'stream';
import { IMAGE_CONFIG } from '@/lib/config/image';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function streamToBuffer(stream: fs.ReadStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const _buf = Array<any>();
    stream.on('data', chunk => _buf.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(_buf)));
    stream.on('error', err => reject(`error converting stream - ${err}`));
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ width: string; height: string; id: string }> }
) {
  try {
    const params = await context.params;
    const width = parseInt(params.width, 10);
    const height = parseInt(params.height, 10);
    let imageId = params.id;

    // Parse .webp extension
    const match = imageId.match(/^([a-zA-Z0-9_-]+)\.webp$/);
    if (!match) {
      return new NextResponse('Invalid image ID format', { status: 400 });
    }
    imageId = match[1];

    if (isNaN(width) || isNaN(height) || width < 10 || width > 2048 || height < 10 || height > 2048) {
      return new NextResponse('Invalid width or height', { status: 400 });
    }

    const rows = await sql`
      SELECT original_path FROM real_estate_images WHERE mongo_id = ${imageId} LIMIT 1`;
    const originalPath: string | null | undefined = rows[0]?.original_path;

    if (!originalPath) {
      return new NextResponse('Image not found', { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    if (!fs.existsSync(originalPath)) {
      return new NextResponse('Original image file missing', { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    return new Promise<NextResponse>((resolve) => {
      const convert = spawn('convert', [
        originalPath,
        '-resize', `${width}x${height}^`,
        '-gravity', 'center',
        '-extent', `${width}x${height}`,
        '-strip',
        '-quality', String(IMAGE_CONFIG.QUALITY),
        'webp:-'
      ]);

      const chunks: Buffer[] = [];
      const stderr: Buffer[] = [];
      
      convert.stdout.on('data', data => chunks.push(data));
      convert.stderr.on('data', data => stderr.push(data));

      convert.on('close', async code => {
        if (code !== 0) {
          console.error(`Convert failed for thumbnail: ${Buffer.concat(stderr).toString()}`);
          resolve(new NextResponse('Error generating thumbnail', { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }));
        } else {
          const buffer = Buffer.concat(chunks);
          resolve(new NextResponse(buffer as any, {
            status: 200,
            headers: {
              'Content-Type': 'image/webp',
              'Cache-Control': 'public, max-age=31536000, immutable',
              'Access-Control-Allow-Origin': '*'
            }
          }));
        }
      });
    });

  } catch (error) {
    console.error(`Image API error:`, error);
    return new NextResponse('Internal server error', { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
