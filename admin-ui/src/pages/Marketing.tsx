import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Megaphone, Send, Bell, List } from 'lucide-react';

export default function Marketing() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [link, setLink] = useState('');
  const [targetAudience, setTargetAudience] = useState('all');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/admin/marketing', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data.notifications);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch('/api/admin/marketing', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ title, content, link, targetAudience })
      });
      const json = await res.json();
      if (json.success) {
        alert('Đã gửi chiến dịch thành công!');
        setTitle('');
        setContent('');
        setLink('');
        fetchNotifications();
      } else {
        alert('Lỗi: ' + json.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '--';
    return new Date(dateString).toLocaleString('vi-VN');
  };

  return (
    <div className="p-6 bg-slate-50 min-h-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Megaphone className="text-indigo-600" /> Quản lý Marketing & Thông báo
        </h2>
        <p className="text-slate-500 mt-1">Gửi thông báo Push Notification hàng loạt đến người dùng.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Create */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm self-start">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Send size={18} className="text-indigo-500" /> Tạo Chiến Dịch Mới
          </h3>
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tiêu đề</label>
              <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ví dụ: Ưu đãi đặc biệt hôm nay" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nội dung</label>
              <textarea required value={content} onChange={e => setContent(e.target.value)} rows={4} className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Nhập nội dung chi tiết..."></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Đường dẫn đính kèm (Tùy chọn)</label>
              <input type="text" value={link} onChange={e => setLink(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tập khách hàng</label>
              <select value={targetAudience} onChange={e => setTargetAudience(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                <option value="all">Tất cả người dùng</option>
                <option value="brokers">Chỉ môi giới (Brokers)</option>
                <option value="users">Người dùng thông thường</option>
              </select>
            </div>
            <button disabled={sending} type="submit" className="w-full bg-indigo-600 text-white font-semibold py-2.5 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 mt-2">
              <Bell size={18} /> {sending ? 'Đang gửi...' : 'Phát Thông Báo Ngay'}
            </button>
          </form>
        </div>

        {/* History List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[600px]">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <List size={18} className="text-slate-500" />
            <h3 className="font-bold text-slate-800">Lịch sử chiến dịch</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-0">
            {loading ? (
              <div className="p-8 text-center text-slate-500">Đang tải...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">Chưa có chiến dịch nào được gửi.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((noti, idx) => (
                  <div key={noti._id || idx} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-semibold text-slate-800">{noti.title}</h4>
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {noti.targetAudience === 'all' ? 'Tất cả' : noti.targetAudience}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2 mb-2">{noti.content}</p>
                    <div className="text-xs text-slate-400 font-medium">Đã gửi vào {formatDate(noti.createdAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
