import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Upload, 
  Search, 
  History, 
  FileText, 
  GitBranch, 
  LogOut, 
  LayoutDashboard, 
  CheckCircle,
  Database
} from 'lucide-react';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/Upload';
import SearchPage from './pages/Search';
import TimelinePage from './pages/Timeline';
import ReportsPage from './pages/Reports';
import AuditPage from './pages/Audit';
import CustodyPage from './pages/Custody';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  const handleLogin = (authToken, userData) => {
    setToken(authToken);
    setUser(userData);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    setCurrentPage('dashboard');
    localStorage.clear();
  };

  // If not logged in, render Login screen
  if (!token || !user) {
    return <Login onLogin={handleLogin} />;
  }

  // Navigation Items
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Ingest CCTV', icon: Upload },
    { id: 'search', label: 'Intelligent Search', icon: Search },
    { id: 'timeline', label: 'Cross-Cam Tracking', icon: GitBranch },
    { id: 'reports', label: 'Forensic Reports', icon: FileText },
    { id: 'custody', label: 'Chain of Custody', icon: Shield },
    { id: 'audit', label: 'Audit Logs', icon: History }
  ];

  return (
    <div className="flex h-screen bg-[#070b15] text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0c1222] border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo Brand */}
          <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
            <div className="bg-sky-500/10 p-2 rounded-lg border border-sky-500/20">
              <Shield className="h-6 w-6 text-sky-400" />
            </div>
            <div>
              <h1 className="font-bold text-base text-white tracking-wide">SMART CITY</h1>
              <p className="text-[10px] text-sky-400 uppercase font-semibold tracking-wider">CCTV FORENSIC PORTAL</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive 
                      ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/10' 
                      : 'text-slate-400 hover:bg-[#121b30] hover:text-slate-100'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer User Info */}
        <div className="p-4 border-t border-slate-800 space-y-3 bg-[#0a0f1c]">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
              <span className="font-bold text-sm text-sky-400 uppercase">{user.username.slice(0, 2)}</span>
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user.username}</p>
              <p className="text-xs text-slate-400 capitalize truncate">{user.role} Account</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 border border-slate-800 hover:border-red-500/30 hover:bg-red-500/10 rounded-lg text-xs font-medium text-slate-400 hover:text-red-400 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Logout Session</span>
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-[#0c1222]/80 backdrop-blur border-b border-slate-800 flex items-center justify-between px-8 z-10">
          <div>
            <span className="text-xs font-semibold text-sky-400 uppercase tracking-widest">SIH 2026 Core Engine</span>
            <h2 className="text-lg font-bold text-white capitalize">{currentPage.replace('-', ' ')}</h2>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-[#121b30] border border-slate-800 px-3 py-1.5 rounded-full flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-medium text-slate-300">FastAPI Gateway Connected</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-8 relative">
          {currentPage === 'dashboard' && <Dashboard setCurrentPage={setCurrentPage} token={token} />}
          {currentPage === 'upload' && <UploadPage token={token} />}
          {currentPage === 'search' && <SearchPage token={token} />}
          {currentPage === 'timeline' && <TimelinePage token={token} />}
          {currentPage === 'reports' && <ReportsPage token={token} />}
          {currentPage === 'custody' && <CustodyPage token={token} />}
          {currentPage === 'audit' && <AuditPage token={token} />}
        </main>
      </div>
    </div>
  );
}

export default App;
