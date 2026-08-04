import React, { useState } from 'react';
import { UploadCloud, Camera, CheckCircle, FileVideo, AlertCircle, FolderOpen, Cpu, RefreshCw } from 'lucide-react';

function UploadPage({ token }) {
  const [cameraId, setCameraId] = useState('Camera_01');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' }); // type: 'success' | 'error' | 'info'
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setStatusMsg({ text: 'Please select a CCTV video file first.', type: 'error' });
      return;
    }

    setUploading(true);
    setStatusMsg({ text: 'Ingesting video file and sending to GPU analytics queue...', type: 'info' });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('camera_id', cameraId);

      const response = await fetch('/api/videos/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Upload failed');
      }

      setStatusMsg({ 
        text: 'CCTV feed ingested! Tracking pipeline (YOLOv8 + ByteTrack) running in the background. Check Dashboard logs.', 
        type: 'success' 
      });
      setFile(null);
    } catch (err) {
      setStatusMsg({ text: err.message, type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleScanLocal = async () => {
    setScanning(true);
    setStatusMsg({ text: 'Scanning backend/videos directory for new CCTV feeds...', type: 'info' });
    setScanResult(null);

    try {
      const response = await fetch('/api/videos/scan-local', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to scan and ingest local datasets.');
      }

      if (data.count > 0) {
        setStatusMsg({
          text: `Scan complete! Queued ${data.count} new local CCTV feed(s) for background tracking & Re-ID analysis.`,
          type: 'success'
        });
        setScanResult(data);
      } else {
        setStatusMsg({
          text: 'Scan complete! No new video files found in backend/videos (already ingested or directory empty).',
          type: 'success'
        });
      }
    } catch (err) {
      setStatusMsg({ text: err.message, type: 'error' });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Top Banner Status message */}
      {statusMsg.text && (
        <div className={`p-4 rounded-xl border flex items-start space-x-3 text-sm ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : statusMsg.type === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : 'bg-sky-500/10 border-sky-500/20 text-sky-400 animate-pulse'
        }`}>
          {statusMsg.type === 'success' ? (
            <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Card 1: Browser Upload */}
        <div className="glass-card p-8 border border-slate-800 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-sky-400" />
                <span>Upload CCTV Feed</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">Upload a video clip from your browser and assign its corresponding Camera ID.</p>
            </div>

            <form onSubmit={handleUpload} className="space-y-6">
              {/* Camera ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Camera Source Label</label>
                <div className="relative">
                  <Camera className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={cameraId}
                    onChange={(e) => setCameraId(e.target.value)}
                    className="w-full bg-slate-900/60 border border-slate-800 focus:border-sky-500/50 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
                    placeholder="e.g. Camera_3, Main_Entrance_CAM"
                  />
                </div>
                <p className="text-[10px] text-slate-500">Assign a unique label indicating the source (e.g. CAM_Gate_1) to track cross-camera re-identification correctly.</p>
              </div>

              {/* File Upload Drop Area */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">CCTV Video File</label>
                <div className="border-2 border-dashed border-slate-800 hover:border-sky-500/40 rounded-xl p-6 bg-[#090e1c] text-center hover:bg-[#0c1224] transition-colors relative cursor-pointer">
                  <input
                    type="file"
                    required
                    accept="video/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploading}
                  />
                  <UploadCloud className="h-10 w-10 text-slate-500 mx-auto mb-2" />
                  
                  {file ? (
                    <div className="space-y-1">
                      <p className="font-semibold text-sky-400 text-xs truncate max-w-[200px] mx-auto">{file.name}</p>
                      <p className="text-[10px] text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-300">Click to browse or drag & drop CCTV files</p>
                      <p className="text-[10px] text-slate-500">Supports .mp4, .avi, .mov, or .mkv</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={uploading || !file}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-medium py-3 rounded-xl shadow-lg shadow-sky-600/10 hover:shadow-sky-500/20 active:scale-[0.98] transition-all flex justify-center items-center space-x-2 text-sm disabled:opacity-50"
              >
                {uploading ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>Start Tracking Ingestion</span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Card 2: Server-Side Local Ingestion */}
        <div className="glass-card p-8 border border-slate-800 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-sky-400" />
                <span>Server-Side Dataset Ingestion</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Process high-resolution files pre-loaded in the server's <code className="text-sky-300 bg-slate-950 px-1 py-0.5 rounded font-mono">backend/videos/</code> repository.
              </p>
            </div>

            <div className="bg-[#090e1c] border border-slate-800 rounded-xl p-5 space-y-4 text-xs text-slate-300">
              <div className="flex items-center space-x-3">
                <div className="bg-sky-500/10 p-2 rounded-lg shrink-0">
                  <Cpu className="h-5 w-5 text-sky-400 animate-pulse" />
                </div>
                <div>
                  <p className="font-semibold text-slate-200">Batch Video Processing</p>
                  <p className="text-slate-500 text-[10px]">Files remain intact on the server disk. Duplicates are auto-skipped.</p>
                </div>
              </div>

              <div className="border-t border-slate-800/80 pt-3">
                <p className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] mb-2">Camera Mapping Rules</p>
                <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                  <li><code className="text-slate-300 font-mono">Export__CameraLabel_*.avi</code> &rarr; maps to <span className="text-sky-400">CameraLabel</span></li>
                  <li>Other files split by underscore or default to <span className="text-slate-500">CAM_IMPORT</span></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <button
              onClick={handleScanLocal}
              disabled={scanning}
              className="w-full bg-[#16223f] hover:bg-[#1d2c52] border border-sky-500/30 hover:border-sky-500/60 text-sky-400 font-medium py-3 rounded-xl shadow-lg active:scale-[0.98] transition-all flex justify-center items-center space-x-2 text-sm disabled:opacity-50"
            >
              {scanning ? (
                <div className="h-4 w-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span>Scan & Ingest Directory</span>
                </>
              )}
            </button>

            {scanResult && (
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 text-[11px] text-slate-400 max-h-40 overflow-y-auto space-y-2">
                <p className="font-bold text-slate-300">Queued {scanResult.count} new videos:</p>
                <ul className="space-y-1 font-mono text-[10px]">
                  {scanResult.ingested.map((item, idx) => (
                    <li key={idx} className="flex justify-between border-b border-slate-800/40 pb-1 last:border-0">
                      <span className="text-emerald-400 truncate max-w-[220px]" title={item.filename}>{item.filename}</span>
                      <span className="text-slate-500 font-sans">[{item.camera_id}]</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default UploadPage;
