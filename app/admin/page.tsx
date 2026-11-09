import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import AIRetrainButton from "@/components/admin/AIRetrainButton";

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/api/auth/signin?callbackUrl=/admin");
  }

  // Chặn người dùng thường
  if ((session.user as any).role !== "admin") {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Truy cập bị từ chối</h1>
        <p>Tài khoản của bạn không có quyền truy cập trang quản trị.</p>
        <p className="mt-4 text-gray-500">Đăng nhập với email: {session.user.email}</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <header style={{ backgroundColor: '#1e293b', color: 'white', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Dashboard Quản Trị - NhaDat.City</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>Xin chào, {session.user.name || session.user.email}</span>
          <a href="/api/auth/signout" style={{ background: '#ef4444', color: 'white', padding: '6px 12px', borderRadius: '4px', textDecoration: 'none', fontSize: '0.9rem' }}>Đăng xuất</a>
        </div>
      </header>
      
      <main style={{ padding: '32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0, color: '#334155', fontSize: '1.25rem' }}>Quản lý tin đăng</h2>
          <p style={{ color: '#64748b' }}>Tính năng sẽ sớm được cập nhật trên nền tảng Next.js</p>
          <button style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'not-allowed', opacity: 0.7, marginTop: '16px' }} disabled>Thêm tin mới</button>
        </div>
        
        <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0, color: '#334155', fontSize: '1.25rem' }}>Quản lý người dùng</h2>
          <p style={{ color: '#64748b' }}>Tính năng sẽ sớm được cập nhật</p>
        </div>

        <div style={{ background: '#fff1f2', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #fecdd3' }}>
          <h2 style={{ marginTop: 0, color: '#e11d48', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Hệ thống Kiểm duyệt AI (Anomaly)
          </h2>
          <p style={{ color: '#be123c', fontSize: '0.95rem' }}>
            AI đang quét liên tục các tin đăng để phát hiện rác/giá ảo. 
            Khi có danh sách tin đăng, hệ thống sẽ tự động bôi đỏ các tin có điểm tin cậy &lt; -0.45.
          </p>
          <div style={{ background: '#ffe4e6', color: '#9f1239', padding: '12px', borderRadius: '6px', fontSize: '0.85rem', marginTop: '12px', fontWeight: 'bold' }}>
            Trạng thái mô hình ML: Đang hoạt động (PM2)
            <br/>
            Lịch tự động: 5:00 AM hằng ngày
          </div>
          <AIRetrainButton />
        </div>
      </main>
    </div>
  );
}
