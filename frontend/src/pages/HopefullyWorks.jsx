import React, { useRef, useState } from 'react';

const API_BASE = 'http://localhost:8000';

function HopefullyWorksPage() {
  const fileInputRef = useRef(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [status, setStatus] = useState('Select a CCTV video to start');
  const [isUploading, setIsUploading] = useState(false);
  const [processedVideoUrl, setProcessedVideoUrl] = useState('');
  const [outputFileName, setOutputFileName] = useState('');

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setStatus('File selected. Uploading to backend for YOLO processing...');
    uploadVideo(file);
  };

  const uploadVideo = async (file) => {
    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/api/videos/process`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Video processing failed');
      }

      const data = await response.json();
      setOutputFileName(data.output_file || 'processed-video.mp4');
      setProcessedVideoUrl(`${API_BASE}${data.video_url}`);
      setStatus(`Processed successfully. ${data.frame_count || 0} frames analyzed.`);
    } catch (error) {
      console.error(error);
      setStatus(error.message || 'Processing failed.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ background: '#09111f', minHeight: '100vh', padding: 24, color: '#f8fafc' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h2 style={{ marginBottom: 12 }}>Hopefully Works</h2>
        <p style={{ marginBottom: 20, color: '#cbd5e1' }}>
          Upload a CCTV .avi / .mp4 file. The backend will run YOLO, draw person/car boxes, save the processed MP4, and return it here.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 20 }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            style={{
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '10px 16px',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              opacity: isUploading ? 0.7 : 1,
              fontWeight: 700,
            }}
          >
            {isUploading ? 'Processing...' : 'Open CCTV Video'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".avi,.mp4,.mov,.mkv,video/*"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />

          <span style={{ color: '#a5b4fc' }}>
            Selected: {selectedFileName || 'No file chosen'}
          </span>
        </div>

        <div style={{ marginBottom: 20, color: '#dbeafe' }}>
          <strong>Status:</strong> {status}
        </div>

        {outputFileName && (
          <div style={{ marginBottom: 12, color: '#86efac' }}>
            Output: {outputFileName}
          </div>
        )}

        {processedVideoUrl ? (
          <div style={{ border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden', background: '#020617' }}>
            <video
              key={processedVideoUrl}
              src={processedVideoUrl}
              controls
              autoPlay
              playsInline
              style={{ width: '100%', display: 'block', maxHeight: 700, background: '#000' }}
            />
          </div>
        ) : (
          <div style={{ border: '1px dashed #334155', borderRadius: 12, padding: 24, color: '#94a3b8', textAlign: 'center' }}>
            No processed video yet.
          </div>
        )}
      </div>
    </div>
  );
}

export default HopefullyWorksPage;
