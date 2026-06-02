import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { RoomSummary } from '@snakesss/shared-types';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';

const SERVER_URL = import.meta.env['VITE_SERVER_URL'] ?? '';

export function PublicRoomsScreen() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms`);
      const data = await res.json() as { success: boolean; data: RoomSummary[] };
      if (data.success) setRooms(data.data);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const id = setInterval(fetchRooms, 5000);
    return () => clearInterval(id);
  }, []);

  const phaseLabel: Record<string, string> = {
    lobby: '🔵 Waiting',
    dealing: '🎴 Starting',
    discussion: '💬 Discussion',
    voting: '🗳️ Voting',
    elimination: '💀 Elimination',
    ended: '🏁 Ended',
  };

  return (
    <div data-testid="public-rooms-screen" className="h-full app-bg flex flex-col p-4 gap-4 overflow-y-auto scrollbar-none">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>← Back</Button>
        <h1 className="text-xl font-bold">Public Rooms</h1>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={fetchRooms}>↻ Refresh</Button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-4xl animate-pulse">🐍</div>
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-5xl opacity-40">🏚️</div>
          <p className="text-white/50">No public rooms available</p>
          <Button variant="primary" onClick={() => navigate('/')}>Create One</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rooms.map((room, i) => (
            <motion.div
              key={room.roomId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <GlassCard className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-lg text-white">{room.roomId}</span>
                      <span className="text-xs text-white/50">
                        {phaseLabel[room.phase] ?? room.phase}
                      </span>
                    </div>
                    <div className="text-xs text-white/50">
                      {room.playerCount}/{room.settings.maxPlayers} players
                      {room.spectatorCount > 0 && ` · ${room.spectatorCount} spectating`}
                    </div>
                  </div>

                  <Button
                    variant={room.phase === 'lobby' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => navigate(`/room/${room.roomId}`)}
                  >
                    {room.phase === 'lobby' ? 'Join' : 'Spectate'}
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
