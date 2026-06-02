import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { LeaderboardEntry } from '@snakesss/shared-types';

const SERVER_URL = import.meta.env['VITE_SERVER_URL'] ?? '';

const RANK_ICONS = ['🥇', '🥈', '🥉'];

export function LeaderboardWidget() {
  const navigate = useNavigate();
  const [top3, setTop3] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    fetch(`${SERVER_URL}/api/leaderboard`)
      .then((r) => r.json())
      .then((d: { success: boolean; data: LeaderboardEntry[] }) => {
        if (d.success) setTop3(d.data.slice(0, 3));
      })
      .catch(() => {});
  }, []);

  if (top3.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="glass rounded-2xl overflow-hidden"
    >
      <button
        onClick={() => navigate('/leaderboard')}
        className="w-full"
      >
        <div data-testid="leaderboard-widget" className="px-4 py-2.5 flex items-center justify-between border-b border-white/8">
          <div className="flex items-center gap-2">
            <span className="text-sm">🏆</span>
            <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">
              Top Scorers
            </span>
          </div>
          <span className="text-[10px] text-white/30">View all →</span>
        </div>

        <div className="px-4 py-2 space-y-2">
          {top3.map((entry, i) => (
            <div key={entry.username} className="flex items-center gap-2.5">
              <span className="text-base w-6 text-center">{RANK_ICONS[i] ?? i + 1}</span>
              <span className="text-lg">{entry.avatar}</span>
              <span className="text-xs font-medium text-white/80 flex-1 truncate">
                {entry.username}
              </span>
              <span className="text-xs font-black text-white/70 tabular-nums">
                {entry.totalScore}
                <span className="text-[9px] text-white/30 font-normal ml-0.5">pts</span>
              </span>
            </div>
          ))}
        </div>
      </button>
    </motion.div>
  );
}
