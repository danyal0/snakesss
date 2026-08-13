import React from 'react';
import { motion } from 'framer-motion';
import type { Analytics } from '@snakesss/shared-types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface AnalyticsPanelProps {
  analytics: Analytics | null;
}

const COLORS = ['#00ff88', '#ff3b6b', '#00d4ff', '#ffb800'];

export function AnalyticsPanel({ analytics }: AnalyticsPanelProps) {
  if (!analytics) {
    return (
      <div className="p-6 flex items-center justify-center h-full text-white/40">
        Loading analytics...
      </div>
    );
  }

  const winData = [
    { name: 'Human Wins', value: analytics.humanWins },
    { name: 'Snake Wins', value: analytics.snakeWins },
  ];

  const aiVsHuman = [
    { name: 'Games with AI', value: analytics.aiVsHumanWinRate.ai },
    { name: 'Games without AI', value: analytics.aiVsHumanWinRate.human },
  ];

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) => {
    if (active && payload?.length) {
      return (
        <div className="glass rounded-xl px-3 py-2 text-sm">
          <p className="text-white/80">{payload[0].name}: {payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-y-auto h-full scrollbar-none">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Analytics</h2>
        <p className="text-white/40 text-sm">Game statistics and patterns</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <MetricCard
          label="Total Games Played"
          value={analytics.totalGames}
          icon="🎮"
          color="text-green-400"
        />
        <MetricCard
          label="Avg Game Duration"
          value={analytics.avgGameDurationMs > 0
            ? `${Math.round(analytics.avgGameDurationMs / 60000)}m ${Math.round((analytics.avgGameDurationMs % 60000) / 1000)}s`
            : '—'
          }
          icon="⏱️"
          color="text-blue-400"
        />
        <MetricCard
          label="Villager Win Rate"
          value={analytics.totalGames > 0
            ? `${Math.round((analytics.humanWins / analytics.totalGames) * 100)}%`
            : '—'
          }
          icon="🏆"
          color="text-yellow-400"
        />
        <MetricCard
          label="Snake Win Rate"
          value={analytics.totalGames > 0
            ? `${Math.round((analytics.snakeWins / analytics.totalGames) * 100)}%`
            : '—'
          }
          icon="🐍"
          color="text-red-400"
        />
      </div>

      {/* Win distribution chart */}
      {analytics.totalGames > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-5"
        >
          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">
            Win Distribution
          </h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={winData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {winData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => (
                    <span className="text-xs text-white/70">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* AI vs Human games */}
      {(analytics.aiVsHumanWinRate.ai + analytics.aiVsHumanWinRate.human) > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-2xl p-5"
        >
          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">
            AI vs Human Games
          </h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aiVsHuman} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#00d4ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {analytics.totalGames === 0 && (
        <div className="text-center py-12 text-white/40">
          <div className="text-4xl mb-3 opacity-40">📊</div>
          <p>No completed games yet</p>
          <p className="text-xs mt-1">Analytics will appear once games are completed</p>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass rounded-2xl p-3 sm:p-4"
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-white/40 mt-1">{label}</div>
    </motion.div>
  );
}
