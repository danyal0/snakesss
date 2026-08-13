import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import { useAdminAPI } from '../hooks/useAdminAPI';
import type { GameState, Player } from '@snakesss/shared-types';
import clsx from 'clsx';

interface RoomDetailPanelProps {
  adminAction: (roomId: string, action: string, targetId?: string, data?: Record<string, unknown>) => void;
}

export function RoomDetailPanel({ adminAction }: RoomDetailPanelProps) {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const api = useAdminAPI();
  const selectedRoomState = useAdminStore((s) => s.selectedRoomState);
  const [roomState, setRoomState] = useState<GameState | null>(selectedRoomState);

  useEffect(() => {
    if (!roomId) return;
    api.getRoom(roomId).then((data) => setRoomState(data as GameState)).catch(() => {});
    const id = setInterval(() => {
      api.getRoom(roomId).then((data) => setRoomState(data as GameState)).catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, [roomId]);

  useEffect(() => {
    if (selectedRoomState?.roomId === roomId) {
      setRoomState(selectedRoomState);
    }
  }, [selectedRoomState, roomId]);

  const handlePause = () => adminAction(roomId!, 'pause');
  const handleResume = () => adminAction(roomId!, 'resume');
  const handleKick = (playerId: string) => adminAction(roomId!, 'kick', playerId);
  const handleBan = (playerId: string) => adminAction(roomId!, 'ban', playerId);
  const handleInjectBot = (persona: string) => adminAction(roomId!, 'inject_bot', undefined, { persona });

  if (!roomState) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-white/40">Loading room {roomId}...</div>
      </div>
    );
  }

  const alivePlayers = roomState.players.filter((p) => p.isAlive && !p.isSpectator);
  const elimPlayers = roomState.players.filter((p) => !p.isAlive && !p.isSpectator);
  const spectators = roomState.players.filter((p) => p.isSpectator);

  const phaseLabel: Record<string, string> = {
    lobby: 'Lobby',
    dealing: 'Dealing',
    discussion: 'Discussion',
    voting: 'Voting',
    vote_reveal: 'Vote Reveal',
    elimination: 'Elimination',
    ended: 'Ended',
  };

  const roleColors: Record<string, string> = {
    snake: 'text-red-400 bg-red-500/15',
    villager: 'text-green-400 bg-green-500/15',
    seer: 'text-blue-400 bg-blue-500/15',
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 overflow-y-auto h-full scrollbar-none">
      {/* Header */}
      <div className="flex items-start gap-3 sm:items-center sm:gap-4">
        <button onClick={() => navigate('/dashboard/rooms')} className="text-white/50 hover:text-white text-sm">
          ← Back
        </button>
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h2 className="break-all text-xl font-black font-mono text-white sm:text-2xl">{roomState.roomId}</h2>
            <span className="text-sm text-white/50">{phaseLabel[roomState.phase]}</span>
            {roomState.isPaused && (
              <span className="text-xs bg-yellow-500/20 text-yellow-400 rounded-lg px-2 py-0.5">PAUSED</span>
            )}
          </div>
          <p className="text-xs text-white/40">Round {roomState.round} · {alivePlayers.length} alive</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2">
        {!roomState.isPaused ? (
          <AdminBtn icon="⏸" label="Pause" onClick={handlePause} color="yellow" />
        ) : (
          <AdminBtn icon="▶️" label="Resume" onClick={handleResume} color="green" />
        )}
        {(['aggressive', 'silent_strategist', 'chaotic_liar'] as const).map((persona) => (
          <AdminBtn
            key={persona}
            icon="🤖"
            label={`Bot (${persona.replace('_', ' ')})`}
            onClick={() => handleInjectBot(persona)}
            color="blue"
          />
        ))}
      </div>

      {/* Players */}
      <div className="glass rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
          Players ({alivePlayers.length} alive)
        </h3>
        <div className="space-y-2">
          {alivePlayers.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              roleColors={roleColors}
              onKick={() => handleKick(player.id)}
              onBan={() => handleBan(player.id)}
            />
          ))}
        </div>

        {elimPlayers.length > 0 && (
          <>
            <div className="border-t border-white/10 my-3" />
            <h4 className="text-xs text-white/40 uppercase mb-2">Eliminated</h4>
            <div className="space-y-1">
              {elimPlayers.map((player) => (
                <div key={player.id} className="flex items-center gap-2 opacity-50">
                  <span>{player.avatar}</span>
                  <span className="text-sm text-white/60">{player.username}</span>
                  {player.role?.revealed && (
                    <span className={clsx('text-xs rounded px-1.5', roleColors[player.role.type])}>
                      {player.role.type}
                    </span>
                  )}
                  <span className="text-xs">💀</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Vote distribution */}
      {Object.keys(roomState.votes).length > 0 && (
        <div className="glass rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
            Current Votes
          </h3>
          {(() => {
            const counts: Record<string, number> = {};
            Object.values(roomState.votes).forEach((tid) => {
              counts[tid] = (counts[tid] ?? 0) + 1;
            });
            return Object.entries(counts).map(([targetId, count]) => {
              const target = roomState.players.find((p) => p.id === targetId);
              return (
                <div key={targetId} className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-white flex-1">{target?.username ?? targetId}</span>
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{ width: `${(count / alivePlayers.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-white/60 w-6 text-right">{count}</span>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Chat log */}
      <div className="glass rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
          Chat Log ({roomState.chat.length})
        </h3>
        <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-none">
          {roomState.chat.slice(-20).map((msg) => (
            <div key={msg.id} className="flex gap-2 items-start">
              <span className="text-sm">{msg.playerAvatar}</span>
              <div>
                <span className="text-xs text-white/50">{msg.playerName}</span>
                <p className="text-sm text-white/80">{msg.content}</p>
              </div>
            </div>
          ))}
          {roomState.chat.length === 0 && (
            <p className="text-xs text-white/30">No messages yet</p>
          )}
        </div>
      </div>

      {/* Settings editor */}
      <div className="glass rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
          Settings
        </h3>
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {Object.entries(roomState.settings).map(([key, val]) => (
            <div key={key} className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-white/50 text-xs">{key}</span>
              <span className="text-white/80 text-xs font-mono">
                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  roleColors,
  onKick,
  onBan,
}: {
  player: Player;
  roleColors: Record<string, string>;
  onKick: () => void;
  onBan: () => void;
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-xl hover:bg-white/5 group">
      <span className="text-xl">{player.avatar}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-white truncate">{player.username}</span>
          {player.isRoomManager && <span className="text-xs">👑</span>}
          {player.isBot && <span className="text-[10px] bg-white/10 text-white/40 rounded px-1">AI</span>}
          {!player.isConnected && <span className="text-[10px] text-yellow-400/60">offline</span>}
        </div>
        {player.role?.revealed && (
          <span className={clsx('text-[10px] rounded px-1.5', roleColors[player.role.type])}>
            {player.role.type}
          </span>
        )}
      </div>
      <div className="flex gap-1 sm:hidden sm:group-hover:flex">
        <button
          onClick={onKick}
          className="min-h-9 px-2 py-1 rounded-lg text-[10px] text-yellow-400/70 hover:text-yellow-300 glass-button"
        >
          Kick
        </button>
        <button
          onClick={onBan}
          className="min-h-9 px-2 py-1 rounded-lg text-[10px] text-red-400/70 hover:text-red-300 glass-button"
        >
          Ban
        </button>
      </div>
    </div>
  );
}

function AdminBtn({
  icon,
  label,
  onClick,
  color = 'white',
}: {
  icon: string;
  label: string;
  onClick: () => void;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    yellow: 'text-yellow-400/80 hover:text-yellow-300',
    green: 'text-green-400/80 hover:text-green-300',
    red: 'text-red-400/80 hover:text-red-300',
    blue: 'text-blue-400/80 hover:text-blue-300',
    white: 'text-white/60 hover:text-white',
  };

  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-button text-sm',
        colorMap[color] ?? colorMap['white']
      )}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
