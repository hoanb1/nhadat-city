'use client';

// Homepage error boundary — catches WebGL/MapLibre initialization failures
// in headless browsers (Googlebot, Lighthouse, screenshot tools)
export default function HomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 520, textAlign: 'center', padding: '2rem' }}>
        <h1 style={{ color: '#1e293b', fontSize: '1.4rem', marginBottom: '0.75rem' }}>
          Bản đồ bất động sản NhaDat.City
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          Trình duyệt không hỗ trợ bản đồ 3D (WebGL). Vui lòng thử Chrome, Firefox hoặc Edge phiên bản mới nhất.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <a href="/thong-ke" style={{ padding: '0.5rem 1rem', background: '#4f46e5', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontSize: '0.85rem' }}>
            Thống kê thị trường
          </a>
          <a href="/about" style={{ padding: '0.5rem 1rem', border: '1px solid #4f46e5', color: '#4f46e5', textDecoration: 'none', borderRadius: '8px', fontSize: '0.85rem' }}>
            Về NhaDat.City
          </a>
        </div>
        <button
          onClick={reset}
          style={{ background: 'none', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', color: '#64748b', fontSize: '0.8rem' }}
        >
          Thử lại bản đồ
        </button>
      </div>
    </main>
  );
}
