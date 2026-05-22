import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import type { GameState, RoomSettings, BotPersona } from '@snakesss/shared-types';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { AvatarDisplay } from '../components/ui/Avatar';
import { useSocket } from '../hooks/useSocket';
import { useGameStore } from '../store/gameStore';

interface LobbyScreenProps {
  gameState: GameState;
}

const BOT_PERSONAS: { id: BotPersona; label: string; desc: string; emoji: string }[] = [
  { id: 'aggressive', label: 'Aggressive', desc: 'Loud & accusatory', emoji: '🔥' },
  { id: 'silent_strategist', label: 'Strategist', desc: 'Quiet & calculating', emoji: '🧠' },
  { id: 'chaotic_liar', label: 'Chaotic', desc: 'Random & unpredictable', emoji: '🌀' },
];

export function LobbyScreen({ gameState }: LobbyScreenProps) {
  const navigate = useNavigate();
  const { startGame, updateSettings, addBot, kickPlayerFromRoom } = useSocket();
  const playerId = useGameStore((s) => s.playerId);
  const lastSocketError = useGameStore((s) => s.lastSocketError);

  const me = gameState.players.find((p) => p.id === playerId);
  const isManager = me?.isRoomManager ?? false;

  const [tab, setTab] = useState<'players' | 'bots' | 'settings'>('players');
  const [settings, setSettings] = useState<RoomSettings>(gameState.settings);
  const [copied, setCopied] = useState(false);
  const [botLoading, setBotLoading] = useState<BotPersona | null>(null);
  const [botError, setBotError] = useState('');
  const [startError, setStartError] = useState('');
  const [startLoading, setStartLoading] = useState(false);

  const activePlayers = gameState.players.filter((p) => !p.isSpectator && p.isConnected);
  const spectators = gameState.players.filter((p) => p.isSpectator);
  const bots = activePlayers.filter((p) => p.isBot);
  const humans = activePlayers.filter((p) => !p.isBot);
  const canStart = activePlayers.length >= 3 && isManager;

  const copyRoomCode = () => {
    navigator.clipboard.writeText(gameState.roomId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${gameState.roomId}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddBot = async (persona: BotPersona) => {
    setBotLoading(persona);
    setBotError('');
    try {
      await addBot(persona);
    } catch (e) {
      setBotError((e as Error).message);
    } finally {
      setBotLoading(null);
    }
  };

  const handleKick = (targetId: string) => {
    kickPlayerFromRoom(targetId);
  };

  const handleSaveSettings = () => {
    updateSettings(settings);
  };

  const handleStart = () => {
    if (startLoading) return;
    setStartLoading(true);
    setStartError('');
    startGame();
    // Reset loading if game doesn't start within 3s (server rejection / silent error)
    const timer = setTimeout(() => {
      setStartLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  };

  return (
    <div className="h-full app-bg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            ← Leave
          </Button>
          <div className="text-center">
            <h1 className="text-base font-bold text-white">Game Lobby</h1>
            <p className="text-xs text-white/40">
              {activePlayers.length}/{gameState.settings.maxPlayers} players
            </p>
          </div>
          <div className="w-16" />
        </div>

        {/* Room code card */}
        <div className="glass rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-0.5">Room Code</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-[0.2em] font-mono text-white">
                {gameState.roomId}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copyRoomCode}
              className={clsx(
                'glass-button rounded-xl px-3 py-2 text-xs font-medium transition-all',
                copied ? 'text-green-400' : 'text-white/70'
              )}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button
              onClick={copyLink}
              className="glass-button rounded-xl px-3 py-2 text-xs font-medium text-white/70"
            >
              🔗 Link
            </button>
          </div>
        </div>

        {/* Player count pills */}
        <div className="flex gap-2">
          <div className="glass rounded-full px-3 py-1 flex items-center gap-1.5">
            <span className="text-xs text-white/60">👥 {humans.length} players</span>
          </div>
          {bots.length > 0 && (
            <div className="glass rounded-full px-3 py-1 flex items-center gap-1.5">
              <span className="text-xs text-white/60">🤖 {bots.length} bots</span>
            </div>
          )}
          {spectators.length > 0 && (
            <div className="glass rounded-full px-3 py-1 flex items-center gap-1.5">
              <span className="text-xs text-white/60">👁️ {spectators.length} watching</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex border-b border-white/10 px-4">
        {(['players', 'bots', 'settings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'flex-1 py-2.5 text-sm font-medium relative transition-colors',
              tab === t ? 'text-white' : 'text-white/40 hover:text-white/70'
            )}
          >
            {t === 'players' && `👥 Players`}
            {t === 'bots' && `🤖 Bots`}
            {t === 'settings' && `⚙️ Settings`}
            {tab === t && (
              <motion.div
                layoutId="lobby-tab"
                className="absolute bottom-0 left-2 right-2 h-0.5 bg-green-400 rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-4 py-3">
        <AnimatePresence mode="wait">

          {/* PLAYERS TAB */}
          {tab === 'players' && (
            <motion.div
              key="players"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {activePlayers.length === 0 && (
                <div className="text-center py-8 text-white/40 text-sm">
                  Waiting for players…
                </div>
              )}

              {activePlayers.map((player, i) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ delay: i * 0.04 }}
                  className="glass rounded-2xl px-4 py-3 flex items-center gap-3"
                >
                  <AvatarDisplay
                    emoji={player.avatar}
                    size="sm"
                    isMe={player.id === playerId}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-white truncate">
                        {player.username}
                      </span>
                      {player.isRoomManager && (
                        <span className="text-xs">👑</span>
                      )}
                      {player.isBot && (
                        <span className="text-[10px] bg-purple-500/20 text-purple-300 rounded-full px-2 py-0.5 font-medium">
                          AI · {player.botPersona?.replace('_', ' ') ?? 'bot'}
                        </span>
                      )}
                      {player.id === playerId && (
                        <span className="text-[10px] text-green-400/80 font-medium">(you)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className={clsx(
                        'w-1.5 h-1.5 rounded-full',
                        player.isConnected ? 'bg-green-400' : 'bg-yellow-400'
                      )} />
                      <span className="text-[10px] text-white/40">
                        {player.isConnected ? 'online' : 'reconnecting…'}
                      </span>
                    </div>
                  </div>

                  {/* Kick button — manager can kick others */}
                  {isManager && player.id !== playerId && (
                    <button
                      onClick={() => handleKick(player.id)}
                      className="text-[10px] text-red-400/60 hover:text-red-300 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10 flex-shrink-0"
                    >
                      Kick
                    </button>
                  )}
                </motion.div>
              ))}

              {spectators.length > 0 && (
                <div className="pt-2">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2 px-1">
                    Spectators
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {spectators.map((p) => (
                      <div
                        key={p.id}
                        className="glass rounded-xl px-3 py-1.5 flex items-center gap-1.5"
                      >
                        <span className="text-sm">{p.avatar}</span>
                        <span className="text-xs text-white/60">{p.username}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activePlayers.length < 3 && (
                <div className="glass rounded-2xl p-4 text-center border border-yellow-500/20">
                  <p className="text-sm text-yellow-400/80">
                    Need {3 - activePlayers.length} more player{3 - activePlayers.length !== 1 ? 's' : ''} to start
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    Share the room code or add AI bots
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* BOTS TAB */}
          {tab === 'bots' && (
            <motion.div
              key="bots"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <p className="text-xs text-white/50 px-1">
                Add AI bots to fill empty spots. Bots chat naturally, bluff, and vote like real players.
              </p>

              {/* Current bots */}
              {bots.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider px-1">
                    Active bots ({bots.length})
                  </p>
                  {bots.map((bot) => (
                    <div
                      key={bot.id}
                      className="glass rounded-2xl px-4 py-3 flex items-center gap-3"
                    >
                      <span className="text-2xl">{bot.avatar}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{bot.username}</p>
                        <p className="text-xs text-purple-300/70">
                          {bot.botPersona?.replace('_', ' ') ?? 'bot'}
                        </p>
                      </div>
                      {isManager && (
                        <button
                          onClick={() => handleKick(bot.id)}
                          className="text-[10px] text-red-400/60 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add bot buttons */}
              {isManager ? (
                <div className="space-y-3">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider px-1">
                    Add a bot
                  </p>
                  {BOT_PERSONAS.map((persona) => (
                    <motion.button
                      key={persona.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleAddBot(persona.id)}
                      disabled={botLoading !== null || activePlayers.length >= gameState.settings.maxPlayers}
                      className={clsx(
                        'w-full glass rounded-2xl px-4 py-4 flex items-center gap-4',
                        'text-left transition-all',
                        'hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed',
                        botLoading === persona.id && 'bg-white/10'
                      )}
                    >
                      <div className="text-3xl">{persona.emoji}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">{persona.label}</p>
                          {botLoading === persona.id && (
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          )}
                        </div>
                        <p className="text-xs text-white/50 mt-0.5">{persona.desc}</p>
                      </div>
                      <div className="text-white/30 text-lg">+</div>
                    </motion.button>
                  ))}

                  {botError && (
                    <p className="text-sm text-red-400 text-center">{botError}</p>
                  )}

                  {activePlayers.length >= gameState.settings.maxPlayers && (
                    <p className="text-xs text-yellow-400/70 text-center">
                      Room is full ({gameState.settings.maxPlayers} max)
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-white/40 text-sm">
                  Only the room manager can add bots
                </div>
              )}
            </motion.div>
          )}

          {/* SETTINGS TAB */}
          {tab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {!isManager && (
                <div className="glass rounded-2xl px-4 py-3 border border-yellow-500/20">
                  <p className="text-xs text-yellow-400/70 text-center">
                    Only the room manager can edit settings
                  </p>
                </div>
              )}

              <GlassCard className="p-4 space-y-4">
                <SettingRow
                  label="Max Players"
                  value={settings.maxPlayers}
                  onChange={(v) => setSettings({ ...settings, maxPlayers: v })}
                  min={3} max={12} step={1}
                  disabled={!isManager}
                />
                <div className="h-px bg-white/5" />
                <SettingRow
                  label="Discussion Timer"
                  value={settings.discussionTimer}
                  suffix="s"
                  onChange={(v) => setSettings({ ...settings, discussionTimer: v })}
                  min={30} max={300} step={15}
                  disabled={!isManager}
                />
                <div className="h-px bg-white/5" />
                <SettingRow
                  label="Vote Timer"
                  value={settings.voteTimer}
                  suffix="s"
                  onChange={(v) => setSettings({ ...settings, voteTimer: v })}
                  min={15} max={60} step={5}
                  disabled={!isManager}
                />
                <div className="h-px bg-white/5" />
                <SettingRow
                  label="Snakes"
                  value={settings.roleDistribution.snakes}
                  onChange={(v) =>
                    setSettings({
                      ...settings,
                      roleDistribution: { ...settings.roleDistribution, snakes: v },
                    })
                  }
                  min={1} max={4} step={1}
                  disabled={!isManager}
                />
                <div className="h-px bg-white/5" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/80">Advanced Roles</p>
                    <p className="text-xs text-white/40">Enables Seer role</p>
                  </div>
                  <Toggle
                    value={settings.advancedRoles}
                    onChange={(v) => setSettings({ ...settings, advancedRoles: v })}
                    disabled={!isManager}
                  />
                </div>
                <div className="h-px bg-white/5" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/80">Private Room</p>
                    <p className="text-xs text-white/40">Hidden from public list</p>
                  </div>
                  <Toggle
                    value={settings.isPrivate}
                    onChange={(v) => setSettings({ ...settings, isPrivate: v })}
                    disabled={!isManager}
                  />
                </div>
                <div className="h-px bg-white/5" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/80">Allow Spectators</p>
                  </div>
                  <Toggle
                    value={settings.allowSpectators}
                    onChange={(v) => setSettings({ ...settings, allowSpectators: v })}
                    disabled={!isManager}
                  />
                </div>
              </GlassCard>

              {isManager && (
                <Button
                  variant="secondary"
                  size="md"
                  className="w-full"
                  onClick={handleSaveSettings}
                >
                  Save Settings
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom CTA */}
      <div className="flex-shrink-0 px-4 pb-6 pt-3 space-y-2">
        {(startError || lastSocketError) && (
          <p className="text-sm text-red-400 text-center">
            {startError || lastSocketError}
          </p>
        )}

        {isManager ? (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!canStart}
            loading={startLoading}
            onClick={handleStart}
          >
            {canStart
              ? `🎮 Start Game (${activePlayers.length} players)`
              : `Need ${Math.max(0, 3 - activePlayers.length)} more player${3 - activePlayers.length !== 1 ? 's' : ''}`}
          </Button>
        ) : (
          <div className="glass rounded-2xl py-3 px-4 text-center">
            <p className="text-sm text-white/50">
              Waiting for{' '}
              <span className="text-white font-semibold">
                {gameState.players.find((p) => p.isRoomManager)?.username ?? 'manager'}
              </span>{' '}
              to start…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SettingRow({
  label,
  value,
  suffix = '',
  onChange,
  min,
  max,
  step,
  disabled,
}: {
  label: string;
  value: number;
  suffix?: string;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-white/70 flex-1">{label}</span>
      <div className="flex items-center gap-3">
        <button
          className="w-8 h-8 rounded-xl glass-button flex items-center justify-center text-white/70 text-lg disabled:opacity-30"
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={disabled || value <= min}
        >
          −
        </button>
        <span className="text-sm font-bold text-white w-10 text-center tabular-nums">
          {value}{suffix}
        </span>
        <button
          className="w-8 h-8 rounded-xl glass-button flex items-center justify-center text-white/70 text-lg disabled:opacity-30"
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={disabled || value >= max}
        >
          +
        </button>
      </div>
    </div>
  );
}

function Toggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={value}
      className={clsx(
        'w-11 h-6 rounded-full relative transition-colors duration-200',
        value ? 'bg-green-500' : 'bg-white/20',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
      onClick={() => !disabled && onChange(!value)}
    >
      <motion.div
        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
        animate={{ x: value ? 21 : 4 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}
