'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <html lang="vi">
      <head>
        <title>Bản đồ quy hoạch &amp; mua bán nhà đất toàn quốc | NhaDat.City</title>
        <meta name="description" content="Nền tảng bất động sản thông minh: xem bản đồ quy hoạch, giá nhà, hơn 1 triệu tin đăng chính chủ toàn quốc, cập nhật 24/7." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
      </head>
      <body style={{ margin: 0, fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <div style={{ maxWidth: 600, margin: '80px auto', padding: '2rem', textAlign: 'center' }}>
          <h1 style={{ color: '#1e293b', fontSize: '1.5rem', marginBottom: '1rem' }}>
            NhaDat.City
          </h1>
          <p style={{ color: '#64748b', marginBottom: '2rem' }}>
            Trình duyệt không hỗ trợ bản đồ 3D. Vui lòng thử trình duyệt khác hoặc bật WebGL.
          </p>
          <nav style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/thong-ke" style={{ color: '#4f46e5', textDecoration: 'none', padding: '0.5rem 1rem', border: '1px solid #4f46e5', borderRadius: '8px' }}>
              Thống kê thị trường
            </a>
            <a href="/about" style={{ color: '#4f46e5', textDecoration: 'none', padding: '0.5rem 1rem', border: '1px solid #4f46e5', borderRadius: '8px' }}>
              Về NhaDat.City
            </a>
            <a href="/contact" style={{ color: '#4f46e5', textDecoration: 'none', padding: '0.5rem 1rem', border: '1px solid #4f46e5', borderRadius: '8px' }}>
              Liên hệ
            </a>
          </nav>
          <button
            onClick={reset}
            style={{ marginTop: '1.5rem', background: '#4f46e5', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Thử lại
          </button>
        </div>
      </body>
    </html>
  );
}
