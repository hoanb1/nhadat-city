'use client';

import { useState, useEffect, useRef } from 'react';
import { IconMessageCircle2, IconSend, IconMessageOff } from '@tabler/icons-react';

interface Comment {
  _id: string;
  name: string;
  content: string;
  createdAt: string;
  likes: number;
}

interface Props { listingId: string; }

function timeAgo(date: string) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

function avatar(name: string) {
  return name?.trim()?.charAt(0)?.toUpperCase() || '?';
}

const COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2'];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % COLORS.length;
  return COLORS[h];
}

export default function CommentSection({ listingId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/real-estate/${listingId}/comments`)
      .then(r => r.json())
      .then(j => { if (j.success) setComments(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [listingId]);

  const submit = async () => {
    if (!name.trim() || !content.trim()) {
      setError('Vui lòng nhập tên và nội dung');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/real-estate/${listingId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), content: content.trim() }),
      });
      const j = await res.json();
      if (j.success) {
        setComments(prev => [j.data, ...prev]);
        setContent('');
        setTimeout(() => listRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 100);
      } else {
        setError(j.error || 'Lỗi gửi bình luận');
      }
    } catch {
      setError('Lỗi kết nối, thử lại sau');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="p-5 border-t border-slate-100">
      <h3 className="text-[0.95rem] font-bold text-slate-800 m-0 mb-4 flex items-center gap-[7px]">
        <IconMessageCircle2 width="1em" height="1em"  />
        Hỏi đáp & Bình luận
        {comments.length > 0 && <span className="bg-indigo-600 text-white text-[11px] font-bold py-[1px] px-2 rounded-sm">{comments.length}</span>}
      </h3>

      {/* Compose box */}
      <div className="bg-slate-50 rounded-sm p-3.5 border border-slate-200 mb-5 flex flex-col gap-2.5">
        <input
          className="border border-slate-200 rounded-sm py-[9px] px-3 text-[0.85rem] outline-none transition-colors duration-200 bg-white focus:border-indigo-600"
          placeholder="Tên của bạn *"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={50}
        />
        <textarea
          className="border border-slate-200 rounded-sm py-[9px] px-3 text-[0.85rem] resize-y outline-none transition-colors duration-200 bg-white focus:border-indigo-600 font-inherit leading-relaxed"
          placeholder="Đặt câu hỏi hoặc để lại bình luận về bất động sản này..."
          value={content}
          onChange={e => setContent(e.target.value)}
          maxLength={1000}
          rows={3}
        />
        {error && <p className="text-red-500 text-[0.78rem] m-0">{error}</p>}
        <div className="flex items-center justify-between">
          <span className="text-[0.72rem] text-slate-400">{content.length}/1000</span>
          <button
            className="flex items-center gap-[6px] bg-indigo-600 text-white border-none py-2 px-[18px] rounded-sm text-[0.85rem] font-bold cursor-pointer transition-colors duration-200 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed shadow-sm"
            onClick={submit}
            disabled={submitting || !content.trim() || !name.trim()}
          >
            {submitting ? 'Đang gửi...' : <><IconSend width="1em" height="1em"  /> Gửi</>}
          </button>
        </div>
      </div>

      {/* Comment list */}
      <div className="flex flex-col gap-3.5 max-h-[400px] overflow-y-auto pr-1 [scrollbar-width:thin]" ref={listRef}>
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map(i => <div key={i} className="h-[70px] rounded-sm bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-shimmer" />)}
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 p-6 text-slate-400 text-[0.85rem]">
            <IconMessageOff width="1em" height="1em" className="text-[1.8rem]"  />
            <p className="m-0">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
          </div>
        ) : (
          comments.map(c => (
            <div key={c._id} className="flex gap-3 items-start">
              <div className="w-9 h-9 rounded-sm flex items-center justify-center text-white font-bold text-[0.9rem] shrink-0" style={{ background: avatarColor(c.name) }}>
                {avatar(c.name)}
              </div>
              <div className="flex-1 bg-slate-50 rounded-sm py-2.5 px-3.5 border border-slate-100">
                <div className="flex items-center gap-2 mb-1.5">
                  <strong className="text-[0.85rem] text-slate-800">{c.name}</strong>
                  <span className="text-[0.72rem] text-slate-400">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="text-[0.85rem] text-slate-700 leading-relaxed m-0 whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
