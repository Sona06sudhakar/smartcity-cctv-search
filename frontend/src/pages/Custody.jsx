import React, { useState } from 'react';
import { Shield, FileCheck, AlertTriangle, UploadCloud, Clock, User, HardDrive } from 'lucide-react';

function CustodyPage({ token }) {
  const [file, setFile] = useState(null);
  const [hashInput, setHashInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setVerifyResult(null);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!file && !hashInput) return;
    
    setChecking(true);
    setVerifyResult(null);

    try {
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      } else {
        formData.append('file_hash', hashInput);
      }

      const response = await fetch('/api/custody/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (response.ok) {
        setVerifyResult(data);
      } else {
        throw new Error(data.detail || 'Verification request failed');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* Overview */}
      <div className="glass-card border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-xl font-bold text-white flex items-center space-x-2">
          <Shield className="h-5 w-5 text-sky-400" />
          <span>Chain of Custody Verification Portal</span>
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Verify the authenticity and integrity of exported clips, images, and forensic PDF reports. Uploading a file computes its SHA256 checksum on the gateway and validates it against the secure custody ledger.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload and verify */}
        <div className="glass-card border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <h4 className="font-bold text-white text-sm uppercase tracking-wider">Option A: Drop File for Verification</h4>
          
          <div className="border-2 border-dashed border-slate-800 hover:border-sky-500/40 rounded-xl p-8 bg-[#090e1c] text-center hover:bg-[#0c1224] transition-colors relative cursor-pointer">
            <input
              type="file"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={checking}
            />
            <UploadCloud className="h-10 w-10 text-slate-500 mx-auto mb-3" />
            
            {file ? (
              <div className="space-y-1">
                <p className="font-semibold text-sky-400 text-xs truncate max-w-[200px] mx-auto">{file.name}</p>
                <p className="text-[10px] text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-300">Drag & drop exported file here</p>
                <p className="text-[10px] text-slate-500">Upload PDF report, clip, or crop image</p>
              </div>
            )}
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-4 text-slate-500 text-[10px] uppercase font-bold tracking-widest">OR</span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          <div className="space-y-1.5">
            <h4 className="font-bold text-white text-sm uppercase tracking-wider">Option B: Query SHA256 Signature</h4>
            <input
              type="text"
              value={hashInput}
              onChange={(e) => {
                setHashInput(e.target.value);
                setFile(null); // Clear file option
                setVerifyResult(null);
              }}
              className="w-full bg-slate-900 border border-slate-850 focus:border-sky-500/50 rounded-xl py-2.5 px-4 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
              placeholder="Paste 64-character SHA256 signature hash..."
            />
          </div>

          <button
            onClick={handleVerify}
            disabled={checking || (!file && !hashInput)}
            className="w-full bg-sky-600 hover:bg-sky-500 text-white font-medium py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            {checking ? 'Hashing & Querying...' : 'Validate Signature Integrity'}
          </button>
        </div>

        {/* Verification Results display */}
        <div className="glass-card border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-center">
          {!verifyResult ? (
            <div className="text-center text-slate-500 py-12 space-y-2">
              <Shield className="h-12 w-12 text-slate-700 mx-auto" />
              <p className="font-semibold text-slate-400">Awaiting Signature Query</p>
              <p className="text-xs text-slate-500 max-w-[220px] mx-auto">Upload an evidence asset or paste its SHA256 to run integrity verification checks.</p>
            </div>
          ) : verifyResult.status === 'authentic' ? (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl flex items-center space-x-3 text-emerald-400">
                <FileCheck className="h-8 w-8 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">AUTHENTIC FORENSIC RECORD</h4>
                  <p className="text-xs text-emerald-500/80 mt-0.5">Integrity check completed. Cryptographic hash is valid and untampered.</p>
                </div>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-850">
                  <span className="text-slate-400">Asset Type:</span>
                  <span className="col-span-2 text-white font-semibold capitalize">{verifyResult.file_type.replace('_', ' ')}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-850">
                  <span className="text-slate-400">Export Path:</span>
                  <span className="col-span-2 text-sky-400 font-mono truncate" title={verifyResult.file_path}>{verifyResult.file_path}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-850">
                  <span className="text-slate-400">Timestamp:</span>
                  <span className="col-span-2 text-white font-medium flex items-center space-x-1">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    <span>{new Date(verifyResult.export_time).toLocaleString()}</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-850">
                  <span className="text-slate-400">Investigator:</span>
                  <span className="col-span-2 text-white font-medium flex items-center space-x-1">
                    <User className="h-3.5 w-3.5 text-slate-500" />
                    <span>{verifyResult.generated_by}</span>
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400">Cryptographic Seal (SHA256):</span>
                  <p className="bg-slate-900 border border-slate-850 px-3 py-2 rounded font-mono text-[10px] text-sky-400 select-all leading-relaxed break-all">
                    {verifyResult.file_hash}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5 text-center py-6 animate-in fade-in duration-200">
              <AlertTriangle className="h-16 w-16 text-rose-500 mx-auto animate-pulse" />
              <div className="space-y-1">
                <h4 className="font-extrabold text-rose-500 text-sm">SECURITY ALARM: INTEGRITY COMPROMISED</h4>
                <p className="text-xs text-slate-400 max-w-[280px] mx-auto">
                  No matching signature found. The file has either been modified after export or originated outside this platform.
                </p>
              </div>
              <div className="bg-slate-900 border border-slate-850 px-3 py-2 rounded text-[10px] font-mono text-slate-500 max-w-xs mx-auto break-all">
                Hash: {verifyResult.file_hash}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CustodyPage;
