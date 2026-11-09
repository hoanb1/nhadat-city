import { NextResponse } from 'next/server';

// IndexNow Key File Serve
// Reference: https://www.indexnow.org/documentation
// Key used for nhadat.city — must match content of /indexnow-key.txt
export const dynamic = 'force-static';

export function GET() {
  const key = process.env.INDEXNOW_KEY || '';
  return new NextResponse(key, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
