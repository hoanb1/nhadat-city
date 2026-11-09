import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Database, ChevronRight, FileJson } from 'lucide-react';

interface Collection {
  name: string;
  type: string;
  count: number;
}

export default function DatabaseExplorer() {
  const { token } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loadingCols, setLoadingCols] = useState(true);
  
  const [selectedCol, setSelectedCol] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);

  useEffect(() => {
    fetchCollections();
  }, []);

  useEffect(() => {
    if (selectedCol) {
      fetchDocuments(selectedCol, page);
      setSelectedDoc(null);
    }
  }, [selectedCol, page]);

  const fetchCollections = async () => {
    setLoadingCols(true);
    try {
      const res = await fetch('/api/admin/database/collections', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setCollections(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCols(false);
    }
  };

  const fetchDocuments = async (col: string, p: number) => {
    setLoadingDocs(true);
    try {
      const res = await fetch(`/api/admin/database/data?col=${col}&page=${p}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setDocuments(json.data.documents);
        setTotalPages(json.data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDocs(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-100px)] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Sidebar Collections */}
      <div className="w-64 border-r border-slate-200 flex flex-col bg-slate-50">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Database size={18} className="text-indigo-600" /> Collections
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {loadingCols ? (
            <div className="p-4 text-sm text-slate-500">Đang tải...</div>
          ) : (
            collections.map(col => (
              <button
                key={col.name}
                onClick={() => { setSelectedCol(col.name); setPage(1); }}
                className={`w-full text-left px-4 py-2 text-sm flex justify-between items-center transition-colors ${
                  selectedCol === col.name ? 'bg-indigo-50 text-indigo-700 font-medium border-r-2 border-indigo-600' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="truncate">{col.name}</span>
                <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{col.count}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {selectedCol ? (
          <>
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <ChevronRight size={16} className="text-slate-400" /> {selectedCol}
              </h3>
              
              {!loadingDocs && totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50">Trước</button>
                  <span className="text-xs text-slate-500">{page} / {totalPages}</span>
                  <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-2 py-1 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50">Sau</button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-0 flex">
              <div className="flex-1 overflow-x-auto">
                {loadingDocs ? (
                  <div className="p-8 flex justify-center"><div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>
                ) : documents.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">Collection trống.</div>
                ) : (
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50 sticky top-0 shadow-sm">
                      <tr>
                        <th className="py-2 px-4 border-b border-slate-200 font-medium text-slate-500 w-12"></th>
                        <th className="py-2 px-4 border-b border-slate-200 font-medium text-slate-500">_id</th>
                        <th className="py-2 px-4 border-b border-slate-200 font-medium text-slate-500">Data Preview</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc, idx) => (
                        <tr key={doc._id || idx} className={`border-b border-slate-100 hover:bg-indigo-50/50 cursor-pointer ${selectedDoc?._id === doc._id ? 'bg-indigo-50' : ''}`} onClick={() => setSelectedDoc(doc)}>
                          <td className="py-2 px-4 text-slate-400"><FileJson size={14} /></td>
                          <td className="py-2 px-4 font-mono text-indigo-600">{typeof doc._id === 'object' ? doc._id.toString() : doc._id}</td>
                          <td className="py-2 px-4 text-slate-600 truncate max-w-md font-mono text-xs">
                            {JSON.stringify(doc).substring(0, 100)}...
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* JSON Viewer Sidebar */}
              {selectedDoc && (
                <div className="w-1/2 border-l border-slate-200 bg-slate-900 overflow-y-auto flex flex-col shadow-inner">
                  <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-800 text-slate-300">
                    <span className="font-mono text-xs">Document Inspector</span>
                    <button onClick={() => setSelectedDoc(null)} className="text-slate-400 hover:text-white">✕</button>
                  </div>
                  <pre className="p-4 text-xs font-mono text-green-400 overflow-x-auto leading-relaxed">
                    {JSON.stringify(selectedDoc, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 flex-col gap-3">
            <Database size={48} className="opacity-20" />
            <p>Chọn một Collection ở menu bên trái để bắt đầu</p>
          </div>
        )}
      </div>
    </div>
  );
}
