import React, { useState, useRef, useEffect } from 'react';
import { GitBranch, Clock, ArrowRight, Video, Target, Camera, Play, Search, SkipForward, Box, Upload, X } from 'lucide-react';

function TimelinePage({ token }) {
  const [detectionId, setDetectionId] = useState('');
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('movement'); // 'movement' | 'reid'
  
  // Video player state
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoDetections, setVideoDetections] = useState([]);
  const [videoSearchQuery, setVideoSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentTimestamp, setCurrentTimestamp] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showYoloBoxes, setShowYoloBoxes] = useState(true);
  
  // Video import state
  const [importFile, setImportFile] = useState(null);
  const [importCameraId, setImportCameraId] = useState('Camera_01');
  const [importing, setImporting] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch processed videos
  const fetchVideos = async () => {
    try {
      const response = await fetch('/api/tracking/videos', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setVideos(data);
      }
    } catch (err) {
      console.error('Failed to fetch videos:', err);
    }
  };

  // Fetch detections for selected video
  const fetchVideoDetections = async (videoId) => {
    try {
      const response = await fetch(`/api/tracking/video/${videoId}/detections`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setVideoDetections(data);
      }
    } catch (err) {
      console.error('Failed to fetch video detections:', err);
    }
  };

  // Handle video selection
  const handleVideoSelect = (video) => {
    setSelectedVideo(video);
    fetchVideoDetections(video.id);
    setSearchResults([]);
    setVideoSearchQuery('');
  };

  // Search within video
  const handleVideoSearch = async (e) => {
    e.preventDefault();
    if (!selectedVideo || !videoSearchQuery) return;
    
    console.log('Searching for:', videoSearchQuery, 'in video:', selectedVideo.id);
    
    try {
      const response = await fetch(`/api/tracking/video/${selectedVideo.id}/search`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: videoSearchQuery })
      });
      const data = await response.json();
      console.log('Search response:', data);
      setSearchResults(data.matches || []);
      
      // Jump to first result if available
      if (data.matches && data.matches.length > 0) {
        console.log('First match timestamp:', data.matches[0].timestamp_sec);
        jumpToTimestamp(data.matches[0].timestamp_sec);
      } else {
        console.log('No matches found');
      }
    } catch (err) {
      console.error('Video search failed:', err);
    }
  };

  // Jump to specific timestamp
  const jumpToTimestamp = (timestampSec) => {
    console.log('Jumping to timestamp:', timestampSec);
    if (videoRef.current) {
      videoRef.current.currentTime = timestampSec;
      setCurrentTimestamp(timestampSec);
      console.log('Video currentTime set to:', videoRef.current.currentTime);
      
      // Play video
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        console.log('Video started playing');
      }).catch(err => {
        console.error('Error playing video:', err);
      });
    } else {
      console.error('Video ref is null');
    }
  };

  // Draw YOLO boxes on canvas
  const drawYoloBoxes = () => {
    if (!canvasRef.current || !videoRef.current || !showYoloBoxes) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get current timestamp
    const currentTime = video.currentTime;
    
    // Find detections for current timestamp (within 0.5 seconds)
    const currentDetections = videoDetections.filter(
      d => Math.abs(d.timestamp_sec - currentTime) < 0.5
    );
    
    // Draw boxes
    currentDetections.forEach(det => {
      const { bbox, class_name, track_id } = det;
      
      // Scale coordinates to canvas size
      const scaleX = canvas.width / video.videoWidth;
      const scaleY = canvas.height / video.videoHeight;
      
      const x = bbox.x1 * scaleX;
      const y = bbox.y1 * scaleY;
      const width = (bbox.x2 - bbox.x1) * scaleX;
      const height = (bbox.y2 - bbox.y1) * scaleY;
      
      // Draw box
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
      
      // Draw label
      ctx.fillStyle = '#00ff00';
      ctx.font = '12px Arial';
      ctx.fillText(`${class_name} #${track_id}`, x, y - 5);
    });
  };

  // Update canvas on video time update and resize
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video && canvas) {
      const handleTimeUpdate = () => {
        setCurrentTimestamp(video.currentTime);
        drawYoloBoxes();
      };
      
      const handleLoadedMetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        drawYoloBoxes();
      };
      
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      
      return () => {
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [videoDetections, showYoloBoxes]);

  // Load videos on component mount
  useEffect(() => {
    fetchVideos();
  }, []);

  // Handle file selection for import
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
  };

  // Import video
  const handleImportVideo = async (e) => {
    e.preventDefault();
    if (!importFile || !importCameraId) return;
    
    setImporting(true);
    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('camera_id', importCameraId);
    
    try {
      const response = await fetch('/api/videos/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(`Video uploaded successfully! Processing in background. Video ID: ${data.video_id}`);
        setImportFile(null);
        setImportCameraId('Camera_01');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        // Refresh video list after a short delay
        setTimeout(() => fetchVideos(), 2000);
      } else {
        const errorData = await response.json();
        alert(`Upload failed: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const fetchTimeline = async (e) => {
    e.preventDefault();
    if (!detectionId) return;
    setLoading(true);
    setError('');
    setTimelineData(null);

    try {
      const response = await fetch(`/api/tracking/timeline/${detectionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to fetch timeline tracking path');
      }

      setTimelineData(data);
      setActiveTab('movement');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* Video Player Section */}
      <div className="glass-card p-6 border border-slate-800 rounded-2xl shadow-xl">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-white flex items-center space-x-2">
            <Video className="h-5 w-5 text-sky-400" />
            <span>Video Player with YOLO Detection Boxes</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Select a processed video to play with real-time YOLO detection overlays. Search within video to jump to specific attributes.
          </p>
        </div>

        {/* Video Import */}
        <div className="mb-6 bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
              <Upload className="h-4 w-4 text-sky-400" />
              <span>Import New Video</span>
            </label>
          </div>
          <form onSubmit={handleImportVideo} className="flex space-x-3">
            <input
              type="text"
              value={importCameraId}
              onChange={(e) => setImportCameraId(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs w-32 focus:border-sky-500/50 focus:outline-none text-white"
              placeholder="Camera ID"
            />
            <div className="relative flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp4,.avi,.mov,.mkv"
                onChange={handleFileSelect}
                className="text-xs text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-500 cursor-pointer w-full"
              />
            </div>
            <button
              type="submit"
              disabled={importing || !importFile}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              {importing ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  <span>Import</span>
                </>
              )}
            </button>
            {importFile && (
              <button
                type="button"
                onClick={() => {
                  setImportFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-slate-400 hover:text-red-400 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>
        </div>

        {/* Video List */}
        <div className="mb-6">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Processed Videos</label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {videos.map(video => (
              <button
                key={video.id}
                onClick={() => handleVideoSelect(video)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedVideo?.id === video.id 
                    ? 'bg-sky-600/20 border-sky-500' 
                    : 'bg-slate-900 border-slate-800 hover:border-slate-750'
                }`}
              >
                <div className="flex items-center space-x-2 mb-2">
                  <Camera className="h-4 w-4 text-sky-400" />
                  <span className="text-xs font-bold text-white">{video.camera_id}</span>
                </div>
                <p className="text-xs text-slate-300 truncate">{video.filename}</p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Duration: {video.duration.toFixed(1)}s | {new Date(video.upload_time).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Video Player */}
        {selectedVideo && (
          <div className="space-y-4">
            {/* Search Bar */}
            <form onSubmit={handleVideoSearch} className="flex space-x-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="text"
                  value={videoSearchQuery}
                  onChange={(e) => setVideoSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-850 focus:border-sky-500/50 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
                  placeholder="Search within video (e.g., 'red shirt', 'person with cap')..."
                />
              </div>
              <button
                type="submit"
                className="bg-sky-600 hover:bg-sky-500 text-white px-6 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
              >
                <SkipForward className="h-4 w-4" />
                <span>Jump to Match</span>
              </button>
              <button
                type="button"
                onClick={() => setShowYoloBoxes(!showYoloBoxes)}
                className={`px-4 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                  showYoloBoxes ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                <Box className="h-4 w-4" />
                <span>{showYoloBoxes ? 'Hide Boxes' : 'Show Boxes'}</span>
              </button>
            </form>

            {/* Video Container */}
            <div className="relative bg-black rounded-xl overflow-hidden">
              <video
                ref={videoRef}
                src={`/static/videos/${encodeURIComponent(selectedVideo.filename)}`}
                className="w-full"
                controls
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{ display: showYoloBoxes ? 'block' : 'none' }}
              />
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-400 mb-3">
                  Found {searchResults.length} matches for "{videoSearchQuery}"
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {searchResults.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => jumpToTimestamp(result.timestamp_sec)}
                      className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-800 hover:bg-slate-750 transition-colors text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <Clock className="h-4 w-4 text-sky-400" />
                        <span className="text-xs text-white">{result.timestamp}</span>
                        <span className="text-[10px] text-slate-400">{result.class_name} #{result.track_id}</span>
                      </div>
                      <Play className="h-3 w-3 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Original Timeline Section */}
      <div className="glass-card p-6 border border-slate-800 rounded-2xl shadow-xl">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-white flex items-center space-x-2">
            <GitBranch className="h-5 w-5 text-sky-400" />
            <span>Cross-Camera Object Re-Identification</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Input a detection's Database ID to scan all processed CCTV clips. The engine will match visual features (CLIP embeddings) and trace its chronological path.
          </p>
        </div>

        <form onSubmit={fetchTimeline} className="flex space-x-3">
          <input
            type="number"
            required
            value={detectionId}
            onChange={(e) => setDetectionId(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-850 focus:border-sky-500/50 rounded-xl py-2.5 px-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            placeholder="Enter Target Detection ID (e.g. 1, 24, 102)..."
          />
          <button
            type="submit"
            disabled={loading || !detectionId}
            className="bg-sky-600 hover:bg-sky-500 text-white px-6 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span>Track Entity Path</span>
            )}
          </button>
        </form>

        {error && (
          <p className="text-xs text-red-400 mt-3 font-semibold uppercase tracking-wider">⚠️ {error}</p>
        )}
      </div>

      {/* Timeline Display Card */}
      {timelineData && (
        <div className="glass-card border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          
          {/* Target details */}
          <div className="bg-[#121c33]/40 border border-sky-900/30 rounded-xl p-4 flex items-center space-x-4">
            <div className="h-20 w-20 bg-[#0a0f1d] rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center shrink-0">
              <img src={timelineData.target.image_path} alt="Target Object" className="max-h-full max-w-full object-contain" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest block">Root Target Entity</span>
              <h4 className="text-base font-bold text-white capitalize mt-0.5">{timelineData.target.class_name} (ID: {timelineData.target.id})</h4>
              <p className="text-xs text-slate-400 mt-1">First seen in camera <span className="text-white font-semibold">{timelineData.target.camera_id}</span> at offset <span className="text-white font-semibold">{timelineData.target.timestamp}</span></p>
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-6">
            {/* Tabs Header */}
            <div className="flex space-x-3 mb-6 border-b border-slate-800 pb-4">
              <button 
                onClick={() => setActiveTab('movement')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'movement' ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
              >
                Track Internal Path (Same Camera)
              </button>
              <button 
                onClick={() => setActiveTab('reid')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'reid' ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
              >
                Cross-Camera Visual Correlation (Possible Matches)
              </button>
            </div>
            
            {activeTab === 'movement' ? (
              timelineData.track_movement.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  No internal track movement data found.
                </div>
              ) : (
                <div className="relative pl-8 space-y-8 border-l border-slate-800 ml-4">
                  {timelineData.track_movement.map((point, idx) => (
                    <div key={idx} className="relative">
                      <span className="absolute -left-[39px] top-1.5 h-6 w-6 rounded-full bg-[#0c1222] border-2 border-sky-500 flex items-center justify-center">
                        <Clock className="h-3.5 w-3.5 text-sky-400" />
                      </span>
                      <div className="bg-[#121a2c]/70 border border-slate-850 p-4 rounded-xl flex items-center space-x-4 hover:border-slate-750 transition-colors">
                        <div className="h-16 w-16 bg-[#0a0f1d] rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center shrink-0">
                          <img src={point.image_path} alt="Movement Point" className="max-h-full max-w-full object-contain" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="bg-sky-600/10 border border-sky-500/20 text-sky-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                                Camera: {point.camera_id}
                              </span>
                              <span className="ml-2 text-xs font-semibold text-slate-400">Track ID: #{point.track_id}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-semibold">Frame: {point.detection_id}</span>
                          </div>
                          <p className="text-xs text-slate-300 mt-2 font-medium">
                            Confidence: <span className="text-sky-400 font-bold">{(point.confidence * 100).toFixed(0)}%</span>
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Video Timestamp: {point.timestamp}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              timelineData.possible_matches.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  No visual re-identification matches found across other cameras.
                </div>
              ) : (
                <div className="relative pl-8 space-y-8 border-l border-slate-800 ml-4">
                  {timelineData.possible_matches.map((point, idx) => (
                    <div key={idx} className="relative">
                      <span className="absolute -left-[39px] top-1.5 h-6 w-6 rounded-full bg-[#0c1222] border-2 border-emerald-500 flex items-center justify-center">
                        <Camera className="h-3.5 w-3.5 text-emerald-400" />
                      </span>
                      <div className="bg-[#121a2c]/70 border border-slate-850 p-4 rounded-xl flex items-center space-x-4 hover:border-slate-750 transition-colors">
                        <div className="h-16 w-16 bg-[#0a0f1d] rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center shrink-0">
                          <img src={point.image_path} alt="Possible Match" className="max-h-full max-w-full object-contain" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                                Possible Match: {point.camera_id}
                              </span>
                              <span className="ml-2 text-xs font-semibold text-slate-400">Track ID: #{point.track_id}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-semibold">{point.absolute_time_str}</span>
                          </div>
                          <p className="text-xs text-slate-300 mt-2 font-medium">
                            Visual Similarity: <span className="text-emerald-400 font-bold">{(point.similarity_score * 100).toFixed(0)}%</span>
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Video Timestamp: {point.timestamp}</p>
                          <div className="mt-2 text-[10px] text-slate-400 italic">
                            Disclaimer: Labeled as possible match. Direct identity correlation requires visual confirmation.
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TimelinePage;
