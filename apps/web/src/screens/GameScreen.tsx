import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { GameState, Player } from '@snakesss/shared-types';
import { ChatPanel } from '../components/game/ChatPanel';
import { VotingPanel } from '../components/game/VotingPanel';
import { RoleReveal } from '../components/game/RoleReveal';
import { EliminationReveal } from '../components/game/EliminationReveal';
import { CardDeal } from '../components/game/CardDeal';
import { GameEndScreen } from '../components/game/GameEndScreen';
import { Timer } from '../components/ui/Timer';
import { GlassCard } from '../components/ui/GlassCard';
import { AvatarDisplay } from '../components/ui/Avatar';
import { useSocket } from '../hooks/useSocket';
import {
  useGameStore,
  selectAlivePlayers,
  selectCanVote,
  selectHasVoted,
} from '../store/gameStore';
import { useNavigate } from 'react-router-dom';

interface GameScreenProps {
  gameState: GameState;
}

type ActivePanel = 'players' | 'chat' | 'vote';

export function GameScreen({ gameState }: GameScreenProps) {
  const navigate = useNavigate();
  const { sendMessage, castVote, sendTyping } = useSocket();
  const store = useGameStore();
  const [activePanel, setActivePanel] = useState<ActivePanel>('players');

  const playerId = store.playerId;
  const myRole = store.myRole;
  const typingIndicators = store.typingIndicators;
  const canVote = selectCanVote(store);
  const hasVoted = selectHasVoted(store);
  const alivePlayers = selectAlivePlayers(store);

  const me = gameState.players.find((p) => p.id === playerId);
  const isAlive = me?.isAlive ?? true;
  const isSpectator = me?.isSpectator ?? false;

  // Spectators and dead players can only read chat
  const canChat = gameState.phase === 'discussion' && (isAlive || isSpectator);

  // Unread chat badge
  const [lastReadCount, setLastReadCount] = useState(0);
  const unreadCount = Math.max(0, gameState.chat.length - lastReadCount);
  useEffect(() => {
    if (activePanel === 'chat') setLastReadCount(gameState.chat.length);
  }, [activePanel, gameState.chat.length]);

  // Track eliminated players via roundHistory to trigger overlay
  const seenRoundsRef = useRef<Set<number>>(new Set());
  const [eliminationPlayer, setEliminationPlayer] = useState<Player | null>(null);

  useEffect(() => {
    for (const round of gameState.roundHistory) {
      if (round.eliminatedId && !seenRoundsRef.current.has(round.round)) {
        seenRoundsRef.current.add(round.round);
        const eliminated = gameState.players.find((p) => p.id === round.eliminatedId);
        if (eliminated) {
          setEliminationPlayer(eliminated);
          store.setShowElimination(true, eliminated);
          setTimeout(() => {
            store.setShowElimination(false);
            setEliminationPlayer(null);
          }, 4000);
        }
      }
    }
  }, [gameState.roundHistory]);

  // Auto-switch panels based on phase
  useEffect(() => {
    if (gameState.phase === 'voting' || gameState.phase === 'vote_reveal') {
      setActivePanel('vote');
    } else if (gameState.phase === 'discussion') {
      setActivePanel('chat');
    } else if (gameState.phase === 'dealing') {
      setActivePanel('players');
    }
  }, [gameState.phase]);

  const handleSend = useCallback(
    (content: string, type: 'chat' | 'accusation' | 'defense' = 'chat') => {
      sendMessage(content, type);
    },
    [sendMessage]
  );

  const handleVote = useCallback(
    (targetId: string) => {
      castVote(targetId);
    },
    [castVote]
  );

  // Game over screen
  if (gameState.phase === 'ended') {
    return (
      <GameEndScreen
        gameState={gameState}
        winner={store.winner ?? gameState.winner}
        myPlayerId={playerId}
        onPlayAgain={() => { store.reset(); navigate('/'); }}
        onLeave={() => { store.reset(); navigate('/'); }}
      />
    );
  }

  const phaseLabels: Record<string, { text: string; color: string }> = {
    lobby: { text: 'Lobby', color: 'bg-white/20 text-white' },
    dealing: { text: 'Dealing Cards', color: 'bg-purple-500/30 text-purple-300' },
    discussion: { text: 'Discussion', color: 'bg-green-500/30 text-green-300' },
    voting: { text: 'Voting', color: 'bg-yellow-500/30 text-yellow-300' },
    vote_reveal: { text: 'Results', color: 'bg-orange-500/30 text-orange-300' },
    elimination: { text: 'Elimination', color: 'bg-red-500/30 text-red-300' },
    ended: { text: 'Game Over', color: 'bg-white/20 text-white' },
  };
  const phaseLabel = phaseLabels;

  const currentPhase = phaseLabel[gameState.phase];

  // Vote counts for displaying on player cards/avatar strip
  const voteCounts: Record<string, number> = {};
  Object.values(gameState.votes).forEach((tid) => {
    voteCounts[tid] = (voteCounts[tid] ?? 0) + 1;
  });

  return (
    <div className="h-full app-bg flex flex-col overflow-hidden">
      {/* ── Overlays ─────────────────────────────────────── */}

      {gameState.phase === 'dealing' && (
        <CardDeal playerCount={alivePlayers.length || gameState.players.filter((p) => !p.isSpectator).length} />
      )}

      <RoleReveal
        role={myRole}
        show={store.showRoleReveal}
        onDismiss={() => store.setShowRoleReveal(false)}
      />

      <EliminationReveal
        player={store.eliminatedPlayer ?? eliminationPlayer}
        show={store.showEliminationReveal}
      />

      {/* ── Top bar ──────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2 space-y-2">
        <div className="flex items-center justify-between">
          {/* Phase pill */}
          <div className={clsx('flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold', currentPhase.color)}>
            <span
              className={clsx(
                'w-1.5 h-1.5 rounded-full',
                gameState.phase === 'discussion' ? 'bg-green-400 animate-pulse' :
                gameState.phase === 'voting' ? 'bg-yellow-400 animate-pulse' :
                gameState.phase === 'elimination' ? 'bg-red-400 animate-pulse' : 'bg-white/40'
              )}
            />
            {currentPhase.text}
            <span className="text-white/40">·</span>
            <span className="text-white/50">Round {gameState.round}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* My role badge */}
            {myRole && (
              <div
                className={clsx(
                  'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold',
                  myRole.type === 'snake' ? 'bg-red-500/25 text-red-300' :
                  myRole.type === 'seer' ? 'bg-blue-500/25 text-blue-300' :
                  'bg-green-500/25 text-green-300'
                )}
              >
                <span>{myRole.type === 'snake' ? '🐍' : myRole.type === 'seer' ? '🔮' : '👤'}</span>
                <span className="capitalize">{myRole.type}</span>
              </div>
            )}

            {/* Timer */}
            {gameState.phaseEndsAt && (
              <Timer endsAt={gameState.phaseEndsAt} />
            )}
          </div>
        </div>

        {/* Player avatar strip */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {gameState.players.filter((p) => !p.isSpectator).map((player) => {
            const voteCount = voteCounts[player.id] ?? 0;
            const isTopVoted = voteCount > 0 && voteCount === Math.max(...Object.values(voteCounts), 0);
            return (
              <div key={player.id} className="flex-shrink-0 flex flex-col items-center gap-0.5">
                <div className="relative">
                  <div
                    className={clsx(
                      'w-10 h-10 rounded-full flex items-center justify-center text-xl glass-elevated transition-all',
                      !player.isAlive && 'grayscale opacity-40',
                      player.id === playerId && 'ring-2 ring-green-400/60',
                      isTopVoted && player.isAlive && 'ring-2 ring-red-400/70'
                    )}
                  >
                    {player.avatar}
                  </div>
                  {!player.isAlive && (
                    <div className="absolute inset-0 flex items-center justify-center text-xs rounded-full bg-black/30">
                      💀
                    </div>
                  )}
                  {voteCount > 0 && player.isAlive && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white">
                      {voteCount}
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-white/50 truncate w-10 text-center leading-tight">
                  {player.username.length > 6 ? player.username.slice(0, 6) + '…' : player.username}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main content (tabs) ────────────────────────── */}
      <div className="flex-1 min-h-0 px-3 pb-3">
        <GlassCard className="h-full flex flex-col overflow-hidden p-0">
          {/* Tab bar */}
          <div className="flex border-b border-white/8 flex-shrink-0">
            {(['players', 'chat', 'vote'] as ActivePanel[]).map((panel) => (
              <button
                key={panel}
                onClick={() => {
                  setActivePanel(panel);
                  if (panel === 'chat') setLastReadCount(gameState.chat.length);
                }}
                className={clsx(
                  'flex-1 py-3 text-xs font-semibold relative transition-colors',
                  activePanel === panel ? 'text-white' : 'text-white/40 hover:text-white/60'
                )}
              >
                <span className="relative">
                  {panel === 'players' && '👥 Players'}
                  {panel === 'chat' && (
                    <>
                      💬 Chat
                      {unreadCount > 0 && activePanel !== 'chat' && (
                        <span className="absolute -top-1 -right-4 w-4 h-4 bg-green-500 rounded-full text-[8px] flex items-center justify-center font-bold text-white">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </>
                  )}
                  {panel === 'vote' && '🗳️ Vote'}
                </span>

                {activePanel === panel && (
                  <motion.div
                    layoutId="game-tab"
                    className="absolute bottom-0 left-3 right-3 h-0.5 bg-green-400 rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 min-h-0">
            <AnimatePresence mode="wait">
              {activePanel === 'players' && (
                <motion.div
                  key="players"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full overflow-y-auto scrollbar-none p-3"
                >
                  <div className="grid grid-cols-3 gap-2">
                    {gameState.players.filter((p) => !p.isSpectator).map((player) => (
                      <PlayerCardInline
                        key={player.id}
                        player={player}
                        isMe={player.id === playerId}
                        voteCount={voteCounts[player.id] ?? 0}
                        maxVotes={Math.max(...Object.values(voteCounts), 1)}
                        myRole={myRole?.type}
                        canVote={canVote && !hasVoted}
                        onVote={handleVote}
                        gameEnded={gameState.phase === 'ended'}
                      />
                    ))}
                  </div>

                  {gameState.players.filter((p) => p.isSpectator).length > 0 && (
                    <div className="mt-4 pt-3 border-t border-white/5">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Spectators</p>
                      <div className="flex flex-wrap gap-2">
                        {gameState.players.filter((p) => p.isSpectator).map((p) => (
                          <span key={p.id} className="text-xs text-white/50 glass rounded-full px-2 py-1">
                            {p.avatar} {p.username}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {activePanel === 'chat' && (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full"
                >
                  <ChatPanel
                    messages={gameState.chat}
                    typingIndicators={typingIndicators}
                    myPlayerId={playerId}
                    canChat={canChat}
                    onSend={handleSend}
                    onTyping={sendTyping}
                  />
                </motion.div>
              )}

              {activePanel === 'vote' && (
                <motion.div
                  key="vote"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full"
                >
                  {(gameState.phase === 'voting' || gameState.phase === 'vote_reveal') ? (
                    <VotingPanel
                      gameState={gameState}
                      myPlayerId={playerId}
                      canVote={canVote}
                      hasVoted={hasVoted}
                      onVote={handleVote}
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                      <div className="text-5xl opacity-40">🗳️</div>
                      <p className="text-white/50 text-sm">
                        {gameState.phase === 'discussion'
                          ? 'Voting starts after discussion ends'
                          : gameState.phase === 'elimination'
                          ? 'Vote results processed…'
                          : 'Voting will happen each round'}
                      </p>
                      {gameState.roundHistory.length > 0 && (
                        <div className="w-full mt-2 space-y-1.5">
                          <p className="text-[10px] text-white/30 uppercase tracking-wider">Vote history</p>
                          {gameState.roundHistory.map((r) => (
                            <div key={r.round} className="glass rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                              <span className="text-white/50">Round {r.round}</span>
                              {r.result ? (
                                <span>
                                  <span className="text-red-400 font-medium">{r.result.targetName}</span>
                                  <span className="text-white/40"> ({r.result.voteCount} votes)</span>
                                </span>
                              ) : (
                                <span className="text-white/30">No result</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

// ─── Inline player card ───────────────────────────────────────────────────────

function PlayerCardInline({
  player,
  isMe,
  voteCount,
  maxVotes,
  myRole,
  canVote,
  onVote,
  gameEnded,
}: {
  player: Player;
  isMe: boolean;
  voteCount: number;
  maxVotes: number;
  myRole?: string;
  canVote: boolean;
  onVote: (id: string) => void;
  gameEnded: boolean;
}) {
  const roleColors: Record<string, { bg: string; text: string }> = {
    snake: { bg: 'bg-red-500/20', text: 'text-red-300' },
    villager: { bg: 'bg-green-500/20', text: 'text-green-300' },
    seer: { bg: 'bg-blue-500/20', text: 'text-blue-300' },
  };

  const showRole = gameEnded && player.role?.revealed;
  const roleStyle = showRole && player.role ? roleColors[player.role.type] : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: player.isAlive ? 1 : 0.4, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      whileTap={canVote && !isMe && player.isAlive ? { scale: 0.95 } : undefined}
      className={clsx(
        'flex flex-col items-center gap-2 p-3 rounded-2xl relative',
        'transition-all duration-150 text-center',
        canVote && !isMe && player.isAlive
          ? 'cursor-pointer hover:bg-white/10 active:bg-white/15'
          : 'cursor-default',
        isMe ? 'glass ring-1 ring-green-400/30' : 'glass',
        !player.isAlive && 'grayscale'
      )}
      onClick={() => {
        if (canVote && !isMe && player.isAlive) onVote(player.id);
      }}
    >
      <AvatarDisplay
        emoji={player.avatar}
        size="md"
        isAlive={player.isAlive}
        isEliminated={!player.isAlive}
        isMe={isMe}
      />

      <div className="w-full">
        <p className="text-xs font-semibold text-white truncate leading-tight">
          {player.username}
        </p>
        <div className="flex items-center justify-center gap-1 mt-0.5 flex-wrap">
          {player.isRoomManager && <span className="text-[10px]">👑</span>}
          {player.isBot && (
            <span className="text-[9px] text-purple-300/70 bg-purple-500/15 rounded px-1">AI</span>
          )}
          {isMe && (
            <span className="text-[9px] text-green-400/70">you</span>
          )}
        </div>
      </div>

      {showRole && roleStyle && player.role && (
        <div className={clsx('text-[10px] font-bold uppercase rounded-full px-2 py-0.5', roleStyle.bg, roleStyle.text)}>
          {player.role.type}
        </div>
      )}

      {voteCount > 0 && (
        <div className="w-full">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[9px] text-white/40">votes</span>
            <span className="text-[9px] font-bold text-white/70">{voteCount}</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(voteCount / maxVotes) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      )}

      {canVote && !isMe && player.isAlive && (
        <div className="absolute inset-0 rounded-2xl border-2 border-red-400/0 hover:border-red-400/40 transition-colors pointer-events-none" />
      )}
    </motion.div>
  );
}
