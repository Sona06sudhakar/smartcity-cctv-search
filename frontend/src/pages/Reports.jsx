import React, { useState, useEffect } from 'react';
import { FileText, Download, ShieldCheck, Clock, User, Clipboard } from 'lucide-react';

function ReportsPage({ token }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/custody', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        // Filter for reports
        const filtered = data.filter(r => r.file_type === 'report');
        setReports(filtered);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleCopyHash = (hash) => {
    navigator.clipboard.writeText(hash);
    alert('SHA255 signature hash copied to clipboard!');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="glass-card border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-xl font-bold text-white flex items-center space-x-2">
          <FileText className="h-5 w-5 text-sky-400" />
          <span>Forensic Evidence Reports Archive</span>
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Historical archive of generated PDF forensic reports. Each report contains a tamper-proof SHA256 digital signature stored in the database for integrity validation.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-20 bg-slate-900 rounded-xl animate-pulse"></div>
          <div className="h-20 bg-slate-900 rounded-xl animate-pulse"></div>
        </div>
      ) : reports.length === 0 ? (
        <div className="glass-card border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
          <FileText className="h-12 w-12 text-slate-700 mx-auto mb-3" />
          <p className="font-semibold text-slate-400">No forensic reports generated yet</p>
          <p className="text-xs text-slate-500 mt-1">Go to 'Intelligent Search', search for items, select matches, and click 'Compile Forensic PDF'.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="glass-card border border-slate-800/80 rounded-xl p-5 hover:border-slate-750 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2 min-w-0">
                <div className="flex items-center space-x-2">
                  <h4 className="font-semibold text-white truncate max-w-md" title={report.file_path.split('/').pop()}>
                    {report.file_path.split('/').pop()}
                  </h4>
                  <span className="bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-bold px-2 py-0.5 rounded flex items-center space-x-0.5 uppercase shrink-0">
                    <ShieldCheck className="h-3 w-3" />
                    <span>Signed</span>
                  </span>
                </div>
                
                {/* Details line */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span className="flex items-center space-x-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{new Date(report.timestamp).toLocaleString()}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <User className="h-3.5 w-3.5" />
                    <span>Officer: {report.generated_by}</span>
                  </span>
                </div>

                {/* SHA256 Hash Display */}
                <div className="bg-slate-900 border border-slate-850 p-2 rounded-lg flex items-center justify-between space-x-2 max-w-xl">
                  <div className="text-[10px] text-slate-500 font-mono truncate">
                    SHA256: <span className="text-sky-400 font-semibold">{report.file_hash}</span>
                  </div>
                  <button 
                    onClick={() => handleCopyHash(report.file_hash)}
                    className="text-slate-500 hover:text-sky-400 p-1 rounded shrink-0 hover:bg-[#121b30] transition-colors"
                    title="Copy Signature Hash"
                  >
                    <Clipboard className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 shrink-0">
                <a
                  href={report.file_path}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-lg shadow-sky-600/10"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Report</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ReportsPage;
