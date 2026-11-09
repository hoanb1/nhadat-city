'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IconArrowLeft, IconTrash, IconEye, IconMessage, IconX, IconSparkles } from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatHistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingSession, setViewingSession] = useState<any | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/profile/chats');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchSessions();
    }
  }, [session]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/chat-sessions');
      const data = await res.json();
      if (data.success) {
        setSessions(data.data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa lịch sử trò chuyện này?')) return;
    
    try {
      const res = await fetch(`/api/user/chat-sessions/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setSessions(sessions.filter(s => s._id !== id));
        if (viewingSession?._id === id) {
          setViewingSession(null);
        }
      } else {
        alert('Có lỗi xảy ra: ' + data.error);
      }
    } catch (e) {
      console.error(e);
      alert('Có lỗi xảy ra khi xóa.');
    }
  };

  const handleView = async (id: string) => {
    try {
      const res = await fetch(`/api/user/chat-sessions/${id}`);
      const data = await res.json();
      if (data.success) {
        setViewingSession(data.data);
      }
    } catch (e) {
      console.error(e);
      alert('Có lỗi xảy ra khi tải nội dung.');
    }
  };

  if (status === 'loading' || loading) {
    return <div className="min-h-dvh flex items-center justify-center font-semibold text-slate-500 bg-slate-50">Đang tải...</div>;
  }

  if (!session) return null;

  return (
    <div className="min-h-dvh bg-slate-50 font-sans pb-10">
      <header className="bg-white border-b border-slate-200 py-4 px-6 sticky top-0 z-10 shadow-sm">
        <div className="max-w-[1000px] mx-auto flex justify-between items-center">
          <Link href="/profile" className="flex items-center gap-2 text-slate-600 hover:text-blue-600 font-semibold transition-colors">
            <IconArrowLeft size={20} /> Quay lại Hồ sơ
          </Link>
          <span className="font-extrabold text-[1.25rem] text-slate-800">Lịch sử tư vấn AI</span>
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto py-8 px-6">
        {sessions.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center shadow-sm border border-slate-200">
            <IconMessage size={48} className="mx-auto text-slate-300 mb-4" />
            <h2 className="text-xl font-bold text-slate-700 mb-2">Chưa có cuộc trò chuyện nào</h2>
            <p className="text-slate-500 mb-6">Bạn chưa nhờ AI tư vấn hoặc đã xóa hết lịch sử chat.</p>
            <Link href="/" className="inline-flex py-2 px-6 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">
              Trải nghiệm ngay
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map(s => (
              <div key={s._id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 line-clamp-2 mb-2" title={s.title}>{s.title}</h3>
                  <p className="text-[0.8rem] text-slate-500 mb-4">
                    {new Date(s.updatedAt).toLocaleString('vi-VN')}
                  </p>
                </div>
                <div className="flex gap-2 border-t border-slate-100 pt-4">
                  <button onClick={() => handleView(s._id)} className="flex-1 flex items-center justify-center gap-1 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors">
                    <IconEye size={16} /> Xem
                  </button>
                  <button onClick={() => handleDelete(s._id)} className="flex items-center justify-center gap-1 px-3 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100 transition-colors" title="Xóa">
                    <IconTrash size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal View Session */}
      {viewingSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-blue-600 text-white rounded-t-2xl">
              <h3 className="font-bold line-clamp-1">{viewingSession.title}</h3>
              <button onClick={() => setViewingSession(null)} className="hover:bg-blue-700 p-1.5 rounded-full transition-colors cursor-pointer text-white shrink-0">
                <IconX size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 flex flex-col gap-4">
              {viewingSession.messages.map((msg: any) => (
                <div key={msg.id || Math.random()} className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                  {msg.role !== 'user' && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 shadow-sm border border-blue-200 mt-1">
                      <IconSparkles size={16} className="text-blue-600" />
                    </div>
                  )}
                  <div className={`p-3 text-[0.9rem] shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' 
                      : 'bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-tl-sm max-w-full overflow-hidden [&>p]:my-1 [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4 [&_strong]:font-semibold [&_strong]:text-blue-800 [&_a]:text-blue-600 [&_a]:underline'
                  }`}>
                    {msg.role === 'user' ? (
                      <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>') }} />
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
