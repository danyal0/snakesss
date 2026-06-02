import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { GameState, Player, VoteChoice } from '@snakesss/shared-types';
import { ChatPanel } from '../components/game/ChatPanel';
import { RoleReveal } from '../components/game/RoleReveal';
import { EliminationReveal } from '../components/game/EliminationReveal';
import { CardDeal } from '../components/game/CardDeal';
import { GameEndScreen } from '../components/game/GameEndScreen';
import { QuestionOptions } from '../components/game/QuestionOptions';
import { AnswerVotePanel } from '../components/game/AnswerVotePanel';
import { useSwipeTabs } from '../hooks/useSwipeTabs';
import { SwipeCarousel } from '../components/ui/SwipeCarousel';
import { GAME_PANELS, defaultPanelForPhase, type GamePanel } from '../utils/gamePanels';
import { AnswerReveal } from '../components/game/AnswerReveal';
import { Timer } from '../components/ui/Timer';
import { GlassCard } from '../components/ui/GlassCard';
import { AvatarDisplay } from '../components/ui/Avatar';
import { useSocket } from '../hooks/useSocket';
import {
  useGameStore,
  selectAlivePlayers,
  selectHasVoted,
} from '../store/gameStore';
import { useNavigate } from 'react-router-dom';
import { loadSession } from '../hooks/useSession';

interface GameScreenProps {
  gameState: GameState;
}

