import React, { useState } from 'react';
import { GitBranch, Clock, ArrowRight, Video, Target, Camera } from 'lucide-react';

function TimelinePage({ token }) {
  const [detectionId, setDetectionId] = useState('');
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('movement'); // 'movement' | 'reid'

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
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* Search Target Card */}
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
