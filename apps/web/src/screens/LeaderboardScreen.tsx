import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import type { LeaderboardEntry } from '@snakesss/shared-types';
import { Button } from '../components/ui/Button';

const SERVER_URL = import.meta.env['VITE_SERVER_URL'] ?? '';

const RANK_STYLES = [
  { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-300', badge: '🥇', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.2)]' },
  { bg: 'bg-slate-400/10', border: 'border-slate-400/30', text: 'text-slate-300', badge: '🥈', glow: '' },
  { bg: 'bg-orange-700/10', border: 'border-orange-700/30', text: 'text-orange-400', badge: '🥉', glow: '' },
  { bg: 'bg-white/5', border: 'border-white/8', text: 'text-white/60', badge: '4', glow: '' },
  { bg: 'bg-white/5', border: 'border-white/8', text: 'text-white/60', badge: '5', glow: '' },
];

function winRate(entry: LeaderboardEntry): number {
  return entry.gamesPlayed > 0 ? Math.round((entry.gamesWon / entry.gamesPlayed) * 100) : 0;
}

function timeSince(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function LeaderboardScreen() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/leaderboard/top/10`);
      const data = await res.json() as { success: boolean; data: LeaderboardEntry[] };
      if (data.success) {
        setEntries(data.data);
        setLastUpdated(Date.now());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    const id = setInterval(fetchLeaderboard, 15_000);
    return () => clearInterval(id);
  }, [fetchLeaderboard]);

  return (
    <div data-testid="leaderboard-screen" className="h-full app-bg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            ← Back
          </Button>
          <div className="flex-1 text-center">
            <h1 className="text-xl font-black text-white">🏆 Leaderboard</h1>
            <p className="text-[10px] text-white/30 mt-0.5">
              Top scorers · updated {timeSince(lastUpdated)}
            </p>
          </div>
          <button
            onClick={fetchLeaderboard}
            className="text-white/30 hover:text-white/60 transition-colors text-sm p-2"
          >
            ↻
          </button>
        </div>

        {/* Scoring rules banner */}
        <div className="glass rounded-2xl p-3 border border-white/8">
          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Scoring Rules</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-green-400">👤</span>
              <span className="text-white/60">Correct answer: <span className="font-bold text-green-400">+N pts</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-red-400">🐍</span>
              <span className="text-white/60">Per wrong human: <span className="font-bold text-red-400">+1 pt</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/30">👤</span>
              <span className="text-white/40">Wrong answer: 0 pts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-yellow-400">🦡</span>
              <span className="text-white/60">Mongoose = verified human</span>
            </div>
          </div>
          <p className="text-[9px] text-white/25 mt-1.5">
            N = total number of non-snake players who answered correctly
          </p>
        </div>
      </div>

      {/* Leaderboard list */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-4 pb-6 space-y-2.5">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="text-4xl animate-pulse">🏆</div>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4">
            <div className="text-5xl opacity-30">🏆</div>
            <p className="text-white/40 text-sm text-center">
              No scores yet.<br/>Play a game to appear here!
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {entries.map((entry, i) => {
              const style = RANK_STYLES[i] ?? RANK_STYLES[4]!;
              const wr = winRate(entry);

              return (
                <motion.div
                  key={entry.username}
                  layout
                  initial={{ opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 25 }}
                  className={clsx(
                    'relative rounded-2xl border p-4',
                    style.bg, style.border, style.glow
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank badge */}
                    <div className={clsx(
                      'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                      'text-base font-black',
                      i < 3 ? 'text-xl' : style.text
                    )}>
                      {style.badge}
                    </div>

                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-full glass-elevated flex items-center justify-center text-2xl flex-shrink-0">
                      {entry.avatar}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-sm font-bold text-white truncate">
                          {entry.username}
                        </span>
                        {entry.snakeGames > entry.humanGames && (
                          <span className="text-[9px] text-red-400/70 bg-red-500/15 rounded-full px-1.5">
                            🐍 snake fan
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[10px] text-white/40">
                          {entry.gamesPlayed}g played
                        </span>
                        <span className="text-[10px] text-white/40">
                          {wr}% win rate
                        </span>
                        <span className="text-[10px] text-white/40">
                          Best: {entry.bestGameScore}pts
                        </span>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-right flex-shrink-0">
                      <div className={clsx('text-xl font-black', style.text)}>
                        {entry.totalScore}
                      </div>
                      <div className="text-[9px] text-white/30">total pts</div>
                    </div>
                  </div>

                  {/* Score bar */}
                  {entries[0] && (
                    <div className="mt-3">
                      <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                        <motion.div
                          className={clsx(
                            'h-full rounded-full',
                            i === 0 ? 'bg-gradient-to-r from-yellow-400 to-orange-400' :
                            i === 1 ? 'bg-gradient-to-r from-slate-300 to-slate-400' :
                            i === 2 ? 'bg-gradient-to-r from-orange-500 to-orange-700' :
                            'bg-gradient-to-r from-green-500 to-teal-500'
                          )}
                          initial={{ width: 0 }}
                          animate={{ width: `${(entry.totalScore / Math.max(entries[0].totalScore, 1)) * 100}%` }}
                          transition={{ duration: 0.8, delay: 0.2 + i * 0.06 }}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
