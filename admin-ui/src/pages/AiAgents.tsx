import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Bot, Zap, MessageSquare, Trash2, Settings, BarChart2, X, ChevronDown, ChevronRight, ToggleLeft, ToggleRight, Save, List, Layers } from 'lucide-react';

interface AiLog {
  _id: string;
  action: string;
  model: string;
  tokensUsed: number;
  sessionId?: string;
  prompt?: string;
  response?: string;
  createdAt: string;
}

interface Session {
  sessionId: string | null;
  firstAt: string;
  lastAt: string;
  totalTokens: number;
  requestCount: number;
  models: string[];
  logs: AiLog[];
}

interface ProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  keyCount: number;
}

interface RouterConfig {
  providers: ProviderConfig[];
  maxRetries: number;
  sessionTimeoutMinutes: number;
}

export default function AiAgents() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState({ totalRequests: 0, totalTokens: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AiLog | null>(null);
  const [viewMode, setViewMode] = useState<'logs' | 'sessions' | 'config'>('sessions');
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [config, setConfig] = useState<RouterConfig | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState('');

  useEffect(() => {
    fetchLogs();
    fetchConfig();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const [resLogs, resSessions] = await Promise.all([
        fetch('/api/admin/ai-logs?view=logs', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/ai-logs?view=sessions', { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      const jsonLogs = await resLogs.json();
      const jsonSessions = await resSessions.json();
      if (jsonLogs.success) {
        setLogs(jsonLogs.data.logs);
        setStats(jsonLogs.data.stats);
      }
      if (jsonSessions.success) {
        setSessions(jsonSessions.data.sessions);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/ai-config', { headers: { 'Authorization': `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) setConfig(json.data);
    } catch (err) {
      console.error(err);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    setConfigSaving(true);
    setConfigMsg('');
    try {
      const res = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(config)
      });
      const json = await res.json();
      setConfigMsg(json.success ? '✓ Đã lưu cấu hình' : `✗ ${json.message}`);
    } catch (err) {
      setConfigMsg('✗ Lỗi kết nối');
    } finally {
      setConfigSaving(false);
      setTimeout(() => setConfigMsg(''), 3000);
    }
  };

  const clearLogs = async () => {
    if (!confirm('Xóa toàn bộ lịch sử AI?')) return;
    try {
      const res = await fetch('/api/admin/ai-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'clear' })
      });
      if (res.ok) fetchLogs();
    } catch (err) { console.error(err); }
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleString('vi-VN') : '--';
  const formatTime = (d?: string) => d ? new Date(d).toLocaleTimeString('vi-VN') : '--';

  return (
    <div className="p-6 bg-slate-50 min-h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Bot className="text-indigo-600" /> Quản lý AI Agents
          </h2>
          <p className="text-slate-500 mt-1">Giám sát hoạt động và cấu hình các mô hình AI (Gemini, Mistral, Groq).</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2"><BarChart2 size={16} /> Tổng Request</div>
          <div className="text-3xl font-bold text-slate-800">{stats.totalRequests}</div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 text-indigo-500 text-sm mb-2"><Zap size={16} /> Token Đã dùng</div>
          <div className="text-3xl font-bold text-indigo-600">{stats.totalTokens.toLocaleString()}</div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 text-emerald-500 text-sm mb-2"><Layers size={16} /> Phiên Chat</div>
          <div className="text-3xl font-bold text-emerald-600">{sessions.length}</div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 text-amber-500 text-sm mb-2"><MessageSquare size={16} /> TB Token/Phiên</div>
          <div className="text-3xl font-bold text-amber-600">
            {sessions.length > 0 ? Math.round(stats.totalTokens / sessions.length).toLocaleString() : '--'}
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setViewMode('sessions')}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${viewMode === 'sessions' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
          <Layers size={15} /> Theo Session
        </button>
        <button onClick={() => setViewMode('logs')}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${viewMode === 'logs' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
          <List size={15} /> Từng Request
        </button>
        <button onClick={() => setViewMode('config')}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${viewMode === 'config' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
          <Settings size={15} /> Cấu hình Router
        </button>
        {viewMode !== 'config' && (
          <button onClick={clearLogs} className="ml-auto text-red-500 hover:text-red-700 px-3 py-2 flex items-center gap-1 text-sm font-medium">
            <Trash2 size={15} /> Xóa lịch sử
          </button>
        )}
      </div>

      {/* ── SESSION VIEW ── */}
      {viewMode === 'sessions' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Layers size={16} /> Lịch sử theo Session</h3>
            <p className="text-xs text-slate-500 mt-0.5">Mỗi session = 1 hội thoại liên tục. Session mới khi người dùng bấm "Hội thoại mới" hoặc sau &gt;30 phút không chat.</p>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
          ) : sessions.length === 0 ? (
            <div className="py-12 text-center text-slate-500">Chưa có dữ liệu session</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sessions.map((s, idx) => {
                const key = s.sessionId || `solo_${idx}`;
                const isExpanded = expandedSession === key;
                return (
                  <div key={key}>
                    <div
                      onClick={() => setExpandedSession(isExpanded ? null : key)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      {isExpanded ? <ChevronDown size={16} className="text-indigo-500 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-800 text-sm">
                            {s.sessionId ? `Session #${s.sessionId.slice(-6)}` : 'Session không có ID (khách)'}
                          </span>
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{s.requestCount} requests</span>
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{s.totalTokens.toLocaleString()} tokens</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {formatDate(s.firstAt)} → {formatTime(s.lastAt)} · Models: {s.models.join(', ')}
                        </div>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="bg-slate-50 border-t border-slate-100 divide-y divide-slate-100">
                        {s.logs.map((log, li) => (
                          <div key={log._id || li} onClick={() => setSelectedLog(log)}
                            className="flex items-center gap-3 px-8 py-2.5 hover:bg-indigo-50 cursor-pointer transition-colors">
                            <MessageSquare size={14} className="text-slate-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-slate-700 font-medium">{log.action}</div>
                              <div className="text-xs text-slate-400">{formatDate(log.createdAt)} · {log.model} · {log.tokensUsed} tokens</div>
                            </div>
                            <span className="text-xs text-indigo-500 hover:underline shrink-0">Xem chi tiết →</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── LOGS VIEW ── */}
      {viewMode === 'logs' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><MessageSquare size={16} /> Từng Request API</h3>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-sm bg-white">
                    <th className="py-3 px-4 font-medium">Thời gian</th>
                    <th className="py-3 px-4 font-medium">Hành động</th>
                    <th className="py-3 px-4 font-medium">Mô hình</th>
                    <th className="py-3 px-4 font-medium">Session</th>
                    <th className="py-3 px-4 font-medium text-right">Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, idx) => (
                    <tr key={log._id || idx} onClick={() => setSelectedLog(log)} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer">
                      <td className="py-3 px-4 text-sm text-slate-600">{formatDate(log.createdAt)}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{log.action || 'Phân tích tin đăng'}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-semibold">{log.model || 'unknown'}</span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 font-mono">{log.sessionId ? `…${log.sessionId.slice(-8)}` : '—'}</td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-slate-500">{log.tokensUsed || 0}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr><td colSpan={5} className="py-12 text-center text-slate-500">Chưa có bản ghi</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── CONFIG VIEW ── */}
      {viewMode === 'config' && config && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Settings size={16} /> Cấu hình AI Router</h3>
            <div className="flex items-center gap-3">
              {configMsg && <span className={`text-sm font-medium ${configMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{configMsg}</span>}
              <button onClick={saveConfig} disabled={configSaving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                <Save size={15} /> {configSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Provider priority table */}
            <div>
              <h4 className="font-semibold text-slate-800 mb-1">Thứ tự ưu tiên Provider</h4>
              <p className="text-xs text-slate-500 mb-3">Priority thấp hơn = được thử trước. Hệ thống tự động fallback khi gặp lỗi 429/quota.</p>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left py-2.5 px-4 font-medium text-slate-600">Provider</th>
                      <th className="text-center py-2.5 px-4 font-medium text-slate-600">Keys cấu hình</th>
                      <th className="text-center py-2.5 px-4 font-medium text-slate-600">Priority</th>
                      <th className="text-center py-2.5 px-4 font-medium text-slate-600">Bật/Tắt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {config.providers.map((p, i) => (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-medium text-slate-800">{p.name}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-mono text-xs">{p.keyCount} key(s)</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            value={p.priority}
                            onChange={(e) => {
                              const updated = [...config.providers];
                              updated[i] = { ...updated[i], priority: Number(e.target.value) };
                              setConfig({ ...config, providers: updated.sort((a, b) => a.priority - b.priority) });
                            }}
                            className="w-16 text-center border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button onClick={() => {
                            const updated = [...config.providers];
                            updated[i] = { ...updated[i], enabled: !updated[i].enabled };
                            setConfig({ ...config, providers: updated });
                          }}>
                            {p.enabled
                              ? <ToggleRight size={28} className="text-emerald-500 mx-auto" />
                              : <ToggleLeft size={28} className="text-slate-300 mx-auto" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Other settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Max Retries</label>
                <p className="text-xs text-slate-400 mb-2">Số lần thử provider khác khi gặp lỗi rate limit.</p>
                <input
                  type="number"
                  value={config.maxRetries}
                  onChange={(e) => setConfig({ ...config, maxRetries: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Session Timeout (phút)</label>
                <p className="text-xs text-slate-400 mb-2">Sau bao lâu không chat thì coi là session mới (khi nhóm trong admin).</p>
                <input
                  type="number"
                  value={config.sessionTimeoutMinutes}
                  onChange={(e) => setConfig({ ...config, sessionTimeoutMinutes: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
              <strong>Lưu ý:</strong> Thứ tự provider và bật/tắt ở đây được lưu vào database để tham khảo, nhưng thứ tự thực tế vẫn do code trong <code className="bg-blue-100 px-1 rounded">lib/ai/router.ts</code> quyết định. Để thay đổi thực sự, cần cập nhật file đó.
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {selectedLog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Bot size={18} className="text-indigo-600" /> Chi tiết AI Log
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="mb-4 flex flex-wrap gap-4 text-sm">
                <div><span className="text-slate-500">Hành động:</span> <span className="font-medium text-slate-800">{selectedLog.action}</span></div>
                <div><span className="text-slate-500">Model:</span> <span className="font-medium text-indigo-600">{selectedLog.model}</span></div>
                <div><span className="text-slate-500">Tokens:</span> <span className="font-medium text-slate-800">{selectedLog.tokensUsed}</span></div>
                <div><span className="text-slate-500">Thời gian:</span> <span className="font-medium text-slate-800">{formatDate(selectedLog.createdAt)}</span></div>
                {selectedLog.sessionId && <div><span className="text-slate-500">Session:</span> <span className="font-mono text-xs text-slate-600">{selectedLog.sessionId}</span></div>}
              </div>
              <div className="mb-6">
                <h4 className="font-semibold text-sm text-slate-800 mb-2 flex items-center gap-2">
                  <MessageSquare size={16} className="text-slate-500" /> Prompt (Đầu vào)
                </h4>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 whitespace-pre-wrap text-sm text-slate-700 font-mono overflow-x-auto max-h-64">
                  {selectedLog.prompt || 'Không có dữ liệu prompt.'}
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-sm text-slate-800 mb-2 flex items-center gap-2">
                  <Zap size={16} className="text-amber-500" /> Response (Phản hồi)
                </h4>
                <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100 whitespace-pre-wrap text-sm text-slate-800 font-mono overflow-x-auto max-h-64">
                  {selectedLog.response || 'Không có dữ liệu response.'}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end bg-slate-50 rounded-b-xl">
              <button onClick={() => setSelectedLog(null)} className="px-5 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 text-sm font-medium">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
