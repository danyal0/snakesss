import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAdminStore } from '../store/adminStore';

const SERVER_URL = import.meta.env['VITE_SERVER_URL'] ?? 'http://localhost:3001';

export function LoginScreen() {
  const login = useAdminStore((s) => s.login);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SERVER_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json() as { success: boolean; data?: { token: string }; error?: string };
      if (data.success && data.data?.token) {
        login(data.data.token);
      } else {
        setError(data.error ?? 'Invalid credentials');
      }
    } catch {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="admin-login-screen" className="h-full app-bg flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-elevated rounded-3xl p-8 w-full max-w-sm space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="text-5xl">🐍</div>
          <h1 className="text-2xl font-bold text-white">Admin Console</h1>
          <p className="text-sm text-white/50">Snakesss Control Panel</p>
        </div>

        <div className="space-y-4">
          <input
            data-testid="admin-password-input"
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full glass rounded-xl px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-white/30"
          />

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <button
            data-testid="admin-login-btn"
            onClick={handleLogin}
            disabled={loading || !password}
            className="w-full btn-primary rounded-xl px-6 py-3 font-semibold disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>

        <p className="text-xs text-white/25 text-center">
          Default password: admin123 (change via ADMIN_PASSWORD env)
        </p>
      </motion.div>
    </div>
  );
}
