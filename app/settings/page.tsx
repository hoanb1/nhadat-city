'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { IconBrandGoogle } from '@tabler/icons-react';

type Tab = 'profile' | 'security' | 'notifications' | 'danger';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'profile',       label: 'Thông tin cá nhân',   icon: 'ti-user' },
  { id: 'security',      label: 'Bảo mật & Mật khẩu',  icon: 'ti-lock' },
  { id: 'notifications', label: 'Thông báo',             icon: 'ti-bell' },
  { id: 'danger',        label: 'Xóa tài khoản',         icon: 'ti-trash' },
];

function Alert({ type, text }: { type: string; text: string }) {
  if (!text) return null;
  return <div className={`py-2.5 px-3.5 rounded-lg text-[0.83rem] font-semibold ${type === 'success' ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>{text}</div>;
}

export default function SettingsPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('profile');

  // Profile
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [profileLoading, setProfileLoading] = useState(false);

  // Security
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });
  const [pwdLoading, setPwdLoading] = useState(false);

  // Notifications
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifSavedSearch, setNotifSavedSearch] = useState(true);
  const [notifPriceAlert, setNotifPriceAlert] = useState(true);
  const [notifMsg, setNotifMsg] = useState({ type: '', text: '' });

  // Danger
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login?callbackUrl=/settings');
    if (session?.user) {
      setName(session.user.name || '');
      setPhone((session.user as any).phone || '');
    }
  }, [status, session, router]);

  // ── Profile save ──
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg({ type: '', text: '' });
    try {
      const res = await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      });
      if (res.ok) {
        await update({ name });
        setProfileMsg({ type: 'success', text: 'Đã lưu thông tin cá nhân!' });
      } else {
        const j = await res.json();
        setProfileMsg({ type: 'error', text: j.error || 'Có lỗi xảy ra' });
      }
    } catch { setProfileMsg({ type: 'error', text: 'Lỗi kết nối' }); }
    finally { setProfileLoading(false); }
  };

  // ── Password change ──
  const handleChangePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) { setPwdMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp' }); return; }
    if (newPwd.length < 6) { setPwdMsg({ type: 'error', text: 'Mật khẩu ít nhất 6 ký tự' }); return; }
    setPwdLoading(true);
    setPwdMsg({ type: '', text: '' });
    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      const j = await res.json();
      if (j.success) {
        setPwdMsg({ type: 'success', text: 'Đã đổi mật khẩu thành công!' });
        setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      } else {
        setPwdMsg({ type: 'error', text: j.error || 'Có lỗi xảy ra' });
      }
    } catch { setPwdMsg({ type: 'error', text: 'Lỗi kết nối' }); }
    finally { setPwdLoading(false); }
  };

  // ── Save notifications ──
  const handleSaveNotif = async () => {
    setNotifMsg({ type: '', text: '' });
    try {
      await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifications: { email: notifEmail, savedSearch: notifSavedSearch, priceAlert: notifPriceAlert } }),
      });
      setNotifMsg({ type: 'success', text: 'Đã lưu cài đặt thông báo!' });
    } catch { setNotifMsg({ type: 'error', text: 'Lỗi kết nối' }); }
  };

  // ── Delete account ──
  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'XÓA TÀI KHOẢN') {
      setDeleteMsg({ type: 'error', text: 'Vui lòng nhập chính xác "XÓA TÀI KHOẢN"' }); return;
    }
    if (!confirm('Hành động này không thể khôi phục. Tiếp tục?')) return;
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/user/delete-account', { method: 'DELETE' });
      const j = await res.json();
      if (j.success) {
        await signOut({ callbackUrl: '/' });
      } else {
        setDeleteMsg({ type: 'error', text: j.error || 'Có lỗi xảy ra' });
      }
    } catch { setDeleteMsg({ type: 'error', text: 'Lỗi kết nối' }); }
    finally { setDeleteLoading(false); }
  };

  if (status === 'loading') return <div className="h-dvh flex items-center justify-center text-slate-500 font-semibold">Đang tải...</div>;

  return (
    <div className="min-h-dvh bg-slate-50 font-sans">
      <header className="bg-white border-b border-slate-200 py-3.5 px-6 sticky top-0 z-10">
        <div className="max-w-[1000px] mx-auto flex items-center gap-4">
          <Link href="/profile" className="text-slate-500 no-underline text-[0.88rem] font-semibold hover:text-blue-600">← Hồ sơ</Link>
          <h1 className="text-[1.1rem] font-extrabold text-slate-800 m-0">Cài đặt tài khoản</h1>
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto py-7 px-5 pb-15">
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-7">
          {/* Sidebar nav */}
          <aside className="hidden md:flex flex-col gap-1">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`flex items-center gap-2.5 py-2.5 px-3.5 border-none bg-transparent rounded-xl text-[0.88rem] font-semibold cursor-pointer transition-all duration-150 text-left w-full ${tab === t.id ? (t.id === 'danger' ? 'bg-red-50 text-red-600' : 'bg-white text-blue-600 shadow-[0_2px_8px_rgba(0,0,0,0.06)]') : (t.id === 'danger' ? 'text-red-500 hover:bg-slate-100 hover:text-red-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800')}`}
                onClick={() => setTab(t.id)}
              >
                <span className={`ti ${t.icon}`} />
                {t.label}
              </button>
            ))}
          </aside>

          {/* Mobile tab strip */}
          <div className="flex md:hidden col-span-full gap-1.5 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} className={`flex flex-col items-center gap-[3px] py-2 px-3 border-[1.5px] rounded-xl text-[0.7rem] font-bold cursor-pointer whitespace-nowrap min-w-[70px] ${tab === t.id ? (t.id === 'danger' ? 'bg-red-500 text-white border-red-500' : 'bg-blue-600 text-white border-blue-600') : 'bg-white text-slate-500 border-slate-200'}`} onClick={() => setTab(t.id)}>
                <span className={`ti ${t.icon}`} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="min-w-0">

            {/* ── Thông tin cá nhân ── */}
            {tab === 'profile' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-7">
                <h2 className="text-[1.1rem] font-extrabold text-slate-800 m-0 mb-1.5">Thông tin cá nhân</h2>
                <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 mt-5">
                  <Alert {...profileMsg} />

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[0.82rem] font-bold text-slate-700 flex items-center gap-2">Họ và tên</label>
                    <input className="py-2.5 px-3 border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300" value={name} onChange={e => setName(e.target.value)} placeholder="Nhập họ tên" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[0.82rem] font-bold text-slate-700 flex items-center gap-2">Email <span className="bg-slate-100 text-slate-400 text-[0.7rem] py-0.5 px-2 rounded-lg font-semibold">Không thể thay đổi</span></label>
                    <input className="py-2.5 px-3 border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit bg-slate-50 text-slate-400 cursor-not-allowed" value={session?.user?.email || ''} disabled />
                    <span className="text-[0.74rem] text-slate-400">Email được dùng để đăng nhập và nhận thông báo.</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[0.82rem] font-bold text-slate-700 flex items-center gap-2">Số điện thoại</label>
                    <input className="py-2.5 px-3 border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300" value={phone} onChange={e => setPhone(e.target.value)} placeholder="09xxxxxxxx" inputMode="tel" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[0.82rem] font-bold text-slate-700 flex items-center gap-2">Tài khoản liên kết</label>
                    <div className="flex items-center gap-3 py-3 px-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <IconBrandGoogle width="1em" height="1em" style={{ fontSize: '1.3rem', color: '#db4437' }}  />
                      <div>
                        <strong className="block text-[0.88rem] font-bold text-slate-800">Google</strong>
                        <span className="text-[0.75rem] text-green-600">{(session?.user as any)?.services?.google ? 'Đã liên kết' : 'Chưa liên kết'}</span>
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="py-2.5 px-5 bg-blue-600 text-white border-none rounded-lg text-[0.88rem] font-bold cursor-pointer transition-colors duration-200 self-start hover:not(:disabled):bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed" disabled={profileLoading}>
                    {profileLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </form>
              </div>
            )}

            {/* ── Bảo mật & Mật khẩu ── */}
            {tab === 'security' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-7">
                <h2 className="text-[1.1rem] font-extrabold text-slate-800 m-0 mb-1.5">Bảo mật & Mật khẩu</h2>
                <p className="text-[0.83rem] text-slate-500 m-0 mb-5">
                  {(session?.user as any)?.services?.google
                    ? 'Tài khoản của bạn đăng nhập qua Google. Đặt mật khẩu để có thêm tùy chọn đăng nhập.'
                    : 'Thay đổi mật khẩu đăng nhập của bạn.'
                  }
                </p>
                <form onSubmit={handleChangePwd} className="flex flex-col gap-4 mt-5">
                  <Alert {...pwdMsg} />

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[0.82rem] font-bold text-slate-700 flex items-center gap-2">Mật khẩu hiện tại</label>
                    <input className="py-2.5 px-3 border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300" type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} placeholder="Để trống nếu chưa có mật khẩu" autoComplete="current-password" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[0.82rem] font-bold text-slate-700 flex items-center gap-2">Mật khẩu mới *</label>
                    <input className="py-2.5 px-3 border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300" type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Ít nhất 6 ký tự" autoComplete="new-password" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[0.82rem] font-bold text-slate-700 flex items-center gap-2">Xác nhận mật khẩu *</label>
                    <input
                      className={`py-2.5 px-3 border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300 ${confirmPwd && confirmPwd !== newPwd ? '!border-red-300' : ''}`}
                      type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới" autoComplete="new-password"
                    />
                    {confirmPwd && confirmPwd !== newPwd && <span className="text-[0.74rem] text-red-500">Mật khẩu không khớp</span>}
                  </div>

                  <button type="submit" className="py-2.5 px-5 bg-blue-600 text-white border-none rounded-lg text-[0.88rem] font-bold cursor-pointer transition-colors duration-200 self-start hover:not(:disabled):bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed" disabled={pwdLoading}>
                    {pwdLoading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
                  </button>
                </form>
              </div>
            )}

            {/* ── Thông báo ── */}
            {tab === 'notifications' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-7">
                <h2 className="text-[1.1rem] font-extrabold text-slate-800 m-0 mb-1.5">Cài đặt thông báo</h2>
                <p className="text-[0.83rem] text-slate-500 m-0 mb-5">Chọn loại thông báo bạn muốn nhận.</p>
                <Alert {...notifMsg} />

                <div className="flex flex-col gap-0 mt-4 border border-slate-200 rounded-2xl overflow-hidden">
                  {[
                    { key: 'email', label: 'Thông báo qua Email', desc: 'Nhận email khi có tin tức mới phù hợp', state: notifEmail, set: setNotifEmail },
                    { key: 'search', label: 'Tìm kiếm đã lưu', desc: 'Thông báo khi có BDS mới khớp bộ lọc đã lưu', state: notifSavedSearch, set: setNotifSavedSearch },
                    { key: 'price', label: 'Cảnh báo giá', desc: 'Thông báo khi tin BDS đã lưu thay đổi giá', state: notifPriceAlert, set: setNotifPriceAlert },
                  ].map(n => (
                    <div key={n.key} className="flex items-center justify-between py-4 px-4.5 border-b border-slate-100 gap-4 last:border-b-0">
                      <div className="flex-1">
                        <strong className="block text-[0.88rem] font-bold text-slate-800 mb-1">{n.label}</strong>
                        <span className="text-[0.78rem] text-slate-500">{n.desc}</span>
                      </div>
                      <label className="relative w-11 h-6 shrink-0">
                        <input type="checkbox" checked={n.state} onChange={e => n.set(e.target.checked)} className="hidden peer" />
                        <span className="block w-11 h-6 rounded-full bg-slate-200 cursor-pointer transition-colors duration-200 relative peer-checked:bg-blue-600 after:content-[''] after:absolute after:w-5 after:h-5 after:rounded-full after:bg-white after:top-[2px] after:left-[2px] after:transition-all after:duration-200 after:shadow-[0_1px_3px_rgba(0,0,0,0.2)] peer-checked:after:left-[22px]" />
                      </label>
                    </div>
                  ))}
                </div>

                <button className="py-2.5 px-5 bg-blue-600 text-white border-none rounded-lg text-[0.88rem] font-bold cursor-pointer transition-colors duration-200 self-start hover:not(:disabled):bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed" style={{ marginTop: 24 }} onClick={handleSaveNotif}>
                  Lưu cài đặt
                </button>
              </div>
            )}

            {/* ── Xóa tài khoản ── */}
            {tab === 'danger' && (
              <div className="bg-white rounded-2xl border border-red-200 p-7">
                <h2 className="text-[1.1rem] font-extrabold text-red-600 m-0 mb-1.5">Xóa tài khoản</h2>
                <div className="bg-red-50 border border-red-200 rounded-xl py-4 px-4.5 mb-5">
                  <p className="m-0 mb-2 text-[0.88rem] text-red-800"><strong>Hành động này không thể hoàn tác.</strong></p>
                  <ul className="m-0 pl-4.5">
                    <li className="text-[0.82rem] text-red-700 mb-1">Toàn bộ thông tin cá nhân sẽ bị xóa vĩnh viễn</li>
                    <li className="text-[0.82rem] text-red-700 mb-1">Tất cả tin đăng của bạn sẽ bị ẩn khỏi hệ thống</li>
                    <li className="text-[0.82rem] text-red-700 mb-1">Bạn sẽ bị đăng xuất ngay lập tức</li>
                  </ul>
                </div>

                <Alert {...deleteMsg} />

                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.82rem] font-bold text-slate-700 flex items-center gap-2">Để xác nhận, hãy nhập: <code className="bg-red-50 text-red-600 py-0.5 px-1.5 rounded text-[0.85em]">XÓA TÀI KHOẢN</code></label>
                  <input
                    className="py-2.5 px-3 border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300"
                    value={deleteConfirm}
                    onChange={e => setDeleteConfirm(e.target.value)}
                    placeholder="XÓA TÀI KHOẢN"
                  />
                </div>

                <button
                  className="py-3 px-5 bg-red-600 text-white border-none rounded-lg text-[0.88rem] font-bold cursor-pointer mt-3 hover:not(:disabled):bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading || deleteConfirm !== 'XÓA TÀI KHOẢN'}
                >
                  {deleteLoading ? 'Đang xóa...' : 'Xóa tài khoản vĩnh viễn'}
                </button>
              </div>
            )}

          </div>
        </div>
      </main>

      
    </div>
  );
}
