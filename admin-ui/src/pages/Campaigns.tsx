import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Target, Plus, Trash2, Edit, Save, X, Calendar, MapPin } from 'lucide-react';

export default function Campaigns() {
  const { token } = useAuth();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/campaigns', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (Array.isArray(json)) setCampaigns(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const method = editingId === 'new' ? 'POST' : 'PUT';
      const url = editingId === 'new' ? '/api/admin/campaigns' : `/api/admin/campaigns/${editingId}`;
      
      const payload = { ...editForm };
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setEditingId(null);
        fetchCampaigns();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa chiến dịch này?')) return;
    try {
      const res = await fetch(`/api/admin/campaigns/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchCampaigns();
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (item: any) => {
    setEditingId(item._id);
    setEditForm({
      name: item.name?.name || '',
      description: item.name?.description || '',
      location: item.name?.location || '',
      startDate: item.name?.startDate || '',
      endDate: item.name?.endDate || '',
      status: item.name?.status || 'Upcoming'
    });
  };

  const addNew = () => {
    setEditingId('new');
    setEditForm({
      name: '',
      description: '',
      location: '',
      startDate: '',
      endDate: '',
      status: 'Upcoming'
    });
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case 'Active': return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">Đang diễn ra</span>;
      case 'Upcoming': return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Sắp tới</span>;
      case 'Ended': return <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">Đã kết thúc</span>;
      default: return <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">{status}</span>;
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Target className="text-indigo-600" /> Quản lý Chiến dịch (Campaigns)
          </h2>
          <p className="text-slate-500 mt-1">Quản lý các sự kiện, cảnh báo hoặc chiến dịch hiển thị trên bản đồ.</p>
        </div>
        <button onClick={addNew} className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2 hover:bg-indigo-700 shadow-sm transition-colors">
          <Plus size={18} /> Thêm Chiến dịch
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                  <th className="py-3 px-4 font-medium min-w-[200px]">Chiến dịch</th>
                  <th className="py-3 px-4 font-medium min-w-[150px]">Tọa độ (Location)</th>
                  <th className="py-3 px-4 font-medium">Thời gian</th>
                  <th className="py-3 px-4 font-medium text-center">Trạng thái</th>
                  <th className="py-3 px-4 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {editingId === 'new' && (
                  <tr className="bg-indigo-50/50">
                    <td className="py-3 px-4">
                      <input type="text" className="w-full border rounded px-2 py-1 text-sm mb-2" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} placeholder="Tên chiến dịch" />
                      <textarea className="w-full border rounded px-2 py-1 text-sm" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} placeholder="Mô tả..." rows={2}></textarea>
                    </td>
                    <td className="py-3 px-4">
                      <input type="text" className="w-full border rounded px-2 py-1 text-sm" value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})} placeholder="Lng, Lat" />
                    </td>
                    <td className="py-3 px-4">
                      <input type="date" className="w-full border rounded px-2 py-1 text-sm mb-1" value={editForm.startDate} onChange={e => setEditForm({...editForm, startDate: e.target.value})} />
                      <input type="date" className="w-full border rounded px-2 py-1 text-sm" value={editForm.endDate} onChange={e => setEditForm({...editForm, endDate: e.target.value})} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <select className="border rounded px-2 py-1 text-sm" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                        <option value="Upcoming">Sắp tới</option>
                        <option value="Active">Đang diễn ra</option>
                        <option value="Ended">Đã kết thúc</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => {
                          const payload = { name: { ...editForm } };
                          setEditForm(payload);
                          setTimeout(handleSave, 100);
                        }} className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700"><Save size={16} /></button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"><X size={16} /></button>
                      </div>
                    </td>
                  </tr>
                )}

                {campaigns.map(item => editingId === item._id ? (
                  <tr key={item._id} className="bg-indigo-50/50">
                    <td className="py-3 px-4">
                      <input type="text" className="w-full border rounded px-2 py-1 text-sm mb-2" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                      <textarea className="w-full border rounded px-2 py-1 text-sm" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} rows={2}></textarea>
                    </td>
                    <td className="py-3 px-4">
                      <input type="text" className="w-full border rounded px-2 py-1 text-sm" value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})} />
                    </td>
                    <td className="py-3 px-4">
                      <input type="date" className="w-full border rounded px-2 py-1 text-sm mb-1" value={editForm.startDate} onChange={e => setEditForm({...editForm, startDate: e.target.value})} />
                      <input type="date" className="w-full border rounded px-2 py-1 text-sm" value={editForm.endDate} onChange={e => setEditForm({...editForm, endDate: e.target.value})} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <select className="border rounded px-2 py-1 text-sm" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                        <option value="Upcoming">Sắp tới</option>
                        <option value="Active">Đang diễn ra</option>
                        <option value="Ended">Đã kết thúc</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => {
                          const payload = { name: { ...editForm } };
                          setEditForm(payload);
                          setTimeout(handleSave, 100);
                        }} className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700"><Save size={16} /></button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"><X size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={item._id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800 text-sm mb-1">{item.name?.name}</div>
                      <div className="text-sm text-slate-600 line-clamp-2">{item.name?.description}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 text-sm text-slate-600">
                        <MapPin size={14} className="text-slate-400" />
                        <span className="truncate max-w-[150px]" title={item.name?.location}>{item.name?.location || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1 text-xs text-slate-600">
                        <span className="flex items-center gap-1"><Calendar size={12}/> Từ: {item.name?.startDate || '--'}</span>
                        <span className="flex items-center gap-1"><Calendar size={12}/> Đến: {item.name?.endDate || '--'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {renderStatus(item.name?.status)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => startEdit(item)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"><Edit size={16} /></button>
                        <button onClick={() => handleDelete(item._id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}

                {campaigns.length === 0 && editingId !== 'new' && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">Chưa có chiến dịch nào.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
