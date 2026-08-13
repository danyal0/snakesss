import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { LeaderboardEntry } from '@snakesss/shared-types';
import { useAdminStore } from '../store/adminStore';

const BASE = `${import.meta.env['VITE_SERVER_URL'] ?? ''}`;

const RANK_STYLES = [
  'text-yellow-400',
  'text-slate-300',
  'text-orange-400',
  'text-white/50',
  'text-white/50',
];

export function LeaderboardPanel() {
  const token = useAdminStore((s) => s.token);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${BASE}/api/admin/leaderboard`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      const data = await res.json() as { success: boolean; data: LeaderboardEntry[] };
      if (data.success) setEntries(data.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Clear entire leaderboard? This cannot be undone.')) return;
    setClearing(true);
    try {
      await fetch(`${BASE}/api/admin/leaderboard`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      setEntries([]);
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const id = setInterval(fetchLeaderboard, 20_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Leaderboard</h2>
          <p className="text-white/40 text-sm">
            {entries.length} player{entries.length !== 1 ? 's' : ''} on record
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button
            onClick={fetchLeaderboard}
            className="min-h-11 flex-1 px-3 py-1.5 rounded-xl glass-button text-xs text-white/60 sm:min-h-0 sm:flex-none"
          >
            ↻ Refresh
          </button>
          <button
            onClick={handleClear}
            disabled={clearing}
            className="min-h-11 flex-1 px-3 py-1.5 rounded-xl glass-button text-xs text-red-400/70 hover:text-red-300 disabled:opacity-40 sm:min-h-0 sm:flex-none"
          >
            {clearing ? '...' : 'Clear All'}
          </button>
        </div>
      </div>

      {/* Scoring rules */}
      <div className="glass rounded-2xl p-4">
        <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
          Big Potato Scoring Rules
        </p>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <span className="text-green-400 text-base">👤</span>
            <div>
              <p className="text-white/80 font-medium">Correct Answer</p>
              <p className="text-white/40 text-xs">+N pts where N = total correct answerers</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-red-400 text-base">🐍</span>
            <div>
              <p className="text-white/80 font-medium">Snake Score</p>
              <p className="text-white/40 text-xs">+1 pt per human who answered wrong</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-white/30 text-base">👤</span>
            <div>
              <p className="text-white/50 font-medium">Wrong Answer</p>
              <p className="text-white/40 text-xs">0 points, but helps snakes</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-yellow-400 text-base">🦡</span>
            <div>
              <p className="text-white/80 font-medium">Mongoose of Truth</p>
              <p className="text-white/40 text-xs">Verified human, scores same as humans</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/40">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-white/40">
          <div className="text-4xl mb-3 opacity-40">🏆</div>
          <p>No completed games yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <motion.div
              key={entry.username}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass rounded-2xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4"
            >
              <div className={`text-xl font-black w-8 text-center ${RANK_STYLES[i] ?? 'text-white/40'}`}>
                {i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}
              </div>

              <div className="text-2xl">{entry.avatar}</div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{entry.username}</p>
                <div className="flex gap-3 mt-0.5 flex-wrap">
                  <span className="text-[10px] text-white/40">{entry.gamesPlayed} games</span>
                  <span className="text-[10px] text-white/40">
                    {entry.gamesPlayed > 0 ? Math.round((entry.gamesWon / entry.gamesPlayed) * 100) : 0}% win rate
                  </span>
                  <span className="text-[10px] text-white/40">Best: {entry.bestGameScore}pts</span>
                  <span className="text-[10px] text-red-400/60">🐍 {entry.snakeGames}</span>
                  <span className="text-[10px] text-green-400/60">👤 {entry.humanGames}</span>
                </div>
              </div>

              <div className="text-right">
                <div className={`text-lg font-black ${RANK_STYLES[i] ?? 'text-white/70'}`}>
                  {entry.totalScore}
                </div>
                <div className="text-[9px] text-white/30">total pts</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
