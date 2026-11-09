'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { IconArrowLeft, IconMail, IconLock, IconBrandGoogle } from '@tabler/icons-react';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        setError('Email hoặc mật khẩu không chính xác');
      } else {
        router.push(callbackUrl);
      }
    } catch (err) {
      setError('Đã xảy ra lỗi, vui lòng thử lại sau');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl });
  };

  return (
    <div className="w-full max-w-[420px] bg-white/95 backdrop-blur-[10px] rounded-3xl p-10 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/80 animate-[slideUp_0.6s_ease-out]">
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-[0.9rem] text-slate-500 mb-6 transition-colors duration-200 hover:text-blue-600">
          <IconArrowLeft width="1em" height="1em"  /> Quay lại
        </Link>
        <h1 className="text-[1.75rem] font-extrabold text-slate-800 mb-3 tracking-tight">Chào mừng trở lại</h1>
        <p className="text-slate-500 text-[0.95rem] leading-relaxed">Đăng nhập để quản lý tin đăng và cài đặt cá nhân</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-[0.9rem] text-center border border-red-100">{error}</div>}

        <div className="flex flex-col gap-2">
          <label className="text-[0.875rem] font-semibold text-slate-600" htmlFor="email">Email</label>
          <div className="relative flex items-center">
            <IconMail width="1em" height="1em" className="absolute left-3.5 text-slate-400 text-[1.1rem]"  />
            <input
              type="email"
              id="email"
              className="w-full py-3 pr-3 pl-[42px] border-[1.5px] border-slate-200 rounded-xl text-[1rem] transition-all duration-200 bg-white focus:outline-none focus:border-blue-600 focus:shadow-[0_0_0_4px_rgba(37,99,235,0.1)]"
              placeholder="ten@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[0.875rem] font-semibold text-slate-600" htmlFor="password">Mật khẩu</label>
          <div className="relative flex items-center">
            <IconLock width="1em" height="1em" className="absolute left-3.5 text-slate-400 text-[1.1rem]"  />
            <input
              type="password"
              id="password"
              className="w-full py-3 pr-3 pl-[42px] border-[1.5px] border-slate-200 rounded-xl text-[1rem] transition-all duration-200 bg-white focus:outline-none focus:border-blue-600 focus:shadow-[0_0_0_4px_rgba(37,99,235,0.1)]"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="flex justify-between items-center text-[0.875rem]">
          <label className="flex items-center gap-2 cursor-pointer text-slate-500 font-normal">
            <input type="checkbox" className="w-auto p-0" />
            <span>Ghi nhớ đăng nhập</span>
          </label>
          <Link href="/forgot-password" className="text-blue-600 font-semibold">Quên mật khẩu?</Link>
        </div>

        <button type="submit" className="p-3.5 bg-blue-600 text-white border-none rounded-xl font-bold text-[1rem] cursor-pointer transition-all duration-200 mt-2 hover:bg-blue-700 hover:-translate-y-[1px] hover:shadow-[0_4px_12px_rgba(37,99,235,0.2)] disabled:opacity-70 disabled:cursor-not-allowed" disabled={loading}>
          {loading ? 'Đang xử lý...' : 'Đăng nhập'}
        </button>

        <div className="flex items-center gap-3 my-3 text-slate-400 text-[0.85rem] before:content-[''] before:flex-1 before:h-[1px] before:bg-slate-200 after:content-[''] after:flex-1 after:h-[1px] after:bg-slate-200">
          <span>Hoặc đăng nhập với</span>
        </div>

        <button
          type="button"
          className="flex items-center justify-center gap-2.5 p-3 bg-white border-[1.5px] border-slate-200 rounded-xl text-slate-800 font-semibold cursor-pointer transition-all duration-200 hover:bg-slate-50 hover:border-slate-300"
          onClick={handleGoogleSignIn}
        >
          <IconBrandGoogle width="1em" height="1em"  /> Google
        </button>
      </form>

      <div className="mt-8 text-center text-[0.95rem] text-slate-500">
        <p className="m-0">
          Chưa có tài khoản? <Link href="/register" className="text-blue-600 font-bold">Đăng ký ngay</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 p-5 font-sans">
      <Suspense fallback={<div className="text-slate-500 font-semibold">Đang tải...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
