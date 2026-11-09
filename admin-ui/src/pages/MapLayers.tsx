import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Map, Plus, Trash2, Edit, Save, X } from 'lucide-react';

interface MapLayer {
  _id: string;
  name: string;
  url: string;
  type: string;
  opacity: number;
  zIndex: number;
  isActive: boolean;
}

export default function MapLayers() {
  const { token } = useAuth();
  const [layers, setLayers] = useState<MapLayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MapLayer>>({});

  useEffect(() => {
    fetchLayers();
  }, []);

  const fetchLayers = async () => {
    try {
      const res = await fetch('/api/admin/map-layers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setLayers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const method = editingId === 'new' ? 'POST' : 'PUT';
      const url = editingId === 'new' ? '/api/admin/map-layers' : `/api/admin/map-layers/${editingId}`;
      
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
        fetchLayers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa lớp bản đồ này?')) return;
    try {
      const res = await fetch(`/api/admin/map-layers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchLayers();
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (layer: MapLayer) => {
    setEditingId(layer._id);
    setEditForm(layer);
  };

  const addNew = () => {
    setEditingId('new');
    setEditForm({ name: '', url: '', type: 'raster', opacity: 1, zIndex: 1, isActive: true });
  };

  if (loading) {
    return <div className="p-6 flex justify-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;
  }

  return (
    <div className="p-6 bg-slate-50 min-h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Map className="text-indigo-600" /> Quản lý Lớp Bản đồ (Map Layers)
          </h2>
          <p className="text-slate-500 mt-1">Cấu hình các bản đồ nền, quy hoạch, giao thông hiển thị cho người dùng.</p>
        </div>
        <button onClick={addNew} className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2 hover:bg-indigo-700 shadow-sm transition-colors">
          <Plus size={18} /> Thêm Lớp Mới
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                <th className="py-3 px-4 font-medium">Tên lớp (Name)</th>
                <th className="py-3 px-4 font-medium">Tile URL / Source</th>
                <th className="py-3 px-4 font-medium">Loại</th>
                <th className="py-3 px-4 font-medium text-center">Độ mờ (Opacity)</th>
                <th className="py-3 px-4 font-medium text-center">Trạng thái</th>
                <th className="py-3 px-4 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {editingId === 'new' && (
                <tr className="bg-indigo-50/50">
                  <td className="py-3 px-4"><input type="text" className="w-full border rounded px-2 py-1 text-sm" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} placeholder="Vd: Quy hoạch 2030" /></td>
                  <td className="py-3 px-4"><input type="text" className="w-full border rounded px-2 py-1 text-sm" value={editForm.url || ''} onChange={e => setEditForm({...editForm, url: e.target.value})} placeholder="https://..." /></td>
                  <td className="py-3 px-4">
                    <select className="border rounded px-2 py-1 text-sm" value={editForm.type || 'raster'} onChange={e => setEditForm({...editForm, type: e.target.value})}>
                      <option value="raster">Raster (XYZ)</option>
                      <option value="vector">Vector</option>
                      <option value="geojson">GeoJSON</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-center"><input type="number" step="0.1" max="1" min="0" className="w-16 border rounded px-2 py-1 text-sm" value={editForm.opacity || 1} onChange={e => setEditForm({...editForm, opacity: parseFloat(e.target.value)})} /></td>
                  <td className="py-3 px-4 text-center"><input type="checkbox" checked={editForm.isActive || false} onChange={e => setEditForm({...editForm, isActive: e.target.checked})} /></td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={handleSave} className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700"><Save size={16} /></button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"><X size={16} /></button>
                    </div>
                  </td>
                </tr>
              )}

              {layers.map(layer => editingId === layer._id ? (
                <tr key={layer._id} className="bg-indigo-50/50">
                  <td className="py-3 px-4"><input type="text" className="w-full border rounded px-2 py-1 text-sm" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} /></td>
                  <td className="py-3 px-4"><input type="text" className="w-full border rounded px-2 py-1 text-sm" value={editForm.url || ''} onChange={e => setEditForm({...editForm, url: e.target.value})} /></td>
                  <td className="py-3 px-4">
                    <select className="border rounded px-2 py-1 text-sm" value={editForm.type || 'raster'} onChange={e => setEditForm({...editForm, type: e.target.value})}>
                      <option value="raster">Raster (XYZ)</option>
                      <option value="vector">Vector</option>
                      <option value="geojson">GeoJSON</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-center"><input type="number" step="0.1" max="1" min="0" className="w-16 border rounded px-2 py-1 text-sm" value={editForm.opacity || 1} onChange={e => setEditForm({...editForm, opacity: parseFloat(e.target.value)})} /></td>
                  <td className="py-3 px-4 text-center"><input type="checkbox" checked={editForm.isActive || false} onChange={e => setEditForm({...editForm, isActive: e.target.checked})} /></td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={handleSave} className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700"><Save size={16} /></button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"><X size={16} /></button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={layer._id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-800">{layer.name}</td>
                  <td className="py-3 px-4 text-sm text-slate-500 max-w-[250px] truncate" title={layer.url}>{layer.url}</td>
                  <td className="py-3 px-4"><span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">{layer.type}</span></td>
                  <td className="py-3 px-4 text-center font-mono text-sm text-slate-600">{layer.opacity}</td>
                  <td className="py-3 px-4 text-center">
                    {layer.isActive ? (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">Bật</span>
                    ) : (
                      <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">Tắt</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => startEdit(layer)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"><Edit size={16} /></button>
                      <button onClick={() => handleDelete(layer._id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}

              {layers.length === 0 && editingId !== 'new' && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">Chưa có lớp bản đồ nào. Hãy thêm mới!</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
