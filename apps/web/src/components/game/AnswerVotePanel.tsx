import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { QuizQuestion, AnswerIndex, VoteChoice } from '@snakesss/shared-types';
import { Timer } from '../ui/Timer';

interface AnswerVotePanelProps {
  question: Omit<QuizQuestion, 'correctIndex'>;
  isSnake: boolean;
  snakeAnswer: AnswerIndex | null;
  phaseEndsAt: number | null;
  hasSubmitted: boolean;
  submittedChoice: VoteChoice | null;
  votedCount: number;
  totalCount: number;
  onSubmit: (choice: VoteChoice) => void;
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

export function AnswerVotePanel({
  question,
  isSnake,
  snakeAnswer,
  phaseEndsAt,
  hasSubmitted,
  submittedChoice,
  votedCount,
  totalCount,
  onSubmit,
}: AnswerVotePanelProps) {
  const locked = hasSubmitted;

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-widest">Secret vote</p>
          <p className="text-xs text-white/60 mt-0.5">
            {isSnake
              ? 'Play your Snake token face-down'
              : 'Choose A, B, or C — then wait for reveal'}
          </p>
        </div>
        <Timer endsAt={phaseEndsAt} label="Vote" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-elevated rounded-2xl p-4 flex-shrink-0"
      >
        <p className="text-sm font-semibold text-white leading-relaxed text-center">
          {question.text}
        </p>
      </motion.div>

      {isSnake ? (
        <motion.button
          type="button"
          whileTap={!locked ? { scale: 0.97 } : undefined}
          disabled={locked}
          onClick={() => !locked && onSubmit('snake')}
          className={clsx(
            'w-full flex items-center justify-center gap-3 p-5 rounded-2xl border-2 transition-all',
            locked ? 'cursor-default' : 'cursor-pointer',
            submittedChoice === 'snake'
              ? 'border-red-400/70 bg-red-500/25'
              : locked
                ? 'border-white/10 opacity-50'
                : 'border-red-500/40 bg-red-500/10 hover:bg-red-500/20'
          )}
        >
          <span className="text-3xl">🐍</span>
          <div className="text-left">
            <p className="text-base font-black text-red-200">Snake</p>
            <p className="text-xs text-red-300/70">Your only legal vote</p>
          </div>
          {submittedChoice === 'snake' && (
            <span className="text-lg text-red-300 ml-auto">✓</span>
          )}
        </motion.button>
      ) : (
        <div className="flex flex-col gap-3 flex-1">
          {question.options.map((option, i) => {
            const idx = i as AnswerIndex;
            const colors = OPTION_COLORS[i]!;
            const isSelected = submittedChoice === idx;

            return (
              <motion.button
                key={i}
                type="button"
                whileTap={!locked ? { scale: 0.97 } : undefined}
                disabled={locked}
                onClick={() => !locked && onSubmit(idx)}
                className={clsx(
                  'w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all',
                  locked ? 'cursor-default' : 'cursor-pointer',
                  isSelected ? colors.selected : colors.idle,
                  locked && !isSelected && 'opacity-50'
                )}
              >
                <div
                  className={clsx(
                    'w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black',
                    isSelected ? colors.label : 'bg-white/8 text-white/60'
                  )}
                >
                  {OPTION_LABELS[i]}
                </div>
                <span className="text-sm font-medium text-white flex-1">{option}</span>
                {isSelected && <span className="text-lg">✓</span>}
              </motion.button>
            );
          })}
        </div>
      )}

      {isSnake && snakeAnswer !== null && !locked && (
        <p className="text-[10px] text-red-300/60 text-center flex-shrink-0">
          Intel: correct answer is {OPTION_LABELS[snakeAnswer]} — mislead the group
        </p>
      )}

      <div className="flex-shrink-0 space-y-1.5">
        <div className="flex justify-between text-[10px] text-white/40">
          <span>{votedCount}/{totalCount} votes locked</span>
          {locked && <span className="text-green-400">Your vote is in ✓</span>}
        </div>
        <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"
            animate={{
              width: totalCount > 0 ? `${(votedCount / totalCount) * 100}%` : '0%',
            }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>
    </div>
  );
}
