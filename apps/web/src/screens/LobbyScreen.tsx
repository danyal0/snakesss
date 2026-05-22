import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import type { GameState, RoomSettings } from '@snakesss/shared-types';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { AvatarDisplay } from '../components/ui/Avatar';
import { useSocket } from '../hooks/useSocket';
import { useGameStore } from '../store/gameStore';

interface LobbyScreenProps {
  gameState: GameState;
}

export function LobbyScreen({ gameState }: LobbyScreenProps) {
  const navigate = useNavigate();
  const { startGame, updateSettings } = useSocket();
  const playerId = useGameStore((s) => s.playerId);

  const me = gameState.players.find((p) => p.id === playerId);
  const isManager = me?.isRoomManager ?? false;

  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<RoomSettings>(gameState.settings);
  const [copied, setCopied] = useState(false);

  const activePlayers = gameState.players.filter((p) => !p.isSpectator && p.isConnected);
  const spectators = gameState.players.filter((p) => p.isSpectator && p.isConnected);
  const canStart = activePlayers.length >= 3 && isManager;

  const copyRoomCode = () => {
    navigator.clipboard.writeText(gameState.roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${gameState.roomId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSettingsSave = () => {
    updateSettings(settings);
    setShowSettings(false);
  };

  return (
    <div className="h-full app-bg flex flex-col p-4 gap-4 overflow-y-auto scrollbar-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          ← Leave
        </Button>
        <div className="text-center">
          <h1 className="text-xl font-bold">Game Lobby</h1>
          <div className="text-xs text-white/50">
            {activePlayers.length}/{gameState.settings.maxPlayers} players
          </div>
        </div>
        <div className="w-16" />
      </div>

      {/* Room code */}
      <GlassCard className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Room Code</p>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black text-white tracking-widest font-mono">
                {gameState.roomId}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="secondary" size="sm" onClick={copyRoomCode}>
              {copied ? '✓ Copied' : 'Copy Code'}
            </Button>
            <Button variant="ghost" size="sm" onClick={copyLink}>
              Share Link
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Players list */}
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
            Players ({activePlayers.length})
          </h2>
        </div>

        <div className="space-y-2">
          <AnimatePresence>
            {activePlayers.map((player, i) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors"
              >
                <AvatarDisplay emoji={player.avatar} size="sm" isMe={player.id === playerId} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-white truncate">
                      {player.username}
                    </span>
                    {player.isRoomManager && <span className="text-xs">👑</span>}
                    {player.isBot && (
                      <span className="text-[10px] bg-white/10 text-white/50 rounded px-1">AI</span>
                    )}
                    {player.id === playerId && (
                      <span className="text-[10px] text-green-400/80">(you)</span>
                    )}
                  </div>
                </div>
                <div
                  className={clsx(
                    'w-2 h-2 rounded-full',
                    player.isConnected ? 'bg-green-400' : 'bg-yellow-400'
                  )}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {activePlayers.length < 3 && (
            <p className="text-xs text-white/40 text-center py-2">
              Need at least 3 players to start
            </p>
          )}
        </div>

        {spectators.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <p className="text-xs text-white/40 mb-2">Spectators ({spectators.length})</p>
            <div className="flex flex-wrap gap-2">
              {spectators.map((p) => (
                <div key={p.id} className="flex items-center gap-1 text-xs text-white/50">
                  <span>{p.avatar}</span>
                  <span>{p.username}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassCard>

      {/* Game Settings */}
      <GlassCard className="p-4">
        <button
          className="flex items-center justify-between w-full"
          onClick={() => setShowSettings(!showSettings)}
        >
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
            Game Settings
          </h2>
          <motion.div animate={{ rotate: showSettings ? 180 : 0 }}>
            <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.div>
        </button>

        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-4">
                <SettingRow
                  label="Max Players"
                  value={settings.maxPlayers}
                  onChange={(v) => setSettings({ ...settings, maxPlayers: v })}
                  min={4} max={12} step={1}
                  disabled={!isManager}
                />
                <SettingRow
                  label="Discussion Time (s)"
                  value={settings.discussionTimer}
                  onChange={(v) => setSettings({ ...settings, discussionTimer: v })}
                  min={30} max={300} step={15}
                  disabled={!isManager}
                />
                <SettingRow
                  label="Vote Time (s)"
                  value={settings.voteTimer}
                  onChange={(v) => setSettings({ ...settings, voteTimer: v })}
                  min={15} max={60} step={5}
                  disabled={!isManager}
                />
                <SettingRow
                  label="Snakes"
                  value={settings.roleDistribution.snakes}
                  onChange={(v) => setSettings({
                    ...settings,
                    roleDistribution: { ...settings.roleDistribution, snakes: v },
                  })}
                  min={1} max={4} step={1}
                  disabled={!isManager}
                />

                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">AI Bots</span>
                  <Toggle
                    value={settings.botsEnabled}
                    onChange={(v) => setSettings({ ...settings, botsEnabled: v })}
                    disabled={!isManager}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">Private Room</span>
                  <Toggle
                    value={settings.isPrivate}
                    onChange={(v) => setSettings({ ...settings, isPrivate: v })}
                    disabled={!isManager}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">Advanced Roles (Seer)</span>
                  <Toggle
                    value={settings.advancedRoles}
                    onChange={(v) => setSettings({ ...settings, advancedRoles: v })}
                    disabled={!isManager}
                  />
                </div>

                {isManager && (
                  <Button variant="primary" size="sm" className="w-full" onClick={handleSettingsSave}>
                    Save Settings
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>

      {/* Start game */}
      {isManager && (
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!canStart}
          onClick={startGame}
        >
          {canStart ? '🎮 Start Game' : `Need ${Math.max(0, 3 - activePlayers.length)} more players`}
        </Button>
      )}

      {!isManager && (
        <div className="text-center text-sm text-white/40">
          Waiting for {gameState.players.find((p) => p.isRoomManager)?.username} to start...
        </div>
      )}
    </div>
  );
}

function SettingRow({
  label,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-white/70 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2">
        <button
          className="w-7 h-7 rounded-lg glass-button flex items-center justify-center text-white/70 disabled:opacity-40"
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={disabled || value <= min}
        >−</button>
        <span className="text-sm font-bold w-8 text-center tabular-nums">{value}</span>
        <button
          className="w-7 h-7 rounded-lg glass-button flex items-center justify-center text-white/70 disabled:opacity-40"
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={disabled || value >= max}
        >+</button>
      </div>
    </div>
  );
}

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled: boolean }) {
  return (
    <button
      className={clsx(
        'w-10 h-6 rounded-full transition-colors relative',
        value ? 'bg-green-500' : 'bg-white/20',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      onClick={() => !disabled && onChange(!value)}
    >
      <motion.div
        className="absolute top-1 w-4 h-4 bg-white rounded-full"
        animate={{ x: value ? 20 : 4 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}
