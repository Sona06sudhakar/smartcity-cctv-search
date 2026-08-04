import React, { useState, useEffect } from 'react';
import { History, Trash2, Search, Filter, ShieldAlert, User, Shield } from 'lucide-react';

function AuditPage({ token }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const currentUser = JSON.parse(localStorage.getItem('user'));
  const isAdmin = currentUser && currentUser.role === 'admin';

  const fetchAuditLogs = async () => {
    try {
      const response = await fetch('/api/audit', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setLogs(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm("WARNING: Are you sure you want to permanently delete all forensic audit logs? This action is irreversible and will be logged in the database schema.")) return;
    
    try {
      const response = await fetch('/api/audit/clear', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        alert("Audit logs cleared successfully.");
        setLogs([]);
      } else {
        const errorData = await response.json();
        alert(errorData.detail || "Failed to clear logs");
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesUser = log.username.toLowerCase().includes(userFilter.toLowerCase());
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    return matchesUser && matchesAction;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* Header Info */}
      <div className="glass-card border border-slate-800 rounded-2xl p-6 shadow-xl flex justify-between items-center bg-[#0d1324]/50">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center space-x-2">
            <History className="h-5 w-5 text-sky-400" />
            <span>Forensic Audit Logging</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Tamper-evident logs of search queries, video ingestion pipeline activities, evidence clip downloads, and investigator sign-ins.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={handleClearLogs}
            className="bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 hover:border-red-500/40 text-red-400 text-xs px-3.5 py-2 rounded-xl font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            <span>Clear Logs Ledger</span>
          </button>
        )}
      </div>

      {/* Filters Search Bar */}
      <div className="glass-card p-4 border border-slate-800 rounded-2xl flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-850 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
            placeholder="Search by investigator username..."
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto shrink-0">
          <Filter className="h-4 w-4 text-slate-400" />
          <select 
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-300 w-full"
          >
            <option value="all">All Operations</option>
            <option value="USER_LOGIN">User Login</option>
            <option value="VIDEO_UPLOAD">Video Ingested</option>
            <option value="VIDEO_DELETE">Video Deleted</option>
            <option value="SEARCH_TEXT">Semantic Text Search</option>
            <option value="SEARCH_IMAGE">Image Similarity Search</option>
            <option value="CROSS_CAMERA_TRACK">Cross Camera Re-ID</option>
            <option value="EXPORT_REPORT">PDF Forensic Export</option>
            <option value="DOWNLOAD_CLIP">Clip Downloaded</option>
            <option value="EXPORT_ANNOTATED">Annotated BBox Export</option>
            <option value="VERIFY_INTEGRITY">Hash Verification</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-card border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-8 space-y-4">
            <div className="h-10 bg-slate-900 rounded animate-pulse"></div>
            <div className="h-10 bg-slate-900 rounded animate-pulse"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <History className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="font-semibold text-slate-400">No logs found</p>
            <p className="text-xs text-slate-500 mt-1">Change your filters or perform searches to see logs.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-[#0b0f19] text-xs uppercase font-bold tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Timestamp (UTC)</th>
                  <th className="px-6 py-4">Investigator</th>
                  <th className="px-6 py-4">Operation</th>
                  <th className="px-6 py-4">Query Parameter</th>
                  <th className="px-6 py-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#101726]/40 transition-colors">
                    <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-semibold text-white">
                      <span className="flex items-center space-x-1">
                        <User className="h-3.5 w-3.5 text-slate-500" />
                        <span>{log.username}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-[#121c33] text-sky-400 border border-sky-500/10 px-2 py-1 rounded font-bold uppercase text-[10px]">
                        {log.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-400 max-w-[150px] truncate" title={log.query}>
                      {log.query || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-300 max-w-[250px] truncate" title={log.details}>
                      {log.details || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuditPage;
