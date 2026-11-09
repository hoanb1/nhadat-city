"use client";

import React, { useState } from 'react';
import { Loader2, Play } from 'lucide-react';

export default function AIRetrainButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleRetrain = async () => {
    if (!confirm('Bạn có chắc muốn kích hoạt huấn luyện lại hệ thống AI ngay bây giờ? Quá trình này sẽ diễn ra ngầm trong khoảng 1-2 phút.')) {
      return;
    }

    setLoading(true);
    setMessage('');
    
    try {
      const res = await fetch('/api/admin/ai-retrain', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        setMessage(data.message || 'Thành công!');
      } else {
        setMessage(data.error || 'Có lỗi xảy ra.');
      }
    } catch {
      setMessage('Lỗi kết nối tới máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '16px' }}>
      <button 
        onClick={handleRetrain}
        disabled={loading}
        style={{ 
          background: loading ? '#fca5a5' : '#e11d48', 
          color: 'white', 
          border: 'none', 
          padding: '10px 16px', 
          borderRadius: '6px', 
          cursor: loading ? 'wait' : 'pointer',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
            <span>Đang kích hoạt...</span>
          </>
        ) : (
          <>
            <Play className="w-4 h-4" strokeWidth={1.5} />
            <span>Kích hoạt huấn luyện AI ngay</span>
          </>
        )}
      </button>
      
      {message && (
        <p style={{ marginTop: '8px', fontSize: '0.85rem', color: message.includes('Lỗi') ? '#9f1239' : '#059669', fontWeight: '500' }}>
          {message}
        </p>
      )}
    </div>
  );
}
