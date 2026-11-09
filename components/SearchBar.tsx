'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SearchBar({ initialProvince, initialWard }: { initialProvince?: string; initialWard?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    
    // Giả lập logic tìm kiếm - Trong thực tế sẽ gọi API auto-suggest hoặc redirect sang trang search tổng
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="w-full max-w-[600px] mx-auto">
      <form onSubmit={handleSearch} className="flex items-center bg-slate-50 rounded-sm px-3.5 py-1.5 border border-slate-200 transition-all duration-200 focus-within:border-indigo-600 focus-within:shadow-[0_0_0_2px_rgba(79,70,229,0.15)] focus-within:bg-white group">
        <input 
          type="text" 
          placeholder="Tìm kiếm khu vực, dự án, đường..." 
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="flex-1 border-none bg-transparent py-1.5 px-0 text-[0.95rem] outline-none text-slate-900 placeholder-slate-400"
        />
        <button type="submit" className="bg-transparent border-none text-slate-400 cursor-pointer p-1.5 flex items-center justify-center transition-colors group-focus-within:text-indigo-600 hover:text-indigo-600" aria-label="Tìm kiếm">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </button>
      </form>
    </div>
  );
}
