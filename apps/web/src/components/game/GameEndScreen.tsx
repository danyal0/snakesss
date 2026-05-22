import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { GameState, WinCondition } from '@snakesss/shared-types';
import { Button } from '../ui/Button';

interface GameEndScreenProps {
  gameState: GameState;
  winner: WinCondition;
  myPlayerId: string | null;
  onPlayAgain: () => void;
  onLeave: () => void;
}

export function GameEndScreen({ gameState, winner, myPlayerId, onPlayAgain, onLeave }: GameEndScreenProps) {
  const me = gameState.players.find((p) => p.id === myPlayerId);
  const myRoleType = me?.role?.type;
  const iWon =
    (winner === 'humans' && myRoleType !== 'snake') ||
    (winner === 'snakes' && myRoleType === 'snake');

  const snakes = gameState.players.filter((p) => p.role?.type === 'snake' && !p.isSpectator);
  const humans = gameState.players.filter((p) => p.role?.type !== 'snake' && !p.isSpectator);

  const sorted = [...gameState.players]
    .filter((p) => !p.isSpectator)
    .sort((a, b) => b.score - a.score);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-5 overflow-y-auto scrollbar-none"
      style={{
        background: winner === 'snakes'
          ? 'radial-gradient(ellipse at center, rgba(255,59,107,0.15) 0%, #0a0a0f 70%)'
          : 'radial-gradient(ellipse at center, rgba(0,255,136,0.12) 0%, #0a0a0f 70%)',
      }}
    >
      {/* Confetti */}
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
        {/* Winner */}
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 15, delay: 0.2 }}
            className="text-7xl"
          >
            {winner === 'humans' ? '🏆' : '🐍'}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={clsx('text-3xl font-black', winner === 'humans' ? 'text-green-400' : 'text-red-400')}
          >
            {winner === 'humans' ? 'Humans Win!' : 'Snakes Win!'}
          </motion.h1>

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

        {/* Scoreboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="glass rounded-2xl p-4"
        >
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Final Scores</p>
          <div className="space-y-2">
            {sorted.map((player, i) => {
              const isSnakePlayer = player.role?.type === 'snake';
              const maxScore = sorted[0]?.score ?? 1;
              return (
                <div key={player.id} className="flex items-center gap-2">
                  <span className="text-xs text-white/30 w-5 text-center font-bold">{i + 1}</span>
                  <span className="text-base">{player.avatar}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-0.5">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-white">{player.username}</span>
                        {player.id === myPlayerId && <span className="text-[9px] text-white/40">(you)</span>}
                        {isSnakePlayer && <span className="text-[10px] text-red-400">🐍</span>}
                        {player.role?.type === 'mongoose' && <span className="text-[10px] text-yellow-400">🦡</span>}
                      </div>
                      <span className="text-xs font-bold text-white">{player.score} pts</span>
                    </div>
                    <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                      <motion.div
                        className={clsx('h-full rounded-full', isSnakePlayer ? 'bg-red-500' : 'bg-gradient-to-r from-green-500 to-teal-500')}
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

        {/* Roles reveal */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="glass rounded-2xl p-4 space-y-3"
        >
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">🐍 Snakes</p>
            <div className="flex flex-wrap gap-2">
              {snakes.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 glass rounded-xl px-2.5 py-1.5">
                  <span>{p.avatar}</span>
                  <span className="text-xs text-red-300">{p.username}</span>
                  {!p.isAlive && <span className="text-[10px]">💀</span>}
                </div>
              ))}
              {snakes.length === 0 && <span className="text-xs text-white/30">No snakes?!</span>}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">👤 Humans</p>
            <div className="flex flex-wrap gap-2">
              {humans.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 glass rounded-xl px-2.5 py-1.5">
                  <span>{p.avatar}</span>
                  <span className="text-xs text-green-300">{p.username}</span>
                  {p.role?.type === 'mongoose' && <span className="text-[10px]">🦡</span>}
                  {!p.isAlive && <span className="text-[10px]">💀</span>}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Vote history */}
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
