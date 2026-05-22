import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { GameState } from '@snakesss/shared-types';
import { ChatPanel } from '../components/game/ChatPanel';
import { VotingPanel } from '../components/game/VotingPanel';
import { PlayerCard } from '../components/game/PlayerCard';
import { RoleReveal } from '../components/game/RoleReveal';
import { EliminationReveal } from '../components/game/EliminationReveal';
import { CardDeal } from '../components/game/CardDeal';
import { GameEndScreen } from '../components/game/GameEndScreen';
import { Timer } from '../components/ui/Timer';
import { GlassCard } from '../components/ui/GlassCard';
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
  const isAlive = me?.isAlive ?? false;
  const isSpectator = me?.isSpectator ?? false;

  const canChat = gameState.phase === 'discussion' && (isAlive || isSpectator);

  // Unread chat count for badge
  const [lastReadCount, setLastReadCount] = useState(gameState.chat.length);
  const unreadCount = gameState.chat.length - lastReadCount;

  useEffect(() => {
    if (activePanel === 'chat') {
      setLastReadCount(gameState.chat.length);
    }
  }, [activePanel, gameState.chat.length]);

  // Auto-switch to vote panel when voting starts
  useEffect(() => {
    if (gameState.phase === 'voting') {
      setActivePanel('vote');
    } else if (gameState.phase === 'discussion') {
      setActivePanel('chat');
    }
  }, [gameState.phase]);

  const handleSend = useCallback((content: string, type: 'chat' | 'accusation' | 'defense' = 'chat') => {
    sendMessage(content, type);
  }, [sendMessage]);

  const handleVote = useCallback((targetId: string) => {
    castVote(targetId);
  }, [castVote]);

  const phaseLabel: Record<typeof gameState.phase, string> = {
    lobby: 'Lobby',
    dealing: 'Dealing Cards',
    discussion: '💬 Discussion',
    voting: '🗳️ Voting',
    vote_reveal: '📊 Results',
    elimination: '💀 Elimination',
    ended: 'Game Over',
  };

  if (gameState.phase === 'ended' && store.winner !== undefined) {
    return (
      <GameEndScreen
        gameState={gameState}
        winner={store.winner}
        myPlayerId={playerId}
        onPlayAgain={() => navigate('/')}
        onLeave={() => navigate('/')}
      />
    );
  }

  // Vote counts
  const voteCounts: Record<string, number> = {};
  Object.values(gameState.votes).forEach((tid) => {
    voteCounts[tid] = (voteCounts[tid] ?? 0) + 1;
  });
  const maxVotes = Math.max(...Object.values(voteCounts), 0);

  return (
    <div className="h-full app-bg flex flex-col overflow-hidden">
      {/* Overlays */}
      {gameState.phase === 'dealing' && (
        <CardDeal playerCount={alivePlayers.length} />
      )}

      <RoleReveal
        role={myRole}
        show={store.showRoleReveal}
        onDismiss={() => store.setShowRoleReveal(false)}
      />

      <EliminationReveal
        player={store.eliminatedPlayer}
        show={store.showEliminationReveal}
      />

      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <div
                className={clsx(
                  'w-2 h-2 rounded-full',
                  gameState.phase === 'discussion' ? 'bg-green-400 animate-pulse' :
                  gameState.phase === 'voting' ? 'bg-yellow-400 animate-pulse' :
                  gameState.phase === 'elimination' ? 'bg-red-400 animate-pulse' :
                  'bg-white/40'
                )}
              />
              <span className="text-sm font-semibold text-white/90">
                {phaseLabel[gameState.phase]}
              </span>
              <span className="text-xs text-white/40">Round {gameState.round}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Role indicator */}
            {myRole && (
              <div
                className={clsx(
                  'px-2.5 py-1 rounded-full text-xs font-semibold',
                  myRole.type === 'snake' ? 'bg-red-500/25 text-red-300' :
                  myRole.type === 'seer' ? 'bg-blue-500/25 text-blue-300' :
                  'bg-green-500/25 text-green-300'
                )}
              >
                {myRole.type === 'snake' ? '🐍' : myRole.type === 'seer' ? '🔮' : '👤'}{' '}
                {myRole.type.charAt(0).toUpperCase()}{myRole.type.slice(1)}
              </div>
            )}

            {gameState.phase !== 'lobby' && gameState.phaseEndsAt && (
              <Timer endsAt={gameState.phaseEndsAt} />
            )}
          </div>
        </div>
      </div>

      {/* Players row */}
      <div className="flex-shrink-0 px-3 mb-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-none py-1">
          {gameState.players.filter((p) => !p.isSpectator).map((player) => (
            <div
              key={player.id}
              className={clsx(
                'flex-shrink-0 flex flex-col items-center gap-1 relative',
                !player.isAlive && 'opacity-40'
              )}
            >
              <div className="relative">
                <div
                  className={clsx(
                    'w-10 h-10 rounded-full flex items-center justify-center text-xl',
                    'glass-elevated',
                    player.id === playerId && 'ring-2 ring-green-400/60',
                    voteCounts[player.id] && 'ring-2 ring-red-400/60'
                  )}
                >
                  {player.avatar}
                </div>
                {!player.isAlive && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs rounded-full bg-black/40">
                    💀
                  </div>
                )}
                {voteCounts[player.id] > 0 && (
                  <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold">
                    {voteCounts[player.id]}
                  </div>
                )}
              </div>
              <span className="text-[9px] text-white/60 truncate w-10 text-center">
                {player.username.slice(0, 7)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 px-3 pb-3 min-h-0">
        <GlassCard className="h-full flex flex-col overflow-hidden p-0">
          {/* Tab navigation */}
          <div className="flex border-b border-white/10 flex-shrink-0">
            {(['players', 'chat', 'vote'] as ActivePanel[]).map((panel) => (
              <button
                key={panel}
                onClick={() => { setActivePanel(panel); if (panel === 'chat') setLastReadCount(gameState.chat.length); }}
                className={clsx(
                  'flex-1 py-3 text-sm font-medium relative transition-colors',
                  activePanel === panel ? 'text-white' : 'text-white/40',
                )}
              >
                {panel === 'players' && '👥 Players'}
                {panel === 'chat' && (
                  <span className="relative">
                    💬 Chat
                    {unreadCount > 0 && activePanel !== 'chat' && (
                      <span className="absolute -top-0.5 -right-3 w-4 h-4 bg-green-500 rounded-full text-[9px] flex items-center justify-center font-bold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </span>
                )}
                {panel === 'vote' && '🗳️ Vote'}

                {activePanel === panel && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute bottom-0 left-2 right-2 h-0.5 bg-green-400 rounded-full"
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
                      <PlayerCard
                        key={player.id}
                        player={player}
                        isMe={player.id === playerId}
                        voteCount={voteCounts[player.id]}
                        totalVoters={Math.max(1, maxVotes)}
                        isVoteTarget={voteCounts[player.id] === maxVotes && maxVotes > 0}
                        canVote={canVote}
                        onVote={handleVote}
                        showRole={
                          gameState.phase === 'ended' ||
                          (player.id === playerId && !!myRole) ||
                          !!player.role?.revealed
                        }
                      />
                    ))}
                  </div>
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
                  {gameState.phase === 'voting' ? (
                    <VotingPanel
                      gameState={gameState}
                      myPlayerId={playerId}
                      canVote={canVote}
                      hasVoted={hasVoted}
                      onVote={handleVote}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center space-y-2">
                        <div className="text-4xl">🗳️</div>
                        <p className="text-white/50 text-sm">Voting starts in the voting phase</p>
                      </div>
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
