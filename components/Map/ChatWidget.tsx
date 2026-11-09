'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { IconX, IconSend, IconSparkles, IconPlus, IconPhoto, IconTrash, IconMapPin } from '@tabler/icons-react';
import { useMapContext } from './MapContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
}

const DEFAULT_WELCOME: ChatMessage = {
  id: '1',
  role: 'assistant',
  content: 'Chào bạn! Mình là AI Cố Vấn của NhaDat.City. Mình có thể giúp bạn tìm kiếm BĐS phù hợp, định giá nhà đất hoặc phân tích thị trường. Bạn cần tư vấn gì ạ?'
};

function cleanMessageHtml(content: string): string {
  if (!content) return '';

  // 1. Extract any full map URL with lat/lng/poly query params from content
  const mapUrlMatch = content.match(/https?:\/\/[^\s"'<>]+(?:\/|\/map)?\?lat=[^\s"'<>]+/i);
  const foundMapUrl = mapUrlMatch ? mapUrlMatch[0] : null;

  // 2. Convert raw <button ...>...</button> HTML into clean Markdown link format
  let cleaned = content.replace(/<button[^>]*>(.*?)<\/button>/gi, (_match, innerText) => {
    const text = innerText.replace(/<[^>]+>/g, '').trim() || 'Xem & đánh dấu thửa đất trên bản đồ';
    const targetUrl = foundMapUrl || 'https://nhadat.city/';
    return `[${text}](${targetUrl})`;
  });

  // 3. Convert raw <a href="URL">...</a> HTML into clean Markdown link format
  cleaned = cleaned.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, (_match, url, innerText) => {
    const text = innerText.replace(/<[^>]+>/g, '').trim() || 'Xem & đánh dấu thửa đất trên bản đồ';
    const targetUrl = url.includes('lat=') ? url : (foundMapUrl || url);
    return `[${text}](${targetUrl})`;
  });

  return cleaned;
}

export function ChatWidget({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { filters, map, selectedListingId, selectedListing, selectedParcel, setSelectedParcel, province, ward, locationName } = useMapContext();
  const { data: session } = useSession();

  const [messages, setMessages] = useState<ChatMessage[]>([DEFAULT_WELCOME]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<any>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Image Selection Handler ───────────────────────────────────────────────
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Dung lượng ảnh quá lớn. Vui lòng chọn ảnh dưới 10MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setSelectedImage(evt.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // ── Clipboard Paste Handler ───────────────────────────────────────────────
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            if (evt.target?.result) setSelectedImage(evt.target.result as string);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  // ── Load preferences ──────────────────────────────────────────────────────
  useEffect(() => {
    if (session) {
      fetch('/api/user/ai-preferences')
        .then(res => res.json())
        .then(res => {
          if (res.success) setPreferences(res.data);
        });
    }
  }, [session]);

  // ── Load history ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (session === undefined) return;
    (async () => {
      if (session) {
        try {
          const res = await fetch('/api/user/chat-sessions');
          const data = await res.json();
          if (data.success && data.data.length > 0) {
            const latest = data.data[0];
            const res2 = await fetch(`/api/user/chat-sessions/${latest._id}`);
            const data2 = await res2.json();
            if (data2.success && data2.data.messages?.length > 1) {
              setMessages(data2.data.messages);
              setSessionId(latest._id);
            }
          }
        } catch (e) { console.error(e); }
      } else {
        try {
          const stored = sessionStorage.getItem('nhadat_chat_history');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 1) setMessages(parsed);
          }
        } catch (e) { }
      }
      setIsInitialized(true);
    })();
  }, [session]);

  // ── Persist to sessionStorage for guests ─────────────────────────────────
  useEffect(() => {
    if (!isInitialized || session || messages.length <= 1) return;
    sessionStorage.setItem('nhadat_chat_history', JSON.stringify(messages));
  }, [messages, isInitialized, session]);

  // ── Save to DB for logged-in users (debounced) ────────────────────────────
  const saveSession = useCallback(async (msgs: ChatMessage[]) => {
    if (!session || msgs.length <= 1) return;
    try {
      const res = await fetch('/api/user/chat-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, messages: msgs })
      });
      const data = await res.json();
      if (data.success && !sessionId) setSessionId(data.sessionId);
    } catch (e) { }
  }, [session, sessionId]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async (text: string, imageAttached?: string | null) => {
    const imgToSend = imageAttached !== undefined ? imageAttached : selectedImage;
    if ((!text.trim() && !imgToSend) || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim() || (imgToSend ? 'Phân tích hình ảnh thửa đất / sổ đỏ này và tìm tọa độ VN2000.' : ''),
      image: imgToSend || undefined,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    const botMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: botMsgId, role: 'assistant', content: '' }]);

    const mapBounds = map ? (() => {
      const b = map.getBounds();
      return { sw: [b.getWest(), b.getSouth()], ne: [b.getEast(), b.getNorth()] };
    })() : null;
    const zoom = map?.getZoom() ?? null;
    const center = map?.getCenter() ? { lat: map.getCenter().lat, lng: map.getCenter().lng } : null;
    const currentUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        signal: abortRef.current.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content, image: m.image })),
          context: {
            // Map viewport
            mapBounds,
            zoom,
            center,
            bbox: mapBounds ? [mapBounds.sw[0], mapBounds.sw[1], mapBounds.ne[0], mapBounds.ne[1]] : null,
            // Current page / location
            currentUrl,
            province,
            ward,
            locationName,
            // Active filters
            filters,
            // Selected items
            selectedListingId,
            selectedListing,
            selectedParcel,
            userId: (session?.user as any)?.id || session?.user?.email,
            preferences,
          },
          sessionId: sessionId || undefined,
        }),
      });

      if (!res.ok || !res.body) throw new Error('API Error');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let botContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        botContent += decoder.decode(value, { stream: true });
        setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, content: botContent } : m));
      }

      const finalMessages = [...newMessages, { id: botMsgId, role: 'assistant' as const, content: botContent }];
      saveSession(finalMessages);

    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error(error);
      setMessages(prev => prev.map(m =>
        m.id === botMsgId ? { ...m, content: 'Hệ thống AI đang bận. Vui lòng thử lại.' } : m
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickReply = (text: string) => {
    sendMessage(text);
  };

  const handleNewChat = () => {
    abortRef.current?.abort();
    setMessages([DEFAULT_WELCOME]);
    setSessionId(null);
    setIsLoading(false);
    if (!session) sessionStorage.removeItem('nhadat_chat_history');
  };

  const quickReplies = useMemo(() => {
    let pool: string[] = [];
    
    const propertyTypeMap: Record<string, string> = {
      nha_o: 'nhà ở',
      dat_nen: 'đất nền',
      biet_thu: 'biệt thự',
      chung_cu: 'chung cư',
      shophouse: 'shophouse/nhà phố'
    };

    if (selectedListing) {
      const rawType = selectedListing.propertyType?.toLowerCase() || '';
      const type = propertyTypeMap[rawType] || rawType || 'nhà này';
      pool = [
        `Đánh giá ưu nhược điểm của ${type}`,
        `Giá trị thực của ${type} là bao nhiêu?`,
        `Liệt kê các tiện ích xung quanh BĐS này`,
        `Phân tích tiềm năng cho thuê ${type}`,
        `Khu vực xung quanh BĐS này có an ninh không?`,
        `So sánh giá nhà này với khu vực lân cận`,
        `Tính toán chi phí trả góp trong 10 năm`
      ];
    } else if (selectedParcel) {
      const type = selectedParcel.loaiDatName || selectedParcel.loaiDat || 'loại đất này';
      pool = [
        `Quy định xây dựng trên ${type} là gì?`,
        `Kiểm tra lịch sử biến động giá quanh thửa này`,
        `Có BĐS nào đang bán gần tọa độ này không?`,
        `Thửa đất này có tiềm năng tăng giá không?`,
        `Xin phép xây dựng trên đất này cần thủ tục gì?`,
        `Loại đất ${type} có được lên thổ cư không?`,
        `Tình hình giao dịch thực tế quanh thửa đất này`
      ];
    } else {
      // Context: Vùng địa lý
      const locString = locationName || ward || province;
      const area = locString ? locString.split(',')[0].trim() : 'khu vực này';

      // Context: Bộ lọc
      const hasTypeFilter = filters?.propertyType && filters.propertyType.length > 0;
      const rawTypeFilter = hasTypeFilter ? filters.propertyType![0].toLowerCase() : '';
      const typeStr = propertyTypeMap[rawTypeFilter] || rawTypeFilter || 'bất động sản';

      pool = [
        `Thị trường ${typeStr} tại ${area} 3 tháng qua`,
        `Phân tích mặt bằng giá ${typeStr} tại ${area}`,
        `Dự báo giá ${typeStr} tại ${area} năm nay`,
        `Lịch sử biến động giá ${typeStr} ở ${area}`,
        `Mật độ tin đăng ${typeStr} tại ${area} ra sao?`,
        `Khu vực nào xung quanh ${area} đang sốt giá?`,
        `Đánh giá tổng quan vị trí ${area}`
      ];

      if (filters?.maxPrice) {
        const maxP = filters.maxPrice >= 1e9 ? `${(filters.maxPrice/1e9).toFixed(1)} tỷ` : `${filters.maxPrice/1e6} triệu`;
        pool.push(`Tìm ${typeStr} cắt lỗ dưới ${maxP} tại ${area}`);
        pool.push(`Có ${typeStr} nào tốt tầm giá ${maxP} ở ${area} không?`);
      } else {
        pool.push(`Gợi ý ${typeStr} đáng đầu tư nhất tại ${area}`);
        pool.push(`Đầu tư ${typeStr} ở ${area} lúc này có hợp lý không?`);
      }
    }

    // Filter out questions the user recently asked
    const recentUserMsgs = new Set(messages.filter(m => m.role === 'user').slice(-5).map(m => m.content.trim()));
    const filteredPool = pool.filter(q => !recentUserMsgs.has(q.trim()));

    // Shuffle and pick 3 to keep it fresh without flickering
    const shuffled = [...filteredPool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
  }, [selectedListing, selectedParcel, locationName, ward, province, filters, messages]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAutoHighlightedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

    // Auto-highlight parcel on map when AI returns a map URL
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'assistant' && lastMsg.content) {
        const match = lastMsg.content.match(/https?:\/\/[^\s"'<>]+(?:\/|\/map)?\?lat=[^\s"'<>]+/i);
        if (match && match[0] !== lastAutoHighlightedUrlRef.current) {
          lastAutoHighlightedUrlRef.current = match[0];
          try {
            const urlObj = new URL(match[0]);
            const lat = parseFloat(urlObj.searchParams.get('lat') || '');
            const lng = parseFloat(urlObj.searchParams.get('lng') || '');
            const polyStr = urlObj.searchParams.get('poly');

            if (map && !isNaN(lat) && !isNaN(lng)) {
              map.flyTo({ center: [lng, lat], zoom: 19, duration: 1500 });
              if (polyStr) {
                try {
                  const coords = JSON.parse(decodeURIComponent(polyStr));
                  const geom = { type: 'Polygon', coordinates: coords };
                  const srcHl = map.getSource('parcel-highlight') as any;
                  if (srcHl) srcHl.setData({ type: 'Feature', properties: {}, geometry: geom });
                } catch (e) { }
              }
              fetch(`/api/parcel-info?lng=${lng}&lat=${lat}`)
                .then(r => r.json())
                .then(json => {
                  if (json.success && json.data) {
                    if (json.data.geometry) {
                      const srcHl = map.getSource('parcel-highlight') as any;
                      if (srcHl) srcHl.setData({ type: 'Feature', properties: {}, geometry: json.data.geometry });
                    }
                    if (setSelectedParcel) setSelectedParcel(json.data);
                  }
                })
                .catch(console.error);
            }
          } catch (e) { }
        }
      }
    }
  }, [messages, isOpen, map]);

  if (!isOpen) return null;

  return (
    <div
      onPaste={handlePaste}
      className="fixed bottom-[80px] left-3 md:left-auto md:right-3 bg-white rounded-2xl shadow-2xl flex flex-col z-[9999] border border-slate-200 overflow-hidden transform transition-all animate-in fade-in slide-in-from-bottom-4 duration-300"
      style={{ width: 'min(360px, calc(100vw - 24px))', height: 'min(520px, calc(100dvh - 120px))' }}
    >
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <IconSparkles size={18} className="text-yellow-300" />
          </div>
          <div>
            <div className="font-bold text-[0.95rem] leading-none mb-1">AI Cố Vấn Bất Động Sản</div>
            <div className="text-[0.7rem] text-blue-100 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
              {isLoading ? 'Đang suy nghĩ...' : 'Đang trực tuyến (Đọc ảnh Sổ đỏ / VN2000)'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleNewChat} title="Hội thoại mới" className="hover:bg-blue-700 p-1.5 rounded-full transition-colors cursor-pointer text-white">
            <IconPlus size={18} />
          </button>
          <button onClick={onClose} className="hover:bg-blue-700 p-1.5 rounded-full transition-colors cursor-pointer text-white">
            <IconX size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 bg-[#f8fafc] p-4 flex flex-col gap-4 overflow-y-auto">
        <div className="text-center text-[0.7rem] text-slate-400 my-2">Hôm nay</div>
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 max-w-[88%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
            {msg.role !== 'user' && (
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 shadow-sm border border-blue-200 mt-1">
                <IconSparkles size={14} className="text-blue-600" />
              </div>
            )}
            <div className={`p-3 text-[0.85rem] shadow-sm ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm'
                : 'bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-tl-sm max-w-full overflow-hidden [&>p]:my-1 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&_strong]:font-semibold [&_strong]:text-blue-800 [&_a]:text-blue-600 [&_a]:underline [&_li]:my-0.5'
            }`}>
              {msg.role === 'user' ? (
                <div className="flex flex-col gap-1.5">
                  {msg.image && (
                    <img src={msg.image} alt="Sơ đồ thửa đất / Sổ đỏ" className="max-w-[210px] max-h-[160px] rounded-lg object-cover border border-blue-400/40 shadow-sm" />
                  )}
                  {msg.content && <span>{msg.content}</span>}
                </div>
              ) : (
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children }) => {
                      if (href?.includes('lat=')) {
                        return (
                          <a
                            href={href}
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              try {
                                const urlObj = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'https://nhadat.city');
                                const lat = parseFloat(urlObj.searchParams.get('lat') || '');
                                const lng = parseFloat(urlObj.searchParams.get('lng') || '');
                                const polyStr = urlObj.searchParams.get('poly');

                                if (map && !isNaN(lat) && !isNaN(lng)) {
                                  map.flyTo({ center: [lng, lat], zoom: 19, duration: 1500 });

                                  // 1. Highlight polygon on MapLibre map immediately
                                  if (polyStr) {
                                    try {
                                      const coords = JSON.parse(decodeURIComponent(polyStr));
                                      const geom = { type: 'Polygon', coordinates: coords };
                                      const srcHl = map.getSource('parcel-highlight') as any;
                                      if (srcHl) srcHl.setData({ type: 'Feature', properties: {}, geometry: geom });
                                    } catch (err) { }
                                  }

                                  // 2. Fetch cadastral parcel info from backend to get official boundary & info
                                  try {
                                    const res = await fetch(`/api/parcel-info?lng=${lng}&lat=${lat}`);
                                    const json = await res.json();
                                    if (json.success && json.data) {
                                      const d = json.data;
                                      if (d.geometry) {
                                        const srcHl = map.getSource('parcel-highlight') as any;
                                        if (srcHl) srcHl.setData({ type: 'Feature', properties: {}, geometry: d.geometry });
                                      }
                                      if (setSelectedParcel) setSelectedParcel(d);
                                    }
                                  } catch (err) { }
                                } else {
                                  window.location.href = href;
                                }
                              } catch (err) {
                                window.location.href = href;
                              }
                            }}
                            className="inline-flex items-center gap-1.5 my-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-lg shadow-md transition-all cursor-pointer text-[0.82rem] no-underline"
                          >
                            <IconMapPin size={14} className="shrink-0" />
                            <span>{children || 'Xem & đánh dấu thửa đất trên bản đồ'}</span>
                          </a>
                        );
                      }
                      if (href?.startsWith('https://nhadat.city/')) {
                        const parts = href.split('/');
                        const id = parts[5];
                        if (id) {
                          return <ListingPreviewCard id={id} fallbackUrl={href} />;
                        }
                      }
                      return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold underline">{children}</a>;
                    },
                    button: ({ children, ...props }: any) => {
                      return (
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Attempt to find any map link in the widget or current message
                            const mapBtn = document.querySelector('a[href*="lat="]') as HTMLAnchorElement;
                            if (mapBtn) {
                              mapBtn.click();
                            } else if (map) {
                              map.zoomIn();
                            }
                          }}
                          className="inline-flex items-center gap-1.5 my-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-lg shadow-md transition-all cursor-pointer text-[0.82rem] no-underline"
                        >
                          {children}
                        </a>
                      );
                    }
                  }}
                >
                  {cleanMessageHtml(msg.content)}
                </ReactMarkdown>
              )}
            </div>
          </div>
        ))}
        {!isLoading && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold border border-purple-300 rounded-full px-3 py-1.5 text-[0.8rem] cursor-pointer transition-colors shadow-sm flex items-center gap-1"
            >
              <IconPhoto size={14} />
              <span>Tải ảnh sổ đỏ / Tọa độ VN-2000</span>
            </button>
            {quickReplies.map((reply, i) => (
              <button
                key={i}
                onClick={() => handleQuickReply(reply)}
                className="bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-3 py-1.5 text-[0.8rem] cursor-pointer transition-colors shadow-sm"
              >
                {reply}
              </button>
            ))}
          </div>
        )}
        {isLoading && messages[messages.length - 1]?.content === '' && (
          <div className="flex gap-2 max-w-[85%]">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <IconSparkles size={14} className="text-blue-600" />
            </div>
            <div className="p-3 bg-white text-slate-500 border border-slate-200 rounded-2xl rounded-tl-sm text-[0.85rem] flex items-center gap-1">
              <span className="animate-bounce">●</span><span className="animate-bounce delay-75">●</span><span className="animate-bounce delay-150">●</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Selected Image Attachment Preview */}
      {selectedImage && (
        <div className="px-3 pt-2 pb-1 flex items-center gap-2 bg-slate-50 border-t border-slate-200">
          <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-blue-400 shrink-0 shadow-sm">
            <img src={selectedImage} alt="Attachment" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute top-0.5 right-0.5 bg-slate-900/80 text-white rounded-full p-0.5 hover:bg-black transition-colors"
            >
              <IconX size={10} />
            </button>
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[0.75rem] font-semibold text-slate-700 truncate">Đã đính kèm ảnh Sổ đỏ / Tọa độ</span>
            <span className="text-[0.68rem] text-slate-400">AI sẽ tự động đọc tọa độ VN2000 & tìm thửa đất</span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedImage(null)}
            className="text-slate-400 hover:text-red-500 p-1"
          >
            <IconTrash size={16} />
          </button>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-100 bg-white flex items-center gap-2 shrink-0">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Tải ảnh Sổ đỏ / Bảng tọa độ VN2000"
          className="h-9 px-2.5 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-full flex items-center gap-1 text-[0.78rem] font-medium shrink-0 transition-colors cursor-pointer"
        >
          <IconPhoto size={18} />
          <span className="hidden sm:inline">Ảnh Sổ đỏ</span>
        </button>
        <input
          type="text"
          placeholder={selectedImage ? "Thêm ghi chú hoặc nhấn gửi ngay..." : "Hỏi AI hoặc dán ảnh (Ctrl+V) Sổ đỏ..."}
          value={input}
          onChange={e => setInput(e.target.value)}
          className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2.5 text-[0.85rem] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <button
          type="submit"
          disabled={(!input.trim() && !selectedImage) || isLoading}
          className="w-9 h-9 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <IconSend size={16} className="-ml-0.5" />
        </button>
      </form>
    </div>
  );
}

