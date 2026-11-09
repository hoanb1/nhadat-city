import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Mail, Send, RefreshCw, Calendar, ArrowLeft } from 'lucide-react';
import sanitizeHtml from 'sanitize-html';

interface Email {
  _id: string;
  uid: number;
  messageId: string;
  folder: 'inbox' | 'sent';
  subject: string;
  from: any[];
  to: any[];
  date: string;
  text?: string;
  html?: string;
  syncedAt: string;
}

export default function Emails() {
  const { token } = useAuth();
  const [emails, setEmails] = useState<Email[]>([]);
  const [total, setTotal] = useState(0);
  const [folder, setFolder] = useState<'inbox' | 'sent'>('inbox');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [emailDetail, setEmailDetail] = useState<Email | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetchEmails();
  }, [folder, page]);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/emails?folder=${folder}&page=${page}&limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setEmails(json.data.emails);
        setTotal(json.data.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const syncEmails = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/emails/sync', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        setPage(1);
        fetchEmails();
      } else {
        alert('Lỗi: ' + json.message);
      }
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi đồng bộ.');
    } finally {
      setSyncing(false);
    }
  };

  const loadEmailDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/emails/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setEmailDetail(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getSenderName = (fromArr: any[]) => {
    if (!fromArr || fromArr.length === 0) return 'Unknown';
    const first = fromArr[0];
    return first.name || first.address || 'Unknown';
  };

  if (selectedEmail) {
    return (
      <div className="p-6 bg-slate-50 min-h-full">
        <div className="mb-6 flex items-center gap-4">
          <button 
            onClick={() => setSelectedEmail(null)}
            className="p-2 bg-white rounded-full border border-slate-200 text-slate-600 hover:text-indigo-600 shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold text-slate-800 flex-1 truncate">
            {selectedEmail.subject}
          </h2>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-140px)]">
          <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
            <div className="flex gap-4 items-center">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-xl uppercase">
                {getSenderName(selectedEmail.from).charAt(0)}
              </div>
              <div>
                <div className="font-semibold text-slate-800 text-lg">
                  {getSenderName(selectedEmail.from)}
                </div>
                <div className="text-slate-500 text-sm mt-0.5">
                  &lt;{selectedEmail.from[0]?.address}&gt; 
                  <span className="mx-2 text-slate-300">|</span> 
                  Tới: {selectedEmail.to.map((t: any) => t.address).join(', ')}
                </div>
              </div>
            </div>
            <div className="text-sm text-slate-500 flex items-center gap-1.5">
              <Calendar size={14} />
              {formatDate(selectedEmail.date)}
            </div>
          </div>
          
          <div className="p-6 overflow-y-auto flex-1 bg-white">
            {loadingDetail ? (
              <div className="flex justify-center items-center h-40">
                <RefreshCw className="animate-spin text-indigo-600" size={32} />
              </div>
            ) : emailDetail ? (
              <div 
                className="prose max-w-none text-slate-700"
                dangerouslySetInnerHTML={{ 
                  __html: sanitizeHtml(emailDetail.html || emailDetail.text?.replace(/\n/g, '<br/>') || '', {
                    allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img', 'style' ]),
                    allowedAttributes: {
                      ...sanitizeHtml.defaults.allowedAttributes,
                      '*': ['style', 'class']
                    }
                  }) 
                }} 
              />
            ) : (
              <div className="text-center text-slate-500 mt-10">Không thể tải nội dung email</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Mail className="text-indigo-600" /> Quản lý Email
          </h2>
          <p className="text-slate-500 mt-1">Đồng bộ và quản lý email trực tiếp từ máy chủ Larksuite.</p>
        </div>
        
        <button 
          onClick={syncEmails}
          disabled={syncing}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm flex items-center gap-2 disabled:opacity-70"
        >
          <RefreshCw size={18} className={syncing ? "animate-spin" : ""} />
          Đồng bộ mới
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-1 min-h-[600px]">
        {/* Sidebar folders */}
        <div className="w-64 border-r border-slate-200 bg-slate-50 flex flex-col p-4">
          <div className="space-y-1">
            <button
              onClick={() => { setFolder('inbox'); setPage(1); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${folder === 'inbox' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Mail size={18} />
              Hộp thư đến
            </button>
            <button
              onClick={() => { setFolder('sent'); setPage(1); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${folder === 'sent' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Send size={18} />
              Đã gửi
            </button>
          </div>
          
          <div className="mt-auto pt-6 border-t border-slate-200 text-sm text-slate-500">
            Tổng cộng: <span className="font-bold text-slate-700">{total}</span> thư trong thư mục này.
          </div>
        </div>

        {/* Email list */}
        <div className="flex-1 flex flex-col">
          {loading ? (
            <div className="flex-1 flex justify-center items-center">
              <RefreshCw className="animate-spin text-indigo-600" size={32} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {emails.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <Mail size={48} className="mb-4 text-slate-300" />
                  <p>Không có thư nào trong mục này</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {emails.map((email) => (
                    <li 
                      key={email._id} 
                      onClick={() => {
                        setSelectedEmail(email);
                        loadEmailDetail(email._id);
                      }}
                      className="p-4 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-4 group"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">
                        {getSenderName(email.from).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="font-semibold text-slate-800 truncate pr-4">
                            {folder === 'sent' ? `Tới: ${email.to[0]?.address || 'Unknown'}` : getSenderName(email.from)}
                          </span>
                          <span className="text-xs text-slate-500 shrink-0">
                            {new Date(email.date).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-slate-700 truncate mb-0.5">
                          {email.subject}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          
          {/* Pagination */}
          <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Trước
            </button>
            <span className="text-sm text-slate-500">Trang {page} / {Math.ceil(total / 50) || 1}</span>
            <button
              disabled={page >= Math.ceil(total / 50)}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Sau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
