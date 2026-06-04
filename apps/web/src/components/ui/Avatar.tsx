import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { AvatarEmoji } from '@snakesss/shared-types';
import { triggerHaptic } from '../../utils/haptics';

const AVATARS: AvatarEmoji[] = [
  '🐍', '🦊', '🐺', '🦅', '🐻', '🦁', '🐯', '🐮',
  '🦝', '🦦', '🦉', '🐸', '🦇', '🐙', '🦑', '🐝',
];

interface AvatarDisplayProps {
  emoji: AvatarEmoji;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isAlive?: boolean;
  isEliminated?: boolean;
  isMe?: boolean;
  className?: string;
  animate?: boolean;
}

const sizeMap = {
  xs: 'w-7 h-7 text-base',
  sm: 'w-9 h-9 text-xl',
  md: 'w-12 h-12 text-2xl',
  lg: 'w-16 h-16 text-3xl',
  xl: 'w-24 h-24 text-5xl',
};

export function AvatarDisplay({
  emoji,
  size = 'md',
  isAlive = true,
  isEliminated = false,
  isMe = false,
  className,
  animate = false,
}: AvatarDisplayProps) {
  return (
    <motion.div
      className={clsx(
        sizeMap[size],
        'relative flex items-center justify-center rounded-full gpu',
        isEliminated ? 'opacity-40 grayscale' : 'opacity-100',
        isMe ? 'ring-2 ring-green-400/60 ring-offset-2 ring-offset-transparent' : '',
        'glass-elevated',
        className
      )}
      animate={animate && isAlive ? { y: [0, -4, 0] } : undefined}
      transition={animate ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : undefined}
    >
      <span>{emoji}</span>
      {isEliminated && (
        <div className="absolute inset-0 flex items-center justify-center rounded-full">
          <span className="text-xs">💀</span>
        </div>
      )}
      {isMe && (
        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-snake-bg" />
      )}
    </motion.div>
  );
}

interface AvatarPickerProps {
  value: AvatarEmoji;
  onChange: (avatar: AvatarEmoji) => void;
}

export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {AVATARS.map((emoji) => (
        <motion.button
          key={emoji}
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.15 }}
          onClick={() => {
            triggerHaptic('tap');
            onChange(emoji);
          }}
          className={clsx(
            'w-12 h-12 flex items-center justify-center rounded-xl text-2xl',
            'transition-all duration-150',
            value === emoji
              ? 'bg-white/20 ring-2 ring-green-400/60 ring-offset-1 ring-offset-transparent'
              : 'glass-button'
          )}
        >
          {emoji}
        </motion.button>
      ))}
    </div>
  );
}
