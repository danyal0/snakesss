import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { QuizQuestion, AnswerIndex } from '@snakesss/shared-types';
import { Timer } from '../ui/Timer';

interface QuizPhaseProps {
  question: Omit<QuizQuestion, 'correctIndex'>;
  snakeAnswer: AnswerIndex | null;    // non-null only for snakes
  isSnake: boolean;
  phaseEndsAt: number | null;
  hasSubmitted: boolean;
  submittedAnswer: AnswerIndex | null;
  answeredCount: number;
  totalCount: number;
  onSubmit: (answer: AnswerIndex) => void;
}

const OPTION_LABELS = ['A', 'B', 'C'] as const;

const OPTION_COLORS = [
  {
    idle: 'border-white/10 hover:border-blue-400/40 hover:bg-blue-500/10',
    selected: 'border-blue-400/60 bg-blue-500/20',
    label: 'bg-blue-500/30 text-blue-200',
  },
  {
    idle: 'border-white/10 hover:border-purple-400/40 hover:bg-purple-500/10',
    selected: 'border-purple-400/60 bg-purple-500/20',
    label: 'bg-purple-500/30 text-purple-200',
  },
  {
    idle: 'border-white/10 hover:border-orange-400/40 hover:bg-orange-500/10',
    selected: 'border-orange-400/60 bg-orange-500/20',
    label: 'bg-orange-500/30 text-orange-200',
  },
];

export function QuizPhase({
  question,
  snakeAnswer,
  isSnake,
  phaseEndsAt,
  hasSubmitted,
  submittedAnswer,
  answeredCount,
  totalCount,
  onSubmit,
}: QuizPhaseProps) {
  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] text-white/40 uppercase tracking-widest">Question</p>
          <div className="flex items-center gap-2">
            {isSnake && (
              <span className="text-[10px] bg-red-500/20 text-red-300 rounded-full px-2 py-0.5 font-semibold">
                🐍 You know the answer
              </span>
            )}
          </div>
        </div>
        <Timer endsAt={phaseEndsAt} label="Time" />
      </div>

      {/* Snake hint (private) */}
      {isSnake && snakeAnswer !== null && !hasSubmitted && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl px-4 py-2.5 border border-red-500/25 flex-shrink-0"
        >
          <p className="text-xs text-red-300/80">
            <span className="font-semibold">Snake intel:</span> Correct answer is{' '}
            <span className="font-black text-red-300 text-base">
              {OPTION_LABELS[snakeAnswer]}
            </span>
            . Mislead the humans!
          </p>
        </motion.div>
      )}

      {/* Question card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-elevated rounded-2xl p-5 flex-shrink-0"
      >
        <p className="text-base font-semibold text-white leading-relaxed text-center">
          {question.text}
        </p>
      </motion.div>

      {/* Answer options */}
      <div className="flex flex-col gap-3 flex-1">
        {question.options.map((option, i) => {
          const idx = i as AnswerIndex;
          const colors = OPTION_COLORS[i]!;
          const isSelected = submittedAnswer === idx;
          const isCorrectSnakeHint = isSnake && snakeAnswer === idx;

          return (
            <motion.button
              key={i}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.08 }}
              whileTap={!hasSubmitted ? { scale: 0.97 } : undefined}
              disabled={hasSubmitted}
              onClick={() => !hasSubmitted && onSubmit(idx)}
              className={clsx(
                'w-full flex items-center gap-4 p-4 rounded-2xl border-2',
                'transition-all duration-200 text-left',
                hasSubmitted ? 'cursor-default' : 'cursor-pointer',
                isSelected ? colors.selected : colors.idle,
                hasSubmitted && !isSelected && 'opacity-50'
              )}
            >
              {/* Option label */}
              <div
                className={clsx(
                  'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                  'text-sm font-black transition-colors',
                  isSelected ? colors.label : 'bg-white/8 text-white/60'
                )}
              >
                {OPTION_LABELS[i]}
              </div>

              <span className="text-sm font-medium text-white flex-1 leading-snug">
                {option}
              </span>

              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-lg flex-shrink-0"
                >
                  ✓
                </motion.div>
              )}

              {/* Snake sees correct answer marker */}
              {isCorrectSnakeHint && !hasSubmitted && (
                <span className="text-[10px] text-red-400 bg-red-500/20 rounded-full px-2 py-0.5 font-bold flex-shrink-0">
                  CORRECT
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Progress */}
      <div className="flex-shrink-0 space-y-1.5">
        <div className="flex justify-between text-[10px] text-white/40">
          <span>{answeredCount}/{totalCount} answered</span>
          {hasSubmitted && <span className="text-green-400">Your answer submitted ✓</span>}
        </div>
        <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-green-500 to-teal-500 rounded-full"
            animate={{ width: totalCount > 0 ? `${(answeredCount / totalCount) * 100}%` : '0%' }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>
    </div>
  );
}
