'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';
import Image from 'next/image';
import { IconLogout, IconCamera, IconNews, IconHeart, IconEye, IconPlus, IconList, IconSettings, IconHelp, IconMessages } from '@tabler/icons-react';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/profile');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <div className="h-dvh flex items-center justify-center font-semibold text-slate-500">Đang tải...</div>;
  }

  if (!session) return null;

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  return (
    <div className="min-h-dvh bg-slate-50 font-sans">
      <header className="bg-white border-b border-slate-200 py-4 px-6 sticky top-0 z-10">
        <div className="max-w-[1000px] mx-auto flex justify-between items-center">
          <Link href="/" className="font-extrabold text-[1.25rem] text-blue-600 no-underline">NhaDat.City</Link>
          <button onClick={handleSignOut} className="flex items-center gap-[6px] py-2 px-4 border-[1.5px] border-slate-200 rounded-lg bg-white text-slate-500 font-semibold cursor-pointer transition-all duration-200 hover:text-red-600 hover:border-red-200 hover:bg-red-50">
            <IconLogout width="1em" height="1em"  /> Đăng xuất
          </button>
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto py-8 px-6">
        <div className="bg-white rounded-3xl p-10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-200 mb-8">
          <div className="flex flex-col md:flex-row items-center text-center md:text-left gap-8 relative">
            <div className="relative">
              {session.user?.image ? (
                <Image
                  src={session.user.image}
                  alt={session.user.name || 'Avatar'}
                  width={120}
                  height={120}
                  className="w-[120px] h-[120px] rounded-full object-cover border-4 border-white shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
                  unoptimized // Use unoptimized for external auth avatars to avoid next.config domain errors
                />
              ) : (
                <div className="w-[120px] h-[120px] rounded-full object-cover border-4 border-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] bg-gradient-to-br from-blue-600 to-blue-700 text-white flex items-center justify-center text-[3rem] font-bold">
                  {session.user?.name?.charAt(0) || 'U'}
                </div>
              )}
              <button className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.1)] text-slate-500">
                <IconCamera width="1em" height="1em"  />
              </button>
            </div>
            <div className="flex-1">
              <h1 className="text-[2rem] font-extrabold text-slate-800 mb-1 tracking-tight">{session.user?.name}</h1>
              <p className="text-slate-500 text-[1.1rem] mb-4">{session.user?.email}</p>
              <div className="flex gap-2 justify-center md:justify-start">
                <span className="py-1 px-3 bg-slate-100 text-slate-600 rounded-full text-[0.8rem] font-semibold">Thành viên</span>
                {(session.user as any).role === 'admin' && (
                  <span className="py-1 px-3 bg-blue-50 text-blue-600 rounded-full text-[0.8rem] font-semibold">Quản trị viên</span>
                )}
              </div>
            </div>
            <Link href="/settings" className="py-2.5 px-5 bg-slate-50 border-[1.5px] border-slate-200 rounded-xl text-slate-800 font-bold no-underline transition-all duration-200 hover:bg-white hover:border-slate-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)] w-full md:w-auto text-center">
              Sửa hồ sơ
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-8">
          <section className="">
            <h2 className="text-[1.25rem] font-bold text-slate-800 mb-5">Hoạt động của bạn</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="bg-white p-6 rounded-[20px] border border-slate-200 flex flex-col gap-4">
                <IconNews width="1em" height="1em" className="text-[1.5rem] text-blue-600 bg-blue-50 w-11 h-11 rounded-xl flex items-center justify-center"  />
                <div className="">
                  <span className="block text-[1.5rem] font-extrabold text-slate-800">0</span>
                  <span className="text-[0.9rem] text-slate-500 font-medium">Tin đã đăng</span>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[20px] border border-slate-200 flex flex-col gap-4">
                <IconHeart width="1em" height="1em" className="text-[1.5rem] text-blue-600 bg-blue-50 w-11 h-11 rounded-xl flex items-center justify-center"  />
                <div className="">
                  <span className="block text-[1.5rem] font-extrabold text-slate-800">0</span>
                  <span className="text-[0.9rem] text-slate-500 font-medium">Tin đã lưu</span>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[20px] border border-slate-200 flex flex-col gap-4">
                <IconEye width="1em" height="1em" className="text-[1.5rem] text-blue-600 bg-blue-50 w-11 h-11 rounded-xl flex items-center justify-center"  />
                <div className="">
                  <span className="block text-[1.5rem] font-extrabold text-slate-800">0</span>
                  <span className="text-[0.9rem] text-slate-500 font-medium">Lượt xem tin</span>
                </div>
              </div>
            </div>
          </section>

          <section className="">
            <h2 className="text-[1.25rem] font-bold text-slate-800 mb-5">Phím tắt</h2>
            <div className="flex flex-col gap-3">
              <Link href="/post" className="flex items-center gap-3 py-[14px] px-[18px] bg-white border border-slate-200 rounded-2xl text-slate-600 font-semibold no-underline transition-all duration-200 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 hover:translate-x-1">
                <IconPlus width="1em" height="1em"  /> Đăng tin mới
              </Link>
              <Link href="/manage-listings" className="flex items-center gap-3 py-[14px] px-[18px] bg-white border border-slate-200 rounded-2xl text-slate-600 font-semibold no-underline transition-all duration-200 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 hover:translate-x-1">
                <IconList width="1em" height="1em"  /> Quản lý tin đăng
              </Link>
              <Link href="/profile/chats" className="flex items-center gap-3 py-[14px] px-[18px] bg-white border border-slate-200 rounded-2xl text-slate-600 font-semibold no-underline transition-all duration-200 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 hover:translate-x-1">
                <IconMessages width="1em" height="1em"  /> Lịch sử tư vấn AI
              </Link>
              <Link href="/settings" className="flex items-center gap-3 py-[14px] px-[18px] bg-white border border-slate-200 rounded-2xl text-slate-600 font-semibold no-underline transition-all duration-200 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 hover:translate-x-1">
                <IconSettings width="1em" height="1em"  /> Cài đặt tài khoản
              </Link>
              <Link href="/help" className="flex items-center gap-3 py-[14px] px-[18px] bg-white border border-slate-200 rounded-2xl text-slate-600 font-semibold no-underline transition-all duration-200 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 hover:translate-x-1">
                <IconHelp width="1em" height="1em"  /> Trung tâm trợ giúp
              </Link>
            </div>
          </section>
        </div>
      </main>

      
    </div>
  );
}
