import React from 'react';
import { motion } from 'framer-motion';
import type { AdminState } from '@snakesss/shared-types';

interface OverviewPanelProps {
  adminState: AdminState | null;
}

export function OverviewPanel({ adminState }: OverviewPanelProps) {
  const analytics = adminState?.analytics;
  const rooms = adminState?.rooms ?? [];
  const activeRooms = rooms.filter((r) => r.phase !== 'ended' && r.phase !== 'lobby');
  const lobbyRooms = rooms.filter((r) => r.phase === 'lobby');

  const stats = [
    { label: 'Active Games', value: analytics?.activeGames ?? 0, icon: '🎮', color: 'text-green-400' },
    { label: 'Total Players', value: analytics?.totalPlayers ?? 0, icon: '👥', color: 'text-blue-400' },
    { label: 'Total Games', value: analytics?.totalGames ?? 0, icon: '📊', color: 'text-purple-400' },
    { label: 'Human Wins', value: analytics?.humanWins ?? 0, icon: '🏆', color: 'text-yellow-400' },
    { label: 'Snake Wins', value: analytics?.snakeWins ?? 0, icon: '🐍', color: 'text-red-400' },
    {
      label: 'Avg Duration',
      value: analytics?.avgGameDurationMs
        ? `${Math.round(analytics.avgGameDurationMs / 60000)}m`
        : '—',
      icon: '⏱️',
      color: 'text-orange-400',
    },
  ];

  const phaseLabel: Record<string, string> = {
    lobby: '🔵 Lobby',
    dealing: '🎴 Dealing',
    discussion: '💬 Discussion',
    voting: '🗳️ Voting',
    vote_reveal: '📊 Vote Reveal',
    elimination: '💀 Elimination',
    ended: '🏁 Ended',
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Overview</h2>
        <p className="text-white/40 text-sm">Real-time game statistics</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-2xl p-3 sm:p-4"
          >
            <div className="text-xl sm:text-2xl mb-2">{stat.icon}</div>
            <div className={`text-xl sm:text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-white/50 mt-1">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Win rate bar */}
      {analytics && (analytics.humanWins + analytics.snakeWins) > 0 && (
        <div className="glass rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-white/70 mb-3">Win Distribution</h3>
          <div className="flex gap-2 items-center">
            <span className="text-xs text-green-400 w-16 sm:w-20">Humans</span>
            <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-green-500 to-teal-500 rounded-full"
                initial={{ width: 0 }}
                animate={{
                  width: `${(analytics.humanWins / (analytics.humanWins + analytics.snakeWins)) * 100}%`,
                }}
                transition={{ duration: 1, delay: 0.3 }}
              />
            </div>
            <span className="text-xs text-white/50 w-8">{analytics.humanWins}</span>
          </div>
          <div className="flex gap-2 items-center mt-2">
            <span className="text-xs text-red-400 w-16 sm:w-20">Snakes</span>
            <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-red-500 to-rose-600 rounded-full"
                initial={{ width: 0 }}
                animate={{
                  width: `${(analytics.snakeWins / (analytics.humanWins + analytics.snakeWins)) * 100}%`,
                }}
                transition={{ duration: 1, delay: 0.4 }}
              />
            </div>
            <span className="text-xs text-white/50 w-8">{analytics.snakeWins}</span>
          </div>
        </div>
      )}

      {/* Active rooms quick view */}
      {activeRooms.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-white/70 mb-3">
            Active Games ({activeRooms.length})
          </h3>
          <div className="space-y-2">
            {activeRooms.slice(0, 5).map((room) => (
              <div key={room.roomId} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
                <div className="min-w-0 flex items-center gap-2">
                  <span className="font-mono text-sm text-white font-bold">{room.roomId}</span>
                  <span className="truncate text-xs text-white/40">{phaseLabel[room.phase]}</span>
                </div>
                <span className="text-xs text-white/60">
                  {room.playerCount} players
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {rooms.length === 0 && (
        <div className="text-center py-12 text-white/40">
          <div className="text-4xl mb-3 opacity-40">🏚️</div>
          <p>No active rooms</p>
        </div>
      )}
    </div>
  );
}
