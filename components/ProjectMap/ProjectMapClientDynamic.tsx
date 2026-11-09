'use client';

import dynamic from 'next/dynamic';

const ProjectMapClientDynamic = dynamic(() => import('./ProjectMapClient'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-400">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">Đang tải bản đồ dự án...</span>
      </div>
    </div>
  ),
});

export default ProjectMapClientDynamic;
