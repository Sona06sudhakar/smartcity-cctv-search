import React, { useState } from 'react';
import { Shield, Lock, User, AlertCircle } from 'lucide-react';

function Login({ onLogin }) {
  const [username, setUsername] = useState('admin'); // Default convenient placeholder
  const [password, setPassword] = useState('admin123'); // Default convenient placeholder
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // We will post using URL-encoded form data, which is standard for OAuth2PasswordRequestForm
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Incorrect credentials');
      }

      onLogin(data.access_token, { username: data.username, role: data.role });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b15] flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Background Decorative Blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md glass-card rounded-2xl p-8 border border-slate-800 shadow-2xl relative z-10">
        {/* Title Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-sky-500/10 p-3.5 rounded-2xl border border-sky-500/20 mb-4 animate-bounce">
            <Shield className="h-8 w-8 text-sky-400" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-wide text-center">INTELLIGENT CCTV FORENSICS</h2>
          <p className="text-xs text-sky-400 font-semibold tracking-widest uppercase mt-1">SIH Smart City Platform</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 p-3 rounded-lg flex items-center space-x-2.5 text-red-400 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Investigator ID / Username</label>
            <div className="relative">
              <User className="absolute left-3 top-3.5 h-4.5 w-4.5 text-slate-500" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 focus:border-sky-500/50 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
                placeholder="Enter investigator ID"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Security Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 h-4.5 w-4.5 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 focus:border-sky-500/50 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
                placeholder="Enter passcode"
              />
            </div>
          </div>

          {/* Tips for default login */}
          <div className="text-[11px] text-slate-500 bg-[#0e1424] p-3 rounded-lg border border-slate-800 space-y-1">
            <p>💡 **Default Credentials for Testing:**</p>
            <p>• Admin Account: <code className="text-sky-400">admin</code> / <code className="text-sky-400">admin123</code></p>
            <p>• Officer Account: <code className="text-sky-400">officer</code> / <code className="text-sky-400">officer123</code></p>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 hover:bg-sky-500 text-white font-medium py-3 rounded-xl shadow-lg shadow-sky-600/10 hover:shadow-sky-500/20 active:scale-[0.98] transition-all flex justify-center items-center space-x-2 text-sm disabled:opacity-50"
          >
            {loading ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span>Authorize & Login</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
