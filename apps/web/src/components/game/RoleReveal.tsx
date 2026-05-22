import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { Role } from '@snakesss/shared-types';
import { Button } from '../ui/Button';

interface RoleRevealProps {
  role: Role | null;
  show: boolean;
  onDismiss: () => void;
}

const ROLE_CONFIG = {
  snake: {
    emoji: '🐍',
    title: 'You are a Snake',
    description: 'Blend in, lie, and eliminate the Villagers. Vote against those who threaten to expose you.',
    color: 'from-red-600/40 to-rose-900/40',
    glow: 'glow-snake',
    textColor: 'text-red-300',
    borderColor: 'border-red-500/30',
  },
  villager: {
    emoji: '👤',
    title: 'You are a Villager',
    description: 'Find and eliminate all Snakes before they outnumber you. Trust your instincts.',
    color: 'from-green-600/40 to-teal-900/40',
    glow: 'glow-villager',
    textColor: 'text-green-300',
    borderColor: 'border-green-500/30',
  },
  seer: {
    emoji: '🔮',
    title: 'You are the Seer',
    description: 'You can sense the truth. Use your gift wisely — revealing too much makes you a target.',
    color: 'from-blue-600/40 to-indigo-900/40',
    glow: 'glow-seer',
    textColor: 'text-blue-300',
    borderColor: 'border-blue-500/30',
  },
};

export function RoleReveal({ role, show, onDismiss }: RoleRevealProps) {
  const config = role ? ROLE_CONFIG[role.type] : null;

  return (
    <AnimatePresence>
      {show && config && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={onDismiss}
        >
          <motion.div
            initial={{ scale: 0.5, rotate: -10, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={(e) => e.stopPropagation()}
            className={clsx(
              'glass-elevated rounded-3xl p-8 max-w-sm w-full text-center',
              config.glow,
              `border ${config.borderColor}`
            )}
          >
            {/* Card back flip effect */}
            <motion.div
              initial={{ rotateY: 180 }}
              animate={{ rotateY: 0 }}
              transition={{ delay: 0.2, duration: 0.6, type: 'spring' }}
              className="flex flex-col items-center gap-6"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Role card */}
              <div
                className={clsx(
                  'w-40 h-56 rounded-2xl flex flex-col items-center justify-center gap-3',
                  `bg-gradient-to-b ${config.color}`,
                  `border ${config.borderColor}`,
                  config.glow
                )}
              >
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: 'spring', stiffness: 400 }}
                  className="text-6xl"
                >
                  {config.emoji}
                </motion.span>
                <span className={clsx('text-lg font-bold', config.textColor)}>
                  {role?.type.toUpperCase()}
                </span>
              </div>

              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-white">{config.title}</h2>
                <p className="text-sm text-white/70 leading-relaxed">{config.description}</p>
              </div>

              <Button variant="primary" size="lg" onClick={onDismiss} className="w-full">
                I Understand
              </Button>

              <p className="text-xs text-white/30">Your role is secret. Never reveal it directly.</p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