function ListingPreviewCard({ id, fallbackUrl }: { id: string, fallbackUrl: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/listing-preview?id=${id}`)
      .then(res => res.json())
      .then(res => {
        if (res.success) setData(res.data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="animate-pulse bg-slate-100 h-20 rounded-lg my-2"></div>;
  }

  if (!data) {
    return <a href={fallbackUrl} target="_blank" rel="noopener noreferrer">{fallbackUrl}</a>;
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden my-2 bg-white flex shadow-sm hover:shadow-md transition-shadow">
      {data.thumbnail && (
        <div className="w-24 h-24 shrink-0 bg-slate-100">
          <img src={data.thumbnail} alt={data.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-3 flex flex-col justify-between flex-1 min-w-0">
        <div>
          <h4 className="font-semibold text-[0.85rem] text-slate-800 truncate" title={data.title}>{data.title}</h4>
          <div className="flex gap-2 text-[0.75rem] text-slate-500 mt-0.5">
            <span className="font-bold text-orange-600">{data.price}</span>
            <span>•</span>
            <span>{data.area}</span>
          </div>
        </div>
        <a 
          href={data.link} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 text-[0.75rem] font-semibold hover:underline mt-1 self-start"
        >
          Xem chi tiết
        </a>
      </div>
    </div>
  );
}
