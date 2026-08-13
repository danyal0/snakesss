import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import { useAdminAPI } from '../hooks/useAdminAPI';
import clsx from 'clsx';
import type { RoomSummary } from '@snakesss/shared-types';

interface RoomListPanelProps {
  adminAction: (roomId: string, action: string, targetId?: string, data?: Record<string, unknown>) => void;
  spectateRoom: (roomId: string) => void;
}

export function RoomListPanel({ adminAction, spectateRoom }: RoomListPanelProps) {
  const navigate = useNavigate();
  const adminState = useAdminStore((s) => s.adminState);
  const rooms = adminState?.rooms ?? [];
  const [filter, setFilter] = useState<'all' | 'active' | 'lobby'>('all');

  const api = useAdminAPI();

  const filtered = rooms.filter((r) => {
    if (filter === 'active') return !['lobby', 'ended'].includes(r.phase);
    if (filter === 'lobby') return r.phase === 'lobby';
    return true;
  });

  const phaseColors: Record<string, string> = {
    lobby: 'text-blue-400',
    dealing: 'text-purple-400',
    discussion: 'text-green-400',
    voting: 'text-yellow-400',
    vote_reveal: 'text-orange-400',
    elimination: 'text-red-400',
    ended: 'text-white/30',
  };

  const phaseLabel: Record<string, string> = {
    lobby: 'Lobby',
    dealing: 'Dealing',
    discussion: 'Discussion',
    voting: 'Voting',
    vote_reveal: 'Vote Reveal',
    elimination: 'Elimination',
    ended: 'Ended',
  };

  const handleInjectBot = async (roomId: string) => {
    try {
      await api.injectBot(roomId, 'chaotic_liar');
    } catch (e) {
      console.error(e);
    }
  };

  const handleCloseRoom = async (roomId: string) => {
    if (!confirm(`Close room ${roomId}?`)) return;
    try {
      await api.closeRoom(roomId);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Rooms</h2>
          <p className="text-white/40 text-sm">{rooms.length} total rooms</p>
        </div>

        <div className="flex w-full gap-2 sm:w-auto">
          {(['all', 'active', 'lobby'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'min-h-11 flex-1 px-3 py-1.5 rounded-lg text-sm transition-all sm:min-h-0 sm:flex-none',
                filter === f ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white'
              )}
            >
              {f.charAt(0).toUpperCase()}{f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-white/40">
          <p>No rooms to display</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((room, i) => (
            <motion.div
              key={room.roomId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass rounded-2xl p-4"
            >
              <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className="font-mono font-black text-xl text-white">{room.roomId}</span>
                    <span className={clsx('text-xs font-medium', phaseColors[room.phase])}>
                      {phaseLabel[room.phase] ?? room.phase}
                    </span>
                    {room.settings.isPrivate && (
                      <span className="text-xs text-white/30 bg-white/10 rounded px-1.5 py-0.5">Private</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
                    <span>👥 {room.playerCount}/{room.settings.maxPlayers}</span>
                    {room.spectatorCount > 0 && <span>👁️ {room.spectatorCount} watching</span>}
                    {room.startedAt && (
                      <span>⏱️ {Math.round((Date.now() - room.startedAt) / 60000)}m</span>
                    )}
                    {room.settings.botsEnabled && <span>🤖 AI bots</span>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
                  <button
                    onClick={() => {
                      spectateRoom(room.roomId);
                      navigate(`/dashboard/rooms/${room.roomId}`);
                    }}
                    className="px-3 py-1.5 rounded-lg glass-button text-xs text-white/70 hover:text-white"
                  >
                    👁️ View
                  </button>
                  {room.phase !== 'ended' && (
                    <>
                      <button
                        onClick={() => handleInjectBot(room.roomId)}
                        className="px-3 py-1.5 rounded-lg glass-button text-xs text-white/70 hover:text-white"
                      >
                        🤖 Bot
                      </button>
                      <button
                        onClick={() => handleCloseRoom(room.roomId)}
                        className="px-3 py-1.5 rounded-lg glass-button text-xs text-red-400/70 hover:text-red-300"
                      >
                        ✕ Close
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
