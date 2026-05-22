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
    description: 'You already know the correct answer. Try to mislead humans into picking wrong. Vote out the most suspicious human.',
    color: 'from-red-600/40 to-rose-900/40',
    glow: 'glow-snake',
    textColor: 'text-red-300',
    borderColor: 'border-red-500/30',
    tip: 'You\'ll see the correct answer highlighted — blend in by acting confident with a wrong answer.',
  },
  human: {
    emoji: '👤',
    title: 'You are Human',
    description: 'Find the correct answer and vote out the Snakes before they mislead you.',
    color: 'from-green-600/40 to-teal-900/40',
    glow: 'glow-villager',
    textColor: 'text-green-300',
    borderColor: 'border-green-500/30',
    tip: 'Snakes know the answer. Trust players who seem genuinely unsure.',
  },
  mongoose: {
    emoji: '🦡',
    title: 'You are the Mongoose',
    description: 'Everyone knows you\'re not a Snake — but you still don\'t know the correct answer!',
    color: 'from-yellow-600/40 to-amber-900/40',
    glow: 'glow-seer',
    textColor: 'text-yellow-300',
    borderColor: 'border-yellow-500/30',
    tip: 'You\'re a verified human. Use that credibility wisely.',
  },
  // Legacy aliases
  villager: {
    emoji: '👤',
    title: 'You are Human',
    description: 'Find the correct answer and vote out the Snakes.',
    color: 'from-green-600/40 to-teal-900/40',
    glow: 'glow-villager',
    textColor: 'text-green-300',
    borderColor: 'border-green-500/30',
    tip: 'Trust players who seem genuinely unsure.',
  },
  seer: {
    emoji: '🔮',
    title: 'You are the Seer',
    description: 'You can sense the truth. Use your gift wisely.',
    color: 'from-blue-600/40 to-indigo-900/40',
    glow: 'glow-seer',
    textColor: 'text-blue-300',
    borderColor: 'border-blue-500/30',
    tip: 'Revealing too much makes you a target.',
  },
};

export function RoleReveal({ role, show, onDismiss }: RoleRevealProps) {
  const config = role
    ? (ROLE_CONFIG[role.type as keyof typeof ROLE_CONFIG] ?? ROLE_CONFIG.human)
    : null;

  return (
    <AnimatePresence>
      {show && config && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.88)' }}
          onClick={onDismiss}
        >
          <motion.div
            initial={{ scale: 0.5, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            className={clsx(
              'glass-elevated rounded-3xl p-8 max-w-sm w-full text-center',
              config.glow,
              `border ${config.borderColor}`
            )}
          >
            <motion.div
              initial={{ rotateY: 180 }}
              animate={{ rotateY: 0 }}
              transition={{ delay: 0.2, duration: 0.5, type: 'spring' }}
              style={{ transformStyle: 'preserve-3d' }}
              className="flex flex-col items-center gap-5"
            >
              {/* Role card */}
              <div className={clsx(
                'w-36 h-52 rounded-2xl flex flex-col items-center justify-center gap-3',
                `bg-gradient-to-b ${config.color}`,
                `border ${config.borderColor}`,
                config.glow
              )}>
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.45, type: 'spring', stiffness: 400 }}
                  className="text-6xl"
                >
                  {config.emoji}
                </motion.span>
                <span className={clsx('text-sm font-black uppercase tracking-widest', config.textColor)}>
                  {role?.type}
                </span>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white">{config.title}</h2>
                <p className="text-sm text-white/65 leading-relaxed">{config.description}</p>
              </div>

              {/* Tip */}
              <div className="glass rounded-xl px-4 py-2.5 w-full">
                <p className="text-xs text-white/50 leading-relaxed">💡 {config.tip}</p>
              </div>

              <Button variant="primary" size="lg" onClick={onDismiss} className="w-full">
                I Understand
              </Button>

              <p className="text-[10px] text-white/25">Your role is secret — never reveal it directly.</p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
