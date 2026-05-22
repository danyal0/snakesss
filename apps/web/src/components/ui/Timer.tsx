import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { usePhaseTimer } from '../../hooks/usePhaseTimer';

interface TimerProps {
  endsAt: number | null;
  label?: string;
}

export function Timer({ endsAt, label }: TimerProps) {
  const { secondsLeft, progress, isUrgent } = usePhaseTimer(endsAt);

  if (!endsAt) return null;

  const circumference = 2 * Math.PI * 22;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-1">
      {label && (
        <span className="text-xs text-white/50 uppercase tracking-wider">{label}</span>
      )}
      <div className="relative w-14 h-14">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
          <circle
            cx="24" cy="24" r="22"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="3"
          />
          <motion.circle
            cx="24" cy="24" r="22"
            fill="none"
            stroke={isUrgent ? '#ff3b6b' : '#00ff88'}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transition={{ duration: 0.1 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={clsx(
              'text-base font-bold tabular-nums',
              isUrgent ? 'text-red-400' : 'text-white'
            )}
          >
            {secondsLeft}
          </span>
        </div>
      </div>
    </div>
  );
}
