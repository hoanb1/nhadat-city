import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Database, Plus, Trash2, Edit, Save, X, Layers, Compass, FileText, Map as MapIcon } from 'lucide-react';

const TABS = [
  { id: 'propertyTypes', label: 'Loại hình BĐS', icon: Layers },
  { id: 'directions', label: 'Hướng nhà', icon: Compass },
  { id: 'legalDocumentTypes', label: 'Giấy tờ pháp lý', icon: FileText },
  { id: 'roadTypes', label: 'Loại đường/Ngõ', icon: MapIcon },
];

export default function MasterData() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('propertyTypes');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/master-data/${activeTab}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (Array.isArray(json)) setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const method = editingId === 'new' ? 'POST' : 'PUT';
      const url = editingId === 'new' ? `/api/admin/master-data/${activeTab}` : `/api/admin/master-data/${activeTab}/${editingId}`;
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });
      
      if (res.ok) {
        setEditingId(null);
        fetchData();
      } else {
        const err = await res.json();
        alert('Lỗi: ' + err.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hành động này sẽ xóa danh mục. Bạn có chắc chắn?')) return;
    try {
      const res = await fetch(`/api/admin/master-data/${activeTab}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (item: any) => {
    setEditingId(item._id);
    setEditForm(item);
  };

  const addNew = () => {
    setEditingId('new');
    setEditForm({ _id: '', name: '', order: data.length + 1, type: 'all' });
  };

  return (
    <div className="p-6 bg-slate-50 min-h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Database className="text-indigo-600" /> Quản lý Danh mục (Master Data)
          </h2>
          <p className="text-slate-500 mt-1">Cấu hình các từ điển tĩnh dùng chung cho toàn bộ hệ thống.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row">
        
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 border-r border-slate-200 bg-slate-50/50 flex-shrink-0">
          <nav className="p-4 flex flex-col gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors text-left
                    ${activeTab === tab.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
                  `}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800">
              {TABS.find(t => t.id === activeTab)?.label}
            </h3>
            <button onClick={addNew} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm flex items-center gap-2 hover:bg-indigo-700 shadow-sm transition-colors">
              <Plus size={16} /> Thêm mới
            </button>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center"><div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full"></div></div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="py-3 px-4 font-medium w-32">Mã (ID)</th>
                    <th className="py-3 px-4 font-medium">Tên hiển thị</th>
                    <th className="py-3 px-4 font-medium text-center w-24">Thứ tự</th>
                    <th className="py-3 px-4 font-medium text-right w-24">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {editingId === 'new' && (
                    <tr className="bg-indigo-50/50">
                      <td className="py-2 px-4"><input type="text" className="w-full border border-indigo-200 rounded px-2 py-1.5 text-sm" value={editForm._id || ''} onChange={e => setEditForm({...editForm, _id: e.target.value})} placeholder="Vd: nha_o" /></td>
                      <td className="py-2 px-4"><input type="text" className="w-full border border-indigo-200 rounded px-2 py-1.5 text-sm" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} placeholder="Tên hiển thị" /></td>
                      <td className="py-2 px-4 text-center"><input type="number" className="w-16 border border-indigo-200 rounded px-2 py-1.5 text-sm text-center" value={editForm.order || 0} onChange={e => setEditForm({...editForm, order: parseInt(e.target.value)})} /></td>
                      <td className="py-2 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={handleSave} className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700"><Save size={14} /></button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"><X size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {data.map(item => editingId === item._id ? (
                    <tr key={item._id} className="bg-indigo-50/50">
                      <td className="py-2 px-4 text-sm font-mono text-slate-500">{item._id}</td>
                      <td className="py-2 px-4"><input type="text" className="w-full border border-indigo-200 rounded px-2 py-1.5 text-sm" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} /></td>
                      <td className="py-2 px-4 text-center"><input type="number" className="w-16 border border-indigo-200 rounded px-2 py-1.5 text-sm text-center" value={editForm.order || 0} onChange={e => setEditForm({...editForm, order: parseInt(e.target.value)})} /></td>
                      <td className="py-2 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={handleSave} className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700"><Save size={14} /></button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"><X size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={item._id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-sm font-mono text-slate-500">{item._id}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{item.name}</td>
                      <td className="py-3 px-4 text-center font-mono text-sm text-slate-500">{item.order || 0}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => startEdit(item)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"><Edit size={14} /></button>
                          <button onClick={() => handleDelete(item._id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {data.length === 0 && editingId !== 'new' && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">Chưa có dữ liệu nào trong danh mục này.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
