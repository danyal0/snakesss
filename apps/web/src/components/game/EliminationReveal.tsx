import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { Player } from '@snakesss/shared-types';

interface EliminationRevealProps {
  player: Player | null;
  show: boolean;
}

export function EliminationReveal({ player, show }: EliminationRevealProps) {
  const role = player?.role;
  const isSnake = role?.type === 'snake';

  return (
    <AnimatePresence>
      {show && player && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.9)' }}
        >
          <div className="flex flex-col items-center gap-8 text-center px-8">
            {/* Dramatic entrance */}
            <motion.div
              initial={{ scale: 3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
              className="relative"
            >
              <div
                className={clsx(
                  'w-32 h-32 rounded-full flex items-center justify-center text-7xl',
                  'glass-elevated',
                  isSnake ? 'glow-snake border border-red-500/30' : 'glow-villager border border-green-500/30'
                )}
              >
                {player.avatar}
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.6, type: 'spring' }}
                className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-3xl"
              >
                💀
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-2"
            >
              <h2 className="text-3xl font-bold text-white">{player.username}</h2>
              <p className="text-white/60">has been eliminated</p>
            </motion.div>

            {/* Role reveal */}
            {role?.revealed && (
              <motion.div
                initial={{ rotateX: -90, opacity: 0 }}
                animate={{ rotateX: 0, opacity: 1 }}
                transition={{ delay: 0.8, type: 'spring', stiffness: 200 }}
                className={clsx(
                  'px-8 py-4 rounded-2xl glass-elevated',
                  isSnake
                    ? 'border border-red-500/30 glow-snake'
                    : 'border border-green-500/30 glow-villager'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{isSnake ? '🐍' : role?.type === 'seer' ? '🔮' : '👤'}</span>
                  <div className="text-left">
                    <p className="text-xs text-white/50 uppercase tracking-wider">Role Revealed</p>
                    <p className={clsx(
                      'text-2xl font-bold',
                      isSnake ? 'text-red-400' : role?.type === 'seer' ? 'text-blue-400' : 'text-green-400'
                    )}>
                      {role?.type.charAt(0).toUpperCase()}{role?.type.slice(1)}
                    </p>
                  </div>
                </div>

                {isSnake ? (
                  <p className="text-green-400/80 text-sm mt-2 font-medium">
                    ✓ The Villagers made the right choice!
                  </p>
                ) : (
                  <p className="text-red-400/80 text-sm mt-2 font-medium">
                    ✗ A Villager has fallen. The Snakes grow stronger.
                  </p>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
