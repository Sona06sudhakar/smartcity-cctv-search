import React, { useState, useEffect } from 'react';
import { Camera, FileVideo, HardDrive, BarChart3, Upload, Search, History } from 'lucide-react';

function Dashboard({ setCurrentPage, token }) {
  const [stats, setStats] = useState({
    totalVideos: 0,
    totalDetections: 0,
    personsDetected: 0,
    vehiclesDetected: 0,
    indexedEmbeddings: 0,
    avgSearchTimeMs: 0
  });
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/videos', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setVideos(data);
      }

      // Fetch dynamic stats from backend
      const statsRes = await fetch('/api/videos/dashboard-stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const statsData = await statsRes.json();
      if (statsRes.ok) {
        setStats({
          totalVideos: statsData.total_videos,
          totalDetections: statsData.total_detections,
          personsDetected: statsData.persons_detected,
          vehiclesDetected: statsData.vehicles_detected,
          indexedEmbeddings: statsData.indexed_embeddings,
          avgSearchTimeMs: statsData.avg_search_time_ms
        });
      }
    } catch (err) {
      console.error("Error fetching dashboard statistics: ", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Poll for status updates every 7 seconds
    const interval = setInterval(fetchDashboardData, 7000);
    return () => clearInterval(interval);
  }, []);

  const statsCards = [
    { label: 'Ingested Videos', value: stats.totalVideos, icon: FileVideo, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Total Detections', value: stats.totalDetections, icon: HardDrive, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Persons Detected', value: stats.personsDetected, icon: Camera, color: 'text-sky-400', bg: 'bg-sky-500/10' },
    { label: 'Vehicles Detected', value: stats.vehiclesDetected, icon: Camera, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Indexed Embeddings', value: stats.indexedEmbeddings, icon: BarChart3, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Avg Search Time', value: `${stats.avgSearchTimeMs}ms`, icon: BarChart3, color: 'text-pink-400', bg: 'bg-pink-500/10' }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Banner */}
      <div className="bg-[#121b30] border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-sky-600/10 to-transparent pointer-events-none"></div>
        <h3 className="text-xl font-bold text-white mb-2">Welcome to Smart City CCTV Forensic System</h3>
        <p className="text-slate-400 text-sm max-w-2xl">
          Ingest multi-camera security feeds, track objects (YOLOv8 + ByteTrack), perform semantic cross-camera re-identification search, and compile tamper-proof evidence packages.
        </p>
        <div className="mt-6 flex space-x-3">
          <button 
            onClick={() => setCurrentPage('upload')}
            className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all"
          >
            <Upload className="h-4 w-4" />
            <span>Upload CCTV Clip</span>
          </button>
          <button 
            onClick={() => setCurrentPage('search')}
            className="bg-[#1a233b] hover:bg-[#202c4b] border border-slate-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all"
          >
            <Search className="h-4 w-4 text-sky-400" />
            <span>Intelligent Search</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
        {statsCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="glass-card p-4 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{card.label}</span>
                <div className={`${card.bg} p-2 rounded-lg`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
              <div>
                <h4 className="text-2xl font-extrabold text-white">
                  {loading ? (
                    <div className="h-6 w-16 bg-slate-800 rounded animate-pulse"></div>
                  ) : (
                    card.value
                  )}
                </h4>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Grid: Upload Queue / Video list */}
      <div className="glass-card border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-[#0d1324]/50">
          <div>
            <h4 className="font-bold text-white">CCTV Ingestion & Processing Logs</h4>
            <p className="text-xs text-slate-400">Chronological feed of uploaded multi-camera videos and pipeline states</p>
          </div>
          <button 
            onClick={fetchDashboardData}
            className="text-xs font-semibold text-sky-400 hover:text-sky-300"
          >
            Refresh Feed
          </button>
        </div>

        {loading ? (
          <div className="p-8 space-y-4">
            <div className="h-10 bg-slate-900 rounded animate-pulse"></div>
            <div className="h-10 bg-slate-900 rounded animate-pulse"></div>
            <div className="h-10 bg-slate-900 rounded animate-pulse"></div>
          </div>
        ) : videos.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FileVideo className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="font-medium text-slate-400">No CCTV feeds ingested yet</p>
            <p className="text-xs text-slate-500 mt-1">Navigate to 'Ingest CCTV' to parse your first camera clip.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-[#0b0f19] text-xs uppercase font-bold tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Video Filename</th>
                  <th className="px-6 py-4">Camera ID</th>
                  <th className="px-6 py-4">Ingestion Date</th>
                  <th className="px-6 py-4">Duration</th>
                  <th className="px-6 py-4">Tracked Objects</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {videos.map((vid) => (
                  <tr key={vid.id} className="hover:bg-[#101726]/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-white truncate max-w-[200px]" title={vid.filename}>
                      {vid.filename}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded text-xs font-semibold border border-slate-700">
                        {vid.camera_id}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {new Date(vid.upload_time).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {vid.duration ? `${vid.duration.toFixed(1)}s` : 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-sky-400">
                      {vid.detections_count} crops
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        vid.status === 'completed' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : vid.status === 'processing'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          vid.status === 'completed' 
                            ? 'bg-emerald-500' 
                            : vid.status === 'processing'
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                        }`}></span>
                        <span>{vid.status}</span>
                      </span>
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

export default Dashboard;
