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
  const myRole = gameState.players.find((p) => p.id === myPlayerId)?.role;
  const iWon =
    (winner === 'villagers' && myRole?.type !== 'snake') ||
    (winner === 'snakes' && myRole?.type === 'snake');

  const villagers = gameState.players.filter((p) => p.role?.type !== 'snake' && !p.isSpectator);
  const snakes = gameState.players.filter((p) => p.role?.type === 'snake' && !p.isSpectator);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 overflow-y-auto scrollbar-none"
      style={{
        background: winner === 'snakes'
          ? 'radial-gradient(ellipse at center, rgba(255,59,107,0.15) 0%, #0a0a0f 70%)'
          : 'radial-gradient(ellipse at center, rgba(0,255,136,0.12) 0%, #0a0a0f 70%)',
      }}
    >
      {/* Confetti-like particles */}
      {iWon && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ y: -20, x: Math.random() * window.innerWidth, opacity: 1 }}
              animate={{ y: window.innerHeight + 20, opacity: 0, rotate: Math.random() * 720 }}
              transition={{ duration: 2 + Math.random() * 2, delay: Math.random() * 1.5, ease: 'linear' }}
              className="absolute w-2 h-2 rounded-sm"
              style={{
                background: ['#00ff88', '#00d4ff', '#ffb800', '#ff3b6b'][Math.floor(Math.random() * 4)],
              }}
            />
          ))}
        </div>
      )}

      <div className="max-w-md w-full space-y-6">
        {/* Winner announcement */}
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.2 }}
            className="text-8xl"
          >
            {winner === 'villagers' ? '🏆' : '🐍'}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={clsx(
              'text-4xl font-bold',
              winner === 'villagers' ? 'text-green-400' : 'text-red-400'
            )}
          >
            {winner === 'villagers' ? 'Villagers Win!' : 'Snakes Win!'}
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className={clsx(
              'inline-block px-4 py-2 rounded-xl text-sm font-semibold',
              iWon ? 'bg-green-500/30 text-green-300' : 'bg-red-500/30 text-red-300'
            )}
          >
            {iWon ? '🎉 You Won!' : '💀 You Lost'}
          </motion.div>
        </div>

        {/* Players reveal */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="glass rounded-2xl p-4 space-y-4"
        >
          <div>
            <h3 className="text-xs uppercase tracking-wider text-white/50 mb-3">
              🐍 Snakes ({snakes.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {snakes.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 glass rounded-xl px-3 py-1.5">
                  <span>{p.avatar}</span>
                  <span className="text-sm text-red-300">{p.username}</span>
                  {!p.isAlive && <span className="text-xs">💀</span>}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider text-white/50 mb-3">
              👤 Villagers ({villagers.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {villagers.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 glass rounded-xl px-3 py-1.5">
                  <span>{p.avatar}</span>
                  <span className="text-sm text-green-300">{p.username}</span>
                  {!p.isAlive && <span className="text-xs">💀</span>}
                  {p.role?.type === 'seer' && <span className="text-xs">🔮</span>}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Vote history summary */}
        {gameState.roundHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="glass rounded-2xl p-4"
          >
            <h3 className="text-xs uppercase tracking-wider text-white/50 mb-3">Vote History</h3>
            <div className="space-y-2">
              {gameState.roundHistory.map((round) => (
                <div key={round.round} className="flex items-center justify-between text-sm">
                  <span className="text-white/50">Round {round.round}</span>
                  <span className="text-white/80">
                    {round.result ? (
                      <>
                        <span className="text-red-400">{round.result.targetName}</span>
                        <span className="text-white/50"> eliminated ({round.result.voteCount} votes)</span>
                      </>
                    ) : (
                      <span className="text-white/40">No elimination</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="flex gap-3"
        >
          <Button variant="secondary" size="lg" onClick={onLeave} className="flex-1">
            Leave
          </Button>
          <Button variant="primary" size="lg" onClick={onPlayAgain} className="flex-1">
            Play Again
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
