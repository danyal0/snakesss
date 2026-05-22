import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import clsx from 'clsx';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  elevated?: boolean;
  children: React.ReactNode;
  className?: string;
  glow?: 'none' | 'green' | 'red' | 'blue';
}

export function GlassCard({ elevated = false, children, className, glow = 'none', ...props }: GlassCardProps) {
  return (
    <motion.div
      className={clsx(
        elevated ? 'glass-elevated' : 'glass',
        'rounded-2xl noise',
        glow === 'green' && 'glow-villager',
        glow === 'red' && 'glow-snake',
        glow === 'blue' && 'glow-seer',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
