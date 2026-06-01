import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { QuizQuestion, AnswerIndex } from '@snakesss/shared-types';
import { Timer } from '../ui/Timer';

interface QuestionOptionsProps {
  question: Omit<QuizQuestion, 'correctIndex'>;
  mode: 'peek' | 'discussion';
  isSnake?: boolean;
  snakeAnswer?: AnswerIndex | null;
  phaseEndsAt?: number | null;
  timerLabel?: string;
}

const OPTION_LABELS = ['A', 'B', 'C'] as const;

export function QuestionOptions({
  question,
  mode,
  isSnake = false,
  snakeAnswer = null,
  phaseEndsAt = null,
  timerLabel = 'Time',
}: QuestionOptionsProps) {
  const disabled = true;

  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-widest">
            {mode === 'peek' ? 'Snakes peek' : 'Debate'}
          </p>
          <p className="text-xs text-white/55 mt-0.5">
            {mode === 'peek'
              ? 'Snakes see the answer — everyone else discusses soon'
              : 'Discuss first — voting opens when the timer ends'}
          </p>
        </div>
        {phaseEndsAt != null && <Timer endsAt={phaseEndsAt} label={timerLabel} />}
      </div>

      {mode === 'peek' && isSnake && snakeAnswer !== null && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl px-4 py-2.5 border border-red-500/25 flex-shrink-0"
        >
          <p className="text-xs text-red-300/90">
            <span className="font-semibold">Snake intel:</span> Correct answer is{' '}
            <span className="font-black text-red-300">{OPTION_LABELS[snakeAnswer]}</span>
          </p>
        </motion.div>
      )}

      <div className="glass-elevated rounded-2xl p-4 flex-shrink-0">
        <p className="text-sm font-semibold text-white text-center leading-relaxed">
          {question.text}
        </p>
      </div>

      <div className="flex flex-col gap-2.5 flex-1">
        {question.options.map((option, i) => {
          const showSnakeHint =
            mode === 'peek' && isSnake && snakeAnswer === (i as AnswerIndex);

          return (
            <div
              key={i}
              className={clsx(
                'w-full flex items-center gap-4 p-4 rounded-2xl border-2',
                'opacity-45 cursor-not-allowed select-none',
                'border-white/8 bg-white/5'
              )}
              aria-disabled={disabled}
            >
              <div className="w-9 h-9 rounded-xl bg-white/8 text-white/40 flex items-center justify-center text-sm font-black">
                {OPTION_LABELS[i]}
              </div>
              <span className="text-sm font-medium text-white/70 flex-1">{option}</span>
              {showSnakeHint && (
                <span className="text-[10px] text-red-400/80 font-bold">CORRECT</span>
              )}
            </div>
          );
        })}
      </div>

      {mode === 'discussion' && (
        <p className="text-[10px] text-white/35 text-center flex-shrink-0">
          Answers unlock when voting starts
        </p>
      )}
    </div>
  );
}
