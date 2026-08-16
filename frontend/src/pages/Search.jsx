import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Image as ImageIcon, 
  Camera, 
  Clock, 
  Download, 
  FileText, 
  Tag, 
  User, 
  Car,
  Filter,
  CheckCircle,
  Eye,
  Activity,
  Play,
  Calendar,
  X,
  XCircle
} from 'lucide-react';

function SearchPage({ token }) {
  // Search state
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('auto');
  const [imageFile, setImageFile] = useState(null);
  const [searchMode, setSearchMode] = useState('text'); // 'text' | 'image'
  
  // Dynamic filter state
  const [cameraId, setCameraId] = useState('all');
  const [className, setClassName] = useState('all');
  const [vehicleType, setVehicleType] = useState('all');
  const [vehicleColor, setVehicleColor] = useState('all');
  const [upperColor, setUpperColor] = useState('all');
  const [lowerColor, setLowerColor] = useState('all');
  const [cap, setCap] = useState('all');
  const [bag, setBag] = useState('all');
  const [helmet, setHelmet] = useState('all');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // UI state
  const [results, setResults] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]); // Array of detection objects
  const [reporting, setReporting] = useState(false);
  const [investigatorName, setInvestigatorName] = useState('');
  const [investigatorNotes, setInvestigatorNotes] = useState('');
  
  // Playback overlay state
  const [activePlayback, setActivePlayback] = useState(null);
  const [playbackPlaying, setPlaybackPlaying] = useState(true);
  const [forceReloadKey, setForceReloadKey] = useState(0);
  
  // Timeline overlay state
  const [activeTimeline, setActiveTimeline] = useState(null); // Timeline dict
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [timelineTab, setTimelineTab] = useState('movement'); // 'movement' | 'reid'

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const response = await fetch('/api/search/suggestions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setSuggestions(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch unique cameras for the filter sidebar
  const fetchCameras = async () => {
    try {
      const response = await fetch('/api/videos', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        const uniqueCams = Array.from(new Set(data.map(v => v.camera_id)));
        setCameras(uniqueCams);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCameras();
    fetchSuggestions();
  }, []);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setSelectedItems([]); // Clear report checklist
    
    try {
      let response;
      if (searchMode === 'text') {
        response = await fetch('/api/search/text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            query,
            language,
            camera_id: cameraId,
            class_name: className,
            vehicle_type: vehicleType,
            vehicle_color: vehicleColor,
            upper_color: upperColor,
            lower_color: lowerColor,
            cap,
            bag,
            helmet,
            start_time: startTime || null,
            end_time: endTime || null,
            date: date || null
          })
        });
      } else {
        // Image-based search
        const formData = new FormData();
        formData.append('file', imageFile);
        if (cameraId !== 'all') formData.append('camera_id', cameraId);
        if (className !== 'all') formData.append('class_name', className);
        if (vehicleType !== 'all') formData.append('vehicle_type', vehicleType);
        if (vehicleColor !== 'all') formData.append('vehicle_color', vehicleColor);
        if (upperColor !== 'all') formData.append('upper_color', upperColor);
        if (lowerColor !== 'all') formData.append('lower_color', lowerColor);
        if (cap !== 'all') formData.append('cap', cap);
        if (bag !== 'all') formData.append('bag', bag);
        if (helmet !== 'all') formData.append('helmet', helmet);
        if (startTime) formData.append('start_time', startTime);
        if (endTime) formData.append('end_time', endTime);
        if (date) formData.append('date', date);

        response = await fetch('/api/search/image', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
      }

      const data = await response.json();
      if (response.ok) {
        setResults(data);
      } else {
        throw new Error(data.detail || 'Search query failed');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadClip = async (detectionId) => {
    try {
      const response = await fetch(`/api/exports/clip/${detectionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.url) {
        window.open(data.url, '_blank');
        alert(`Clip sliced! SHA256 Signature registered:\n${data.hash}`);
      } else {
        alert("Failed to export clip");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadAnnotated = async (detectionId) => {
    try {
      const response = await fetch(`/api/exports/annotated/${detectionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.url) {
        window.open(data.url, '_blank');
        alert(`Annotated Image exported! SHA256 Signature:\n${data.hash}`);
      } else {
        alert("Failed to export annotated image");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFetchTimeline = async (detectionId) => {
    setLoadingTimeline(true);
    try {
      const response = await fetch(`/api/tracking/timeline/${detectionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setActiveTimeline(data);
      } else {
        alert("Error loading timeline");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleSelect = (item) => {
    if (selectedItems.some(i => i.id === item.id)) {
      setSelectedItems(selectedItems.filter(i => i.id !== item.id));
    } else {
      setSelectedItems([...selectedItems, item]);
    }
  };

  const handleGenerateReport = async () => {
    if (selectedItems.length === 0) return;
    setReporting(true);
    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query_text: searchMode === 'text' ? query : 'Reference Image Search',
          filters: {
            camera_id: cameraId,
            class_name: className,
            vehicle_type: vehicleType,
            start_time: startTime || null,
            end_time: endTime || null,
            date: date || null
          },
          detections: selectedItems,
          investigator: investigatorName,
          investigator_notes: investigatorNotes
        })
      });
      const data = await response.json();
      if (response.ok) {
        window.open(data.url, '_blank');
        alert(`Forensic PDF Generated!\nFilename: ${data.filename}\nDigital Seal: ${data.hash}`);
        setSelectedItems([]);
      } else {
        throw new Error(data.detail || 'Report compiling failed');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setReporting(false);
    }
  };

  const colorsList = ["Black", "White", "Red", "Blue", "Yellow", "Green", "Grey", "Orange", "Pink", "Purple", "Brown", "Silver", "Blue Jeans"];

  return (
    <div className="flex space-x-6 h-[calc(100vh-140px)] animate-in fade-in duration-300">
      
      {/* Sidebar Filter Panel */}
      <aside className="w-80 bg-[#0c1222] border border-slate-800 rounded-2xl p-6 flex flex-col justify-between overflow-y-auto shrink-0">
        <div className="space-y-6">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-4">
            <Filter className="h-5 w-5 text-sky-400" />
            <h3 className="font-bold text-white">Advanced Metadata Filters</h3>
          </div>

          {/* Camera Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Camera Source</label>
            <select 
              value={cameraId}
              onChange={(e) => setCameraId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs focus:border-sky-500/50 focus:outline-none"
            >
              <option value="all">All Cameras</option>
              {cameras.map(cam => (
                <option key={cam} value={cam}>{cam}</option>
              ))}
            </select>
          </div>

          {/* Object Class Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Entity Class</label>
            <select 
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs focus:border-sky-500/50 focus:outline-none"
            >
              <option value="all">All Classes</option>
              <option value="person">Person</option>
              <option value="car">Car / Automobile</option>
              <option value="truck">Truck</option>
              <option value="motorcycle">Motorcycle</option>
              <option value="bus">Bus</option>
              <option value="bicycle">Bicycle</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block flex items-center space-x-1">
              <Calendar className="h-3.5 w-3.5 text-sky-400" />
              <span>Record Date</span>
            </label>
            <input 
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs focus:border-sky-500/50 focus:outline-none text-slate-200"
            />
          </div>

          {/* Time range Filters */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block flex items-center space-x-1">
              <Clock className="h-3.5 w-3.5 text-sky-400" />
              <span>Time Window</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input 
                type="text"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="HH:MM:SS"
                className="w-full bg-slate-900 border border-slate-850 rounded-xl px-2 py-2 text-[10px] focus:border-sky-500/50 focus:outline-none text-slate-200"
              />
              <input 
                type="text"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="HH:MM:SS"
                className="w-full bg-slate-900 border border-slate-850 rounded-xl px-2 py-2 text-[10px] focus:border-sky-500/50 focus:outline-none text-slate-200"
              />
            </div>
          </div>

          {/* Conditional Filters: Persons */}
          {className === 'person' && (
            <div className="space-y-4 pt-2 border-t border-slate-800/50">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Upper Clothing Color</label>
                <select value={upperColor} onChange={(e) => setUpperColor(e.target.value)} className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs">
                  <option value="all">Any Color</option>
                  {colorsList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Lower Clothing Color</label>
                <select value={lowerColor} onChange={(e) => setLowerColor(e.target.value)} className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs">
                  <option value="all">Any Color</option>
                  {colorsList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Wearing Cap</label>
                  <select value={cap} onChange={(e) => setCap(e.target.value)} className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs">
                    <option value="all">Any</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Carrying Bag</label>
                  <select value={bag} onChange={(e) => setBag(e.target.value)} className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs">
                    <option value="all">Any</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Conditional Filters: Vehicles */}
          {['car', 'truck', 'bus', 'motorcycle', 'bicycle'].includes(className) && (
            <div className="space-y-4 pt-2 border-t border-slate-800/50">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Vehicle Type</label>
                  <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs">
                    <option value="all">Any</option>
                    <option value="hatchback">Hatchback</option>
                    <option value="sedan">Sedan</option>
                    <option value="suv">SUV</option>
                    <option value="truck">Truck</option>
                    <option value="van">Van</option>
                    <option value="bus">Bus</option>
                    <option value="motorcycle">Motorcycle</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Vehicle Color</label>
                  <select value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)} className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs">
                    <option value="all">Any</option>
                    {colorsList.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {['motorcycle', 'bicycle'].includes(className) && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Driver Helmet</label>
                  <select value={helmet} onChange={(e) => setHelmet(e.target.value)} className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs">
                    <option value="all">Any</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Generate Report Sign-off Box */}
        {selectedItems.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-800 bg-[#0e1526] p-4 rounded-xl space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Selected Evidence:</span>
              <span className="font-bold text-sky-400">{selectedItems.length} items</span>
            </div>
            
            <div className="space-y-2">
              <input
                type="text"
                value={investigatorName}
                onChange={(e) => setInvestigatorName(e.target.value)}
                placeholder="Investigator Name..."
                className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs focus:border-sky-500/50 focus:outline-none text-slate-200"
              />
              <textarea
                value={investigatorNotes}
                onChange={(e) => setInvestigatorNotes(e.target.value)}
                placeholder="Forensic Case Notes..."
                className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs focus:border-sky-500/50 focus:outline-none text-slate-200 h-16 resize-none"
              />
            </div>

            <button
              onClick={handleGenerateReport}
              disabled={reporting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all"
            >
              <FileText className="h-4 w-4" />
              <span>{reporting ? 'Compiling PDF...' : 'Compile Forensic PDF'}</span>
            </button>
          </div>
        )}
      </aside>

      {/* Main Search Panel */}
      <section className="flex-1 bg-[#0c1222] border border-slate-800 rounded-2xl p-6 flex flex-col overflow-hidden">
        
        {/* Toggle Mode / Search Input */}
        <div className="space-y-4 mb-6 border-b border-slate-800 pb-6">
          <div className="flex space-x-3 text-xs font-semibold">
            <button 
              onClick={() => setSearchMode('text')} 
              className={`px-4 py-2 rounded-lg transition-all ${searchMode === 'text' ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
            >
              Descriptive Text Search
            </button>
            <button 
              onClick={() => setSearchMode('image')} 
              className={`px-4 py-2 rounded-lg transition-all ${searchMode === 'image' ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
            >
              Reference Image Match
            </button>
          </div>

          <form onSubmit={handleSearch} className="flex space-x-3">
            {searchMode === 'text' ? (
              <>
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-850 focus:border-sky-500/50 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
                    placeholder="Describe object details (e.g. 'man in red shirt carrying a backpack', 'blue sedan car')..."
                  />
                </div>
                <select 
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-slate-900 border border-slate-850 rounded-xl px-4 text-xs font-semibold focus:outline-none"
                >
                  <option value="auto">🌐 Detect Language</option>
                  <option value="en">English</option>
                  <option value="hi">Hindi (हिन्दी)</option>
                  <option value="gu">Gujarati (ગુજરાતી)</option>
                </select>
              </>
            ) : (
              <div className="flex-1 flex flex-col space-y-2">
                <div className="flex items-center space-x-3 bg-slate-900 border border-slate-850 rounded-xl px-4 py-2.5">
                  <ImageIcon className="h-5 w-5 text-slate-500" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="text-xs text-slate-400 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-sky-400 hover:file:bg-slate-700 cursor-pointer"
                  />
                </div>
                {imageFile && (
                  <div className="flex items-center space-x-2 bg-slate-900/60 p-2 rounded-xl border border-slate-850 w-fit">
                    <img 
                      src={URL.createObjectURL(imageFile)} 
                      alt="Reference preview" 
                      className="h-10 w-10 object-cover rounded border border-slate-700" 
                    />
                    <div className="text-[10px] text-slate-400">
                      <p className="font-semibold text-slate-300 truncate max-w-[150px]">{imageFile.name}</p>
                      <p>{(imageFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setImageFile(null)} 
                      className="text-slate-500 hover:text-red-400 p-1"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading || (searchMode === 'image' && !imageFile) || (searchMode === 'text' && !query)}
              className="bg-sky-600 hover:bg-sky-500 text-white px-6 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <span>Execute Search</span>
              )}
            </button>
          </form>

          {/* Dynamic Suggestions */}
          {searchMode === 'text' && suggestions.length > 0 && (
            <div className="flex items-center space-x-2 mt-3 text-xs overflow-x-auto scrollbar-none py-1">
              <span className="text-slate-500 shrink-0 font-medium">Suggestions:</span>
              <div className="flex space-x-1.5">
                {suggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setQuery(sug)}
                    className="bg-[#121b30] hover:bg-[#1a294d] border border-slate-800 text-sky-400 hover:text-sky-300 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all shrink-0"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Search Results Area */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="h-8 w-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase animate-pulse">Running AI descriptive mapping...</p>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center">
              <Search className="h-12 w-12 text-slate-700 mb-3" />
              <p className="font-semibold text-slate-400">No matching forensic records</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">Enter a search descriptor or filter camera uploads to lookup detections.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6">
              {results.map((item) => {
                const isSelected = selectedItems.some(i => i.id === item.id);
                return (
                  <div 
                    key={item.id} 
                    className={`glass rounded-xl overflow-hidden border transition-all duration-200 ${
                      isSelected ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-slate-800 hover:border-slate-750'
                    }`}
                  >
                    {/* BBox Image Crop (BBox Bounding Box Preview) */}
                    <div className="relative h-44 bg-[#0a0f1d] flex items-center justify-center overflow-hidden group">
                      <img 
                        src={item.image_path} 
                        alt="Detection Crop BBox Preview" 
                        className="max-h-full max-w-full object-contain transform group-hover:scale-105 transition-transform"
                      />
                      
                      {/* Checkbox select */}
                      <button 
                        type="button"
                        onClick={() => handleSelect(item)}
                        className={`absolute top-3 left-3 h-5 w-5 rounded border transition-all flex items-center justify-center ${
                          isSelected ? 'bg-sky-500 border-sky-400 text-white' : 'bg-slate-900/80 border-slate-700 text-transparent'
                        }`}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>

                      {/* Score Indicator */}
                      {item.similarity_score !== undefined && (
                        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-slate-700 px-2 py-1 rounded text-[10px] font-bold text-sky-400">
                          Similarity: {(item.similarity_score * 100).toFixed(0)}%
                        </div>
                      )}
                    </div>

                    {/* Metadata Details */}
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-750 uppercase truncate max-w-[120px] inline-block" title={item.camera_id}>
                            {item.camera_id}
                          </span>
                          <span className="ml-2 text-xs text-slate-400 font-semibold uppercase">{item.class_name}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 flex items-center space-x-1 shrink-0">
                          <Clock className="h-3 w-3" />
                          <span>{item.timestamp}</span>
                        </span>
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                        <span>YOLO Conf: <strong className="text-white">{(item.confidence * 100).toFixed(0)}%</strong></span>
                        <span>Track ID: <strong className="text-sky-400">#{item.track_id}</strong></span>
                      </div>

                      {/* Attributes */}
                      <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-850 flex flex-wrap gap-1.5">
                        {Object.entries(item.attributes).map(([key, val]) => {
                          if (!val || val === 'No' || val === 'Unknown') return null;
                          return (
                            <span 
                              key={key} 
                              className="bg-[#121c33] text-sky-300 px-2 py-0.5 rounded text-[10px] font-medium border border-sky-500/10 flex items-center space-x-0.5"
                            >
                              <Tag className="h-2.5 w-2.5 text-sky-400" />
                              <span>{key.replace('_', ' ')}: {val}</span>
                            </span>
                          );
                        })}
                      </div>

                      {/* Forensic Actions */}
                      <div className="grid grid-cols-4 gap-1 pt-2 border-t border-slate-800/60 text-center">
                        <button 
                          type="button"
                          onClick={() => handleDownloadClip(item.id)}
                          className="flex items-center justify-center space-x-0.5 py-1.5 bg-slate-900 hover:bg-[#121c33] text-slate-300 hover:text-sky-400 border border-slate-800 rounded-lg text-[9px] font-semibold transition-colors"
                          title="Download 10s Clip centered on timestamp"
                        >
                          <Download className="h-3 w-3" />
                          <span>Clip</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDownloadAnnotated(item.id)}
                          className="flex items-center justify-center space-x-0.5 py-1.5 bg-slate-900 hover:bg-[#121c33] text-slate-300 hover:text-sky-400 border border-slate-800 rounded-lg text-[9px] font-semibold transition-colors"
                          title="Download Annotated BBox Image"
                        >
                          <ImageIcon className="h-3 w-3" />
                          <span>BBox</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            setActivePlayback(item);
                            setPlaybackPlaying(true);
                          }}
                          className="flex items-center justify-center space-x-0.5 py-1.5 bg-slate-900 hover:bg-[#121c33] text-slate-300 hover:text-sky-400 border border-slate-800 rounded-lg text-[9px] font-semibold transition-colors"
                          title="Play CCTV starting directly at timestamp"
                        >
                          <Play className="h-3 w-3" />
                          <span>Play</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleFetchTimeline(item.id)}
                          className="flex items-center justify-center space-x-0.5 py-1.5 bg-sky-950/20 hover:bg-sky-900/30 text-sky-400 border border-sky-900/40 hover:border-sky-500/30 rounded-lg text-[9px] font-bold transition-all"
                          title="Track chronological movement and Re-ID path"
                        >
                          <Eye className="h-3 w-3 animate-pulse" />
                          <span>Re-ID</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Re-ID Cross Camera Timeline Modal */}
      {activeTimeline && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#0c1222] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-[#0e1628]">
              <div>
                <h4 className="font-bold text-white text-base">Cross-Camera Movement Timeline</h4>
                <p className="text-xs text-slate-400">Re-identified movement path of target entity across synchronized cameras</p>
              </div>
              <button 
                type="button"
                onClick={() => setActiveTimeline(null)}
                className="text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 px-3 py-1.5 rounded-lg transition-colors"
              >
                Close View
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Target Header Info */}
              <div className="bg-[#121c33]/40 border border-sky-900/30 rounded-xl p-4 flex items-center space-x-4">
                <div className="h-16 w-16 bg-[#0a0f1d] rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
                  <img src={activeTimeline.target.image_path} alt="Target Object" className="max-h-full max-w-full object-contain" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Target Source Entity</p>
                  <p className="text-sm font-semibold text-white uppercase">{activeTimeline.target.class_name} (ID: {activeTimeline.target.id})</p>
                  <p className="text-[11px] text-sky-400 mt-0.5">Camera: {activeTimeline.target.camera_id} | Video Stamp: {activeTimeline.target.timestamp}</p>
                </div>
              </div>

              {/* Tabs Header */}
              <div className="flex space-x-3 border-b border-slate-800 pb-3">
                <button
                  type="button"
                  onClick={() => setTimelineTab('movement')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${timelineTab === 'movement' ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
                >
                  Track Movement Path
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineTab('reid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${timelineTab === 'reid' ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
                >
                  Cross-Camera Matches (Possible Matches)
                </button>
              </div>

              {timelineTab === 'movement' ? (
                (!activeTimeline.track_movement || activeTimeline.track_movement.length === 0) ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No other visual movement path data recorded in source camera.
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-6 border-l border-slate-800 ml-4">
                    {activeTimeline.track_movement.map((point, idx) => (
                      <div key={idx} className="relative">
                        <span className="absolute -left-[31px] top-1.5 h-4 w-4 rounded-full bg-[#0c1222] border-2 border-sky-500 flex items-center justify-center">
                          <span className="h-1.5 w-1.5 bg-sky-400 rounded-full"></span>
                        </span>
                        <div className="bg-[#121a2c]/60 border border-slate-850 p-4 rounded-xl flex items-center space-x-4 hover:border-slate-750 transition-colors">
                          <div className="h-16 w-16 bg-[#0a0f1d] rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center shrink-0">
                            <img src={point.image_path} alt="Timeline Crop" className="max-h-full max-w-full object-contain" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="bg-sky-600/10 border border-sky-500/20 text-sky-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                                  Camera: {point.camera_id}
                                </span>
                                <span className="ml-2 text-xs font-medium text-slate-400">Track ID: #{point.track_id}</span>
                              </div>
                              <span className="text-[10px] text-slate-500 font-medium">Confidence: {(point.confidence * 100).toFixed(0)}%</span>
                            </div>
                            <p className="text-xs text-slate-300 mt-2 font-medium">Video Timestamp: {point.timestamp}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                (!activeTimeline.possible_matches || activeTimeline.possible_matches.length === 0) ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No visual correlation matches found across other camera channels.
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-6 border-l border-slate-800 ml-4">
                    {activeTimeline.possible_matches.map((point, idx) => (
                      <div key={idx} className="relative">
                        <span className="absolute -left-[31px] top-1.5 h-4 w-4 rounded-full bg-[#0c1222] border-2 border-emerald-500 flex items-center justify-center">
                          <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                        </span>
                        <div className="bg-[#121a2c]/60 border border-slate-850 p-4 rounded-xl flex items-center space-x-4 hover:border-slate-750 transition-colors">
                          <div className="h-16 w-16 bg-[#0a0f1d] rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center shrink-0">
                            <img src={point.image_path} alt="Timeline Crop" className="max-h-full max-w-full object-contain" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                                  Possible Match
                                </span>
                                <span className="ml-2 text-xs font-medium text-slate-400">Track ID: #{point.track_id}</span>
                              </div>
                              <span className="text-[10px] text-slate-500 font-medium">{point.absolute_time_str}</span>
                            </div>
                            <p className="text-xs text-slate-300 mt-2 font-medium">
                              Visual Similarity: <span className="text-emerald-400 font-bold">{(point.similarity_score * 100).toFixed(0)}%</span>
                            </p>
                            <p className="text-[10px] text-slate-500">Video Timestamp: {point.timestamp}</p>
                            <div className="mt-2 text-[9px] text-slate-400 italic">
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
        </div>
      )}

      {/* Playback Modal */}
      {activePlayback && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#0c1222] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-[#0e1628]">
              <div>
                <h4 className="font-bold text-white text-base">CCTV Video Player</h4>
                <p className="text-xs text-slate-400">Streaming camera source footage from target timestamp offset</p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setActivePlayback(null);
                  setPlaybackPlaying(false);
                }}
                className="text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 px-3 py-1.5 rounded-lg transition-colors"
              >
                Close Player
              </button>
            </div>

            <div className="p-6 flex flex-col items-center space-y-4">
              <div className="relative w-full h-[360px] bg-black border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center">
                {playbackPlaying ? (
                  <img 
                    src={`/api/exports/stream-target/${activePlayback.id}?access_token=${encodeURIComponent(token)}&t=${Date.now()}&v=${forceReloadKey}`}
                    alt="Target Tracking Stream"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center text-slate-400 space-y-2">
                    <p className="font-semibold text-sm">Video Stream Paused</p>
                    <p className="text-xs text-slate-500">Click Stream Play below to resume stream</p>
                  </div>
                )}
                
                <div className="absolute bottom-3 left-3 bg-black/60 px-2 py-1 rounded text-[10px] text-sky-400 font-bold border border-slate-800 uppercase">
                  Camera: {activePlayback.camera_id} | Stamp: {activePlayback.timestamp}
                </div>
              </div>

              {/* Controls */}
              <div className="flex space-x-3 w-full justify-center">
                <button
                  type="button"
                  onClick={() => setPlaybackPlaying(true)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${playbackPlaying ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
                >
                  Stream Play
                </button>

                <button
                  type="button"
                  onClick={() => {
                    // Force the stream handler to restart and use the stored first-appearance boxes
                    setForceReloadKey(k => k + 1);
                    setPlaybackPlaying(true);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all"
                >
                  Follow From First Appearance
                </button>

                <button
                  type="button"
                  onClick={() => setPlaybackPlaying(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${!playbackPlaying ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
                >
                  Stream Pause
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchPage;