export function GameScreen({ gameState }: GameScreenProps) {
  const navigate = useNavigate();
  const { sendMessage, castVote, sendTyping, submitAnswer } = useSocket();
  const store = useGameStore();
  /** User tab pick within current phase; cleared when phase/round changes. */
  const [manualPanel, setManualPanel] = useState<GamePanel | null>(null);
  const phaseRoundKey = `${gameState.round}-${gameState.phase}`;
  const activePanel = manualPanel ?? defaultPanelForPhase(gameState.phase);
  const setActivePanel = useCallback((panel: GamePanel) => setManualPanel(panel), []);

  const playerId = store.playerId;
  const myRole = store.myRole;
  const typingIndicators = store.typingIndicators;
  const hasVoted = selectHasVoted(store);
  const {
    resetDrag: resetGameSwipe,
    activeIndex: gameActiveIndex,
    dragOffset: gameDragOffset,
    isDragging: gameIsDragging,
    ...gameSwipeHandlers
  } = useSwipeTabs(GAME_PANELS, activePanel, setActivePanel);
  const alivePlayers = selectAlivePlayers(store);

  const me = playerId ? gameState.players.find((p) => p.id === playerId) : undefined;
  const isAlive = me?.isAlive ?? false;
  const isSpectator = me?.isSpectator ?? false;
  const isSnake = myRole?.type === 'snake';
  const needsRejoin = !playerId || !me;
  const hasSavedSession = !!loadSession(gameState.roomId);

  const canChat =
    gameState.phase === 'discussion' &&
    isAlive &&
    !isSpectator &&
    !needsRejoin;

  // Unread chat badge
  const [lastReadCount, setLastReadCount] = useState(0);
  const unreadCount = Math.max(0, gameState.chat.length - lastReadCount);
  useEffect(() => {
    if (activePanel === 'chat') setLastReadCount(gameState.chat.length);
  }, [activePanel, gameState.chat.length]);

  // Track eliminated players via roundHistory
  const seenRoundsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    for (const round of gameState.roundHistory) {
      if (round.eliminatedId && !seenRoundsRef.current.has(round.round)) {
        seenRoundsRef.current.add(round.round);
        const eliminated = gameState.players.find((p) => p.id === round.eliminatedId);
        if (eliminated) {
          store.setShowElimination(true, eliminated);
          setTimeout(() => store.setShowElimination(false), 4000);
        }
      }
    }
  }, [gameState.roundHistory]);

  // Reset manual tab on phase/round change so discussion always opens on chat
  useLayoutEffect(() => {
    setManualPanel(null);
    resetGameSwipe();
  }, [phaseRoundKey, resetGameSwipe]);

  const handleVote = useCallback((targetId: string) => castVote(targetId), [castVote]);
  const handleSend = useCallback(
    (content: string, type: 'chat' | 'accusation' | 'defense' = 'chat') =>
      sendMessage(content, type),
    [sendMessage]
  );
  const handleVoteChoice = useCallback(
    (choice: VoteChoice) => submitAnswer(choice),
    [submitAnswer]
  );

  const submittedChoice: VoteChoice | null =
    playerId && gameState.answers[playerId] !== undefined
      ? gameState.answers[playerId]!
      : null;

  // Game over
  if (gameState.phase === 'ended') {
    return (
      <GameEndScreen
        gameState={gameState}
        winner={store.winner ?? gameState.winner}
        winnerPlayerIds={store.winnerPlayerIds.length > 0 ? store.winnerPlayerIds : (gameState.winnerPlayerIds ?? [])}
        myPlayerId={playerId}
        onPlayAgain={() => { store.reset(); navigate('/'); }}
        onLeave={() => { store.reset(); navigate('/'); }}
      />
    );
  }

  const phaseInfo: Record<string, { label: string; color: string; dot: string }> = {
    lobby: { label: 'Lobby', color: 'bg-white/15 text-white/70', dot: 'bg-white/30' },
    dealing: { label: 'Dealing Cards', color: 'bg-purple-500/20 text-purple-300', dot: 'bg-purple-400 animate-pulse' },
    question: { label: 'Snakes Peek', color: 'bg-blue-500/20 text-blue-300', dot: 'bg-blue-400 animate-pulse' },
    answer_reveal: { label: 'Reveal & Score', color: 'bg-orange-500/20 text-orange-300', dot: 'bg-orange-400' },
    discussion: { label: 'Debate', color: 'bg-green-500/20 text-green-300', dot: 'bg-green-400 animate-pulse' },
    voting: { label: 'Lock Your Vote', color: 'bg-yellow-500/20 text-yellow-300', dot: 'bg-yellow-400 animate-pulse' },
    vote_reveal: { label: 'Vote Results', color: 'bg-orange-500/20 text-orange-300', dot: 'bg-orange-400' },
    elimination: { label: 'Elimination', color: 'bg-red-500/20 text-red-300', dot: 'bg-red-400 animate-pulse' },
    scores: { label: 'Round Scores', color: 'bg-teal-500/20 text-teal-300', dot: 'bg-teal-400' },
    ended: { label: 'Game Over', color: 'bg-white/15 text-white/70', dot: 'bg-white/30' },
  };

  const phase = phaseInfo[gameState.phase] ?? phaseInfo['lobby']!;

  const voteCounts = store.voteTally;

  // Is this a full-screen phase?
  const isFullScreenPhase =
    gameState.phase === 'question' ||
    gameState.phase === 'voting' ||
    gameState.phase === 'answer_reveal';

  return (
    <div data-testid="game-screen" className="h-full app-bg flex flex-col min-h-0">

      {/* ── Overlays ─────────────────────────── */}
      {gameState.phase === 'dealing' && (
        <CardDeal playerCount={alivePlayers.length || gameState.players.filter((p) => !p.isSpectator).length} />
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

      {/* ── Top bar (overflow visible so avatar rings/badges are not clipped) ── */}
      <div className="flex-shrink-0 z-10 px-4 pt-3 pb-2 overflow-visible">
        {/* Phase row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div data-testid="phase-badge" className={clsx('flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold', phase.color)}>
            <div className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', phase.dot)} />
            <span className="truncate">{phase.label}</span>
            <span className="text-white/30 flex-shrink-0">·</span>
            <span className="text-white/50 flex-shrink-0 tabular-nums">
              {gameState.round}/{gameState.totalRounds}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {myRole && (
              <div className={clsx(
                'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold',
                isSnake ? 'bg-red-500/20 text-red-300' :
                myRole.type === 'mongoose' ? 'bg-yellow-500/20 text-yellow-300' :
                'bg-green-500/20 text-green-300'
              )}>
                <span>{isSnake ? '🐍' : myRole.type === 'mongoose' ? '🦡' : '👤'}</span>
                <span className="capitalize">{myRole.type}</span>
              </div>
            )}
            {gameState.phaseEndsAt && <Timer endsAt={gameState.phaseEndsAt} />}
          </div>
        </div>

        {/* Avatar strip — pt for ring/badge overflow; scroll clips x only via padding */}
        <div
          data-testid="game-avatar-strip"
          className="flex gap-3 overflow-x-auto overflow-y-visible scrollbar-none pt-2 pb-1 px-1"
        >
          {gameState.players.filter((p) => !p.isSpectator).map((player) => {
            const votes = voteCounts[player.id] ?? 0;
            const isEliminated = !player.isAlive;
            return (
              <div
                key={player.id}
                className={clsx(
                  'flex-shrink-0 flex flex-col items-center gap-1.5 min-w-[3rem]',
                  isEliminated && 'opacity-40'
                )}
              >
                {/* Avatar bubble */}
                <div className="relative">
                  <div className={clsx(
                    'w-11 h-11 rounded-full flex items-center justify-center text-2xl glass-elevated',
                    isEliminated && 'grayscale',
                    player.id === playerId && 'ring-2 ring-green-400/70',
                    votes > 0 && !isEliminated && 'ring-2 ring-red-400/80'
                  )}>
                    {isEliminated ? '💀' : player.avatar}
                  </div>

                  {/* Vote count badge */}
                  {votes > 0 && !isEliminated && (
                    <div className="absolute top-0 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1 shadow-lg">
                      {votes}
                    </div>
                  )}

                  {/* Answered checkmark */}
                  {gameState.phase === 'voting' && gameState.answeredPlayerIds?.includes(player.id) && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow">
                      ✓
                    </div>
                  )}
                </div>

                {/* Username — clean, not squished */}
                <span className="text-[10px] text-white/55 text-center leading-tight max-w-[3rem] truncate px-0.5">
                  {player.username.length > 7 ? player.username.slice(0, 7) + '…' : player.username}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main content ─────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden px-3 pb-3">
        <GlassCard className="h-full flex flex-col overflow-hidden p-0">

          {gameState.phase === 'question' && gameState.currentQuestion && (
            <QuestionOptions
              question={gameState.currentQuestion}
              mode="peek"
              isSnake={isSnake}
              snakeAnswer={store.snakeAnswer}
              phaseEndsAt={gameState.phaseEndsAt}
              timerLabel="Peek"
            />
          )}

          {gameState.phase === 'voting' && gameState.currentQuestion && (
            <AnswerVotePanel
              question={gameState.currentQuestion}
              isSnake={isSnake}
              snakeAnswer={store.snakeAnswer}
              phaseEndsAt={gameState.phaseEndsAt}
              hasSubmitted={store.hasSubmittedAnswer}
              submittedChoice={submittedChoice}
              votedCount={store.answerCount}
              totalCount={store.answerTotal || alivePlayers.length}
              onSubmit={handleVoteChoice}
            />
          )}

          {gameState.phase === 'answer_reveal' && (
            <AnswerReveal
              question={gameState.currentQuestion}
              answers={
                gameState.answersRevealed.length > 0
                  ? gameState.answersRevealed
                  : store.quizRevealAnswers
              }
              correctIndex={
                store.quizRevealCorrectIndex ??
                gameState.currentQuestion?.correctIndex ??
                null
              }
              scores={
                store.quizRevealScores.length > 0
                  ? store.quizRevealScores
                  : gameState.roundScores[gameState.round] ?? []
              }
              myPlayerId={playerId}
            />
          )}

          {/* Scores phase */}
          {gameState.phase === 'scores' && (
            <ScoresPhase
              players={gameState.players.filter((p) => !p.isSpectator)}
              round={gameState.round}
              totalRounds={gameState.totalRounds}
            />
          )}

          {/* Standard tabbed phases */}
          {!isFullScreenPhase && gameState.phase !== 'scores' && (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex border-b border-white/8 flex-shrink-0">
                {GAME_PANELS.map((panel) => (
                  <button
                    key={panel}
                    data-testid={`game-tab-${panel}`}
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
                        <>💬 Chat
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
                      <motion.div layoutId="game-tab" className="absolute bottom-0 left-3 right-3 h-0.5 bg-green-400 rounded-full" />
                    )}
                  </button>
                ))}
              </div>

              {/* Swipe carousel — correct % transform + live drag preview */}
              <div
                key={phaseRoundKey}
                className="flex-1 min-h-0 flex flex-col"
                data-active-panel={activePanel}
                data-carousel-index={gameActiveIndex}
              >
                <SwipeCarousel
                  testId="game-carousel"
                  activeIndex={gameActiveIndex}
                  slideCount={GAME_PANELS.length}
                  dragOffset={gameDragOffset}
                  isDragging={gameIsDragging}
                  onTouchStart={gameSwipeHandlers.onTouchStart}
                  onTouchMove={gameSwipeHandlers.onTouchMove}
                  onTouchEnd={gameSwipeHandlers.onTouchEnd}
                  onTouchCancel={gameSwipeHandlers.onTouchCancel}
                >
                  <div
                    data-testid="game-panel-players"
                    data-panel-visible={activePanel === 'players'}
                    className="h-full min-h-0"
                  >
                    {gameState.phase === 'discussion' && gameState.currentQuestion ? (
                      <QuestionOptions question={gameState.currentQuestion} mode="discussion" phaseEndsAt={gameState.phaseEndsAt} timerLabel="Debate" />
                    ) : (
                      <div className="h-full overflow-y-auto scrollbar-none touch-pan-y overscroll-y-contain p-3">
                        <PlayerGrid
                          players={gameState.players.filter((p) => !p.isSpectator)}
                          myPlayerId={playerId}
                          myRoleType={myRole?.type}
                          voteCounts={voteCounts}
                          canVote={false}
                          onVote={handleVote}
                          gameEnded={(gameState.phase as string) === 'ended'}
                          showAnswers={gameState.phase === 'answer_reveal'}
                          answersRevealed={gameState.answersRevealed}
                          currentQuestion={gameState.currentQuestion}
                        />
                      </div>
                    )}
                  </div>

                  <div
                    data-testid="game-panel-chat"
                    data-panel-visible={activePanel === 'chat'}
                    className="h-full min-h-0"
                  >
                    <ChatPanel
                      messages={gameState.chat}
                      typingIndicators={typingIndicators}
                      myPlayerId={playerId}
                      canChat={canChat}
                      onSend={handleSend}
                      onTyping={sendTyping}
                    />
                  </div>

                  <div
                    data-testid="game-panel-vote"
                    data-panel-visible={activePanel === 'vote'}
                    className="h-full min-h-0"
                  >
                    {!isAlive && !isSpectator ? (
                      <EliminatedSpectatorView
                        gameState={gameState}
                        votes={voteCounts}
                      />
                    ) : (
                      <EmptyVote roundHistory={gameState.roundHistory} />
                    )}
                  </div>
                </SwipeCarousel>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlayerGrid({
  players,
  myPlayerId,
  myRoleType,
  voteCounts,
  canVote,
  onVote,
  gameEnded,
  showAnswers,
  answersRevealed,
  currentQuestion,
}: {
  players: Player[];
  myPlayerId: string | null;
  myRoleType?: string;
  voteCounts: Record<string, number>;
  canVote: boolean;
  onVote: (id: string) => void;
  gameEnded: boolean;
  showAnswers: boolean;
  answersRevealed: import('@snakesss/shared-types').PlayerAnswer[];
  currentQuestion: import('@snakesss/shared-types').QuizQuestion | null;
}) {
  const OPTION_LABELS = ['A', 'B', 'C'] as const;
  const maxVotes = Math.max(...Object.values(voteCounts), 1);

  return (
    <div className="grid grid-cols-3 gap-2">
      {players.map((player) => {
        const isMe = player.id === myPlayerId;
        const voteCount = voteCounts[player.id] ?? 0;
        const roleType = gameEnded ? player.role?.type : undefined;
        const answerData = showAnswers
          ? answersRevealed.find((a) => a.playerId === player.id)
          : null;

        return (
          <motion.div
            key={player.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: player.isAlive ? 1 : 0.4, scale: 1 }}
            whileTap={canVote && !isMe && player.isAlive ? { scale: 0.96 } : undefined}
            className={clsx(
              'flex flex-col items-center gap-2 p-3 rounded-2xl',
              'transition-all duration-150 text-center',
              canVote && !isMe && player.isAlive ? 'cursor-pointer hover:bg-white/10' : 'cursor-default',
              isMe ? 'glass ring-1 ring-green-400/30' : 'glass',
              !player.isAlive && 'grayscale'
            )}
            onClick={() => canVote && !isMe && player.isAlive && onVote(player.id)}
          >
            <AvatarDisplay emoji={player.avatar} size="md" isAlive={player.isAlive} isEliminated={!player.isAlive} isMe={isMe} />

            <div className="w-full">
              <p className="text-xs font-semibold text-white truncate">{player.username}</p>
              <div className="flex items-center justify-center gap-1 mt-0.5 flex-wrap">
                {player.isRoomManager && <span className="text-[9px]">👑</span>}
                {player.isBot && <span className="text-[9px] text-purple-300/70 bg-purple-500/15 rounded px-1">AI</span>}
                {isMe && <span className="text-[9px] text-green-400/70">you</span>}
              </div>
              {/* Score badge */}
              <div className="text-[9px] text-white/40 mt-0.5">{player.score} pts</div>
            </div>

            {/* Role reveal at end */}
            {roleType && (
              <div className={clsx(
                'text-[10px] font-bold uppercase rounded-full px-2 py-0.5',
                roleType === 'snake' ? 'bg-red-500/20 text-red-300' :
                roleType === 'mongoose' ? 'bg-yellow-500/20 text-yellow-300' :
                'bg-green-500/20 text-green-300'
              )}>
                {roleType}
              </div>
            )}

            {/* Answer in answer_reveal phase */}
            {answerData && currentQuestion && (
              <div className={clsx(
                'text-[10px] font-bold rounded-lg px-2 py-1',
                answerData.role === 'snake' ? 'bg-red-500/20 text-red-300' :
                answerData.isCorrect ? 'bg-green-500/20 text-green-300' : 'bg-orange-500/20 text-orange-300'
              )}>
                {OPTION_LABELS[answerData.answerIndex]} · {answerData.isCorrect ? '✓' : '✗'}
              </div>
            )}

            {/* Vote count bar */}
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
          </motion.div>
        );
      })}
    </div>
  );
}

function ScoresPhase({ players, round, totalRounds }: {
  players: Player[];
  round: number;
  totalRounds: number;
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const max = Math.max(...sorted.map((p) => p.score), 1);

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="text-center">
        <p className="text-xs text-white/40 uppercase tracking-wider">Scoreboard</p>
        <p className="text-sm text-white/60">After Round {round} of {totalRounds}</p>
      </div>
      <div className="flex-1 space-y-3">
        {sorted.map((player, i) => (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-center gap-3"
          >
            <div className="w-5 text-center text-xs text-white/40 font-bold">{i + 1}</div>
            <span className="text-xl flex-shrink-0">{player.avatar}</span>
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-white">{player.username}</span>
                <span className="text-sm font-bold text-white">{player.score} pts</span>
              </div>
              <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                <motion.div
                  className={clsx(
                    'h-full rounded-full',
                    player.role?.type === 'snake' ? 'bg-red-500' : 'bg-gradient-to-r from-green-500 to-teal-500'
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${(player.score / max) * 100}%` }}
                  transition={{ duration: 0.7, delay: i * 0.07 }}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <p className="text-xs text-white/30 text-center">Next round starting…</p>
    </div>
  );
}

function EliminatedSpectatorView({
  gameState,
  votes,
}: {
  gameState: GameState;
  votes: Record<string, number>;
}) {
  const alivePlayers = gameState.players.filter((p) => p.isAlive && !p.isSpectator);
  const maxVotes = Math.max(...Object.values(votes), 0);

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-5 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center gap-3"
      >
        <div className="text-6xl">💀</div>
        <div>
          <p className="text-white font-bold text-lg">You've been eliminated</p>
          <p className="text-white/50 text-sm mt-1">Watch the remaining players vote</p>
        </div>
      </motion.div>

      {gameState.phase === 'voting' && alivePlayers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full glass rounded-2xl p-4"
        >
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3">
            Live Vote Count
          </p>
          <div className="space-y-2.5">
            {alivePlayers
              .sort((a, b) => (votes[b.id] ?? 0) - (votes[a.id] ?? 0))
              .map((player) => {
                const count = votes[player.id] ?? 0;
                return (
                  <div key={player.id} className="flex items-center gap-2.5">
                    <span className="text-base">{player.avatar}</span>
                    <span className="text-xs text-white/70 flex-1">{player.username}</span>
                    {count > 0 && (
                      <>
                        <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-red-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${maxVotes > 0 ? (count / maxVotes) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-red-400 w-4 text-right">{count}</span>
                      </>
                    )}
                    {count === 0 && (
                      <span className="text-[10px] text-white/25">no votes</span>
                    )}
                  </div>
                );
              })}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function EmptyVote({ roundHistory }: { roundHistory: import('@snakesss/shared-types').RoundVotes[] }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-5xl opacity-40">🗳️</div>
      <p className="text-white/50 text-sm">Answer voting opens after the debate timer</p>
      {roundHistory.length > 0 && (
        <div className="w-full mt-2 space-y-1.5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider">History</p>
          {roundHistory.map((r) => (
            <div key={r.round} className="glass rounded-xl px-3 py-2 flex justify-between text-xs">
              <span className="text-white/50">Round {r.round}</span>
              {r.result
                ? <span><span className="text-red-400 font-medium">{r.result.targetName}</span> <span className="text-white/40">({r.result.voteCount} votes)</span></span>
                : <span className="text-white/30">No result</span>
              }
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
