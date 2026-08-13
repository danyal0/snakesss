import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import { useAdminSocket } from '../hooks/useAdminSocket';
import { useAdminAPI } from '../hooks/useAdminAPI';
import { OverviewPanel } from '../components/OverviewPanel';
import { LeaderboardPanel } from '../components/LeaderboardPanel';
import { RoomListPanel } from '../components/RoomListPanel';
import { RoomDetailPanel } from '../components/RoomDetailPanel';
import { AnalyticsPanel } from '../components/AnalyticsPanel';
import clsx from 'clsx';

export function DashboardScreen() {
  const logout = useAdminStore((s) => s.logout);
  const adminState = useAdminStore((s) => s.adminState);
  const { adminAction, spectateRoom } = useAdminSocket();
  const api = useAdminAPI();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    api.getAnalytics().catch(() => {});
  }, []);

  const navItems = [
    { path: '/dashboard', label: '📊 Overview', exact: true },
    { path: '/dashboard/rooms', label: '🏠 Rooms' },
    { path: '/dashboard/analytics', label: '📈 Analytics' },
    { path: '/dashboard/leaderboard', label: '🏆 Leaderboard' },
  ];

  return (
    <div data-testid="admin-dashboard" className="h-full app-bg flex flex-col md:flex-row overflow-hidden">
      {/* Mobile header */}
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 p-3 md:hidden">
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen(true)}
          className="glass-button min-h-11 min-w-11 rounded-xl text-lg"
        >
          ☰
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xl">🐍</span>
          <span className="text-sm font-bold text-white">Snakesss Admin</span>
        </div>
        <div className="w-11" aria-hidden="true" />
      </header>

      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
        />
      )}

      {/* Sidebar */}
      <div className={clsx(
        'fixed inset-y-0 left-0 z-50 w-72 flex-shrink-0 flex flex-col glass border-r border-white/10 transition-transform duration-200 md:static md:w-56 md:translate-x-0 md:border-r',
        mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="p-4 md:p-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="text-2xl">🐍</div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white">Snakesss</h1>
              <p className="text-xs text-white/40">Admin Console</p>
            </div>
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileNavOpen(false)}
              className="glass-button ml-auto min-h-11 min-w-11 rounded-xl text-lg md:hidden"
            >
              ×
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'flex min-h-11 items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all',
                  isActive
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-white/50 hover:text-white hover:bg-white/8'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Live stats */}
        <div className="p-3 border-t border-white/10 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Active Rooms</span>
            <span className="text-green-400 font-bold">
              {adminState?.rooms.filter((r) => r.phase !== 'ended').length ?? 0}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Total Players</span>
            <span className="text-white/70 font-bold">
              {adminState?.analytics.totalPlayers ?? 0}
            </span>
          </div>
        </div>

        <div className="p-2 md:p-3">
          <button
            onClick={logout}
            className="min-h-11 px-3 text-xs text-white/40 hover:text-red-400 transition-colors py-2 rounded-lg hover:bg-red-500/10"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1 overflow-y-auto scrollbar-none">
        <Routes>
          <Route path="/" element={<OverviewPanel adminState={adminState} />} />
          <Route path="/rooms" element={<RoomListPanel adminAction={adminAction} spectateRoom={spectateRoom} />} />
          <Route path="/rooms/:roomId" element={<RoomDetailPanel adminAction={adminAction} />} />
          <Route path="/analytics" element={<AnalyticsPanel analytics={adminState?.analytics ?? null} />} />
          <Route path="/leaderboard" element={<LeaderboardPanel />} />
        </Routes>
      </div>
    </div>
  );
}
