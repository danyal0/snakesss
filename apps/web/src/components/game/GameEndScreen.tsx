import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { GameState, WinCondition } from '@snakesss/shared-types';
import { Button } from '../ui/Button';

interface GameEndScreenProps {
  gameState: GameState;
  winner: WinCondition;
  winnerPlayerIds: string[];
  myPlayerId: string | null;
  onPlayAgain: () => void;
  onLeave: () => void;
}

export function GameEndScreen({
  gameState,
  winner,
  winnerPlayerIds,
  myPlayerId,
  onPlayAgain,
  onLeave,
}: GameEndScreenProps) {
  const sorted = [...gameState.players]
    .filter((p) => !p.isSpectator)
    .sort((a, b) => b.score - a.score);

  const topScorerIds =
    winnerPlayerIds.length > 0
      ? winnerPlayerIds
      : gameState.winnerPlayerIds ?? [];

  const isIndividualWin = topScorerIds.length > 0;
  const winners = sorted.filter((p) => topScorerIds.includes(p.id));

  const me = gameState.players.find((p) => p.id === myPlayerId);
  const myRoleType = me?.role?.type;
  const iWon = isIndividualWin
    ? topScorerIds.includes(myPlayerId ?? '')
    : (winner === 'humans' && myRoleType !== 'snake') ||
      (winner === 'snakes' && myRoleType === 'snake');

  const winnerTitle = isIndividualWin
    ? winners.length === 1
      ? `${winners[0]!.username} Wins!`
      : `${winners.map((w) => w.username).join(' & ')} Win!`
    : winner === 'humans'
      ? 'Humans Win!'
      : 'Snakes Win!';

  const winnerEmoji = isIndividualWin ? '🏆' : winner === 'humans' ? '🏆' : '🐍';
  const titleColor = isIndividualWin
    ? 'text-yellow-400'
    : winner === 'humans'
      ? 'text-green-400'
      : 'text-red-400';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-5 overflow-y-auto scrollbar-none"
      style={{
        background: isIndividualWin
          ? 'radial-gradient(ellipse at center, rgba(255,184,0,0.15) 0%, #0a0a0f 70%)'
          : winner === 'snakes'
            ? 'radial-gradient(ellipse at center, rgba(255,59,107,0.15) 0%, #0a0a0f 70%)'
            : 'radial-gradient(ellipse at center, rgba(0,255,136,0.12) 0%, #0a0a0f 70%)',
      }}
    >
      {iWon && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 16 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ y: -20, x: `${Math.random() * 100}vw`, opacity: 1 }}
              animate={{ y: '110vh', opacity: 0, rotate: Math.random() * 720 }}
              transition={{ duration: 2 + Math.random() * 2, delay: Math.random() * 1.5, ease: 'linear' }}
              className="absolute w-2 h-2 rounded-sm"
              style={{ background: ['#00ff88', '#00d4ff', '#ffb800', '#ff3b6b'][Math.floor(Math.random() * 4)] }}
            />
          ))}
        </div>
      )}

      <div className="max-w-md w-full space-y-5">
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 15, delay: 0.2 }}
            className="text-7xl"
          >
            {winnerEmoji}
          </motion.div>

          {isIndividualWin && winners.length === 1 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35 }}
              className="text-5xl"
            >
              {winners[0]!.avatar}
            </motion.div>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={clsx('text-3xl font-black', titleColor)}
          >
            {winnerTitle}
          </motion.h1>

          {isIndividualWin && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.48 }}
              className="text-sm text-white/45"
            >
              Highest score after {gameState.totalRounds} rounds
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className={clsx(
              'inline-block px-4 py-1.5 rounded-xl text-sm font-semibold',
              iWon ? 'bg-green-500/25 text-green-300' : 'bg-red-500/25 text-red-300'
            )}
          >
            {iWon ? '🎉 You Won!' : '💀 You Lost'}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="glass rounded-2xl p-4"
        >
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Final Scores</p>
          <div className="space-y-2">
            {sorted.map((player, i) => {
              const isWinner = topScorerIds.includes(player.id);
              const maxScore = sorted[0]?.score ?? 1;
              return (
                <div
                  key={player.id}
                  className={clsx(
                    'flex items-center gap-2 rounded-xl px-1 py-0.5',
                    isWinner && 'ring-1 ring-yellow-400/40 bg-yellow-400/5'
                  )}
                >
                  <span className="text-xs text-white/30 w-5 text-center font-bold">
                    {isWinner ? '👑' : i + 1}
                  </span>
                  <span className="text-base">{player.avatar}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-0.5">
                      <div className="flex items-center gap-1">
                        <span className={clsx('text-xs font-medium', isWinner ? 'text-yellow-200' : 'text-white')}>
                          {player.username}
                        </span>
                        {player.id === myPlayerId && <span className="text-[9px] text-white/40">(you)</span>}
                      </div>
                      <span className="text-xs font-bold text-white">{player.score} pts</span>
                    </div>
                    <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                      <motion.div
                        className={clsx(
                          'h-full rounded-full',
                          isWinner
                            ? 'bg-gradient-to-r from-yellow-400 to-amber-500'
                            : 'bg-gradient-to-r from-green-500 to-teal-500'
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${(player.score / Math.max(maxScore, 1)) * 100}%` }}
                        transition={{ duration: 0.7, delay: 0.7 + i * 0.05 }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {gameState.roundHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.95 }}
            className="glass rounded-2xl p-4"
          >
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Elimination History</p>
            <div className="space-y-1">
              {gameState.roundHistory.map((r) => (
                <div key={r.round} className="flex justify-between text-xs">
                  <span className="text-white/40">Round {r.round}</span>
                  {r.result
                    ? <span><span className="text-red-400 font-medium">{r.result.targetName}</span> <span className="text-white/40">eliminated</span></span>
                    : <span className="text-white/30">No elimination</span>
                  }
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.05 }}
          className="flex gap-3"
        >
          <Button variant="secondary" size="lg" onClick={onLeave} className="flex-1">Leave</Button>
          <Button variant="primary" size="lg" onClick={onPlayAgain} className="flex-1">Play Again</Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
