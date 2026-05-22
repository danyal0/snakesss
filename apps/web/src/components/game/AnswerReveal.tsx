import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { PlayerAnswer, AnswerIndex, RoundScore, QuizQuestion } from '@snakesss/shared-types';

interface AnswerRevealProps {
  question: Omit<QuizQuestion, 'correctIndex'> | null;
  answers: PlayerAnswer[];
  correctIndex: AnswerIndex | null;
  scores: RoundScore[];
  myPlayerId: string | null;
}

const OPTION_LABELS = ['A', 'B', 'C'] as const;

export function AnswerReveal({
  question,
  answers,
  correctIndex,
  scores,
  myPlayerId,
}: AnswerRevealProps) {
  const [revealStep, setRevealStep] = useState(0);

  useEffect(() => {
    setRevealStep(0);
    const timers = [
      setTimeout(() => setRevealStep(1), 400),   // show correct answer
      setTimeout(() => setRevealStep(2), 1200),   // reveal each player
      setTimeout(() => setRevealStep(3), 2200),   // show scores
    ];
    return () => timers.forEach(clearTimeout);
  }, [answers.length]);

  if (!question || correctIndex === null) return null;

  const myAnswer = answers.find((a) => a.playerId === myPlayerId);
  const iGotItRight = myAnswer?.isCorrect ?? false;

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto scrollbar-none">
      {/* Question */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass rounded-2xl p-4 flex-shrink-0"
      >
        <p className="text-sm text-white/70 leading-relaxed text-center">{question.text}</p>
      </motion.div>

      {/* Correct answer reveal */}
      <AnimatePresence>
        {revealStep >= 1 && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-elevated rounded-2xl p-4 border border-green-500/30 flex-shrink-0"
          >
            <p className="text-[10px] text-white/40 uppercase tracking-wider text-center mb-2">
              Correct Answer
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/25 border border-green-500/40 flex items-center justify-center font-black text-green-300 text-lg">
                {OPTION_LABELS[correctIndex]}
              </div>
              <p className="text-base font-semibold text-green-300">
                {question.options[correctIndex]}
              </p>
            </div>

            {myAnswer && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={clsx(
                  'mt-3 text-center text-sm font-semibold',
                  iGotItRight ? 'text-green-400' : 'text-red-400'
                )}
              >
                {iGotItRight ? '✓ You got it right!' : `✗ You answered ${OPTION_LABELS[myAnswer.answerIndex]}`}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Player answers */}
      <AnimatePresence>
        {revealStep >= 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 space-y-2"
          >
            <p className="text-[10px] text-white/30 uppercase tracking-wider px-1 mb-2">
              Everyone's answers
            </p>
            {answers.map((answer, i) => {
              const isCorrect = answer.isCorrect;
              const isSnake = answer.role === 'snake';

              return (
                <motion.div
                  key={answer.playerId}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-2xl',
                    isSnake
                      ? 'bg-red-500/10 border border-red-500/20'
                      : isCorrect
                      ? 'bg-green-500/10 border border-green-500/20'
                      : 'glass border border-white/8'
                  )}
                >
                  <span className="text-xl flex-shrink-0">{answer.playerAvatar}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-white">
                        {answer.playerName}
                      </span>
                      {answer.playerId === myPlayerId && (
                        <span className="text-[9px] text-white/40">(you)</span>
                      )}
                      {isSnake && (
                        <span className="text-[10px] bg-red-500/20 text-red-300 rounded-full px-1.5 font-bold">
                          🐍 SNAKE
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div
                      className={clsx(
                        'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm',
                        isSnake
                          ? 'bg-red-500/20 text-red-300'
                          : isCorrect
                          ? 'bg-green-500/25 text-green-300'
                          : 'bg-orange-500/20 text-orange-300'
                      )}
                    >
                      {OPTION_LABELS[answer.answerIndex]}
                    </div>
                    <span className="text-base">
                      {isSnake ? '🐍' : isCorrect ? '✓' : '✗'}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Round scores */}
      <AnimatePresence>
        {revealStep >= 3 && scores.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-4 flex-shrink-0"
          >
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3">
              Round Scores
            </p>
            <div className="space-y-2">
              {scores
                .sort((a, b) => b.pointsEarned - a.pointsEarned)
                .map((score) => {
                  const player = answers.find((a) => a.playerId === score.playerId);
                  return (
                    <div key={score.playerId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{player?.playerAvatar ?? '?'}</span>
                        <span className="text-xs text-white/70">{player?.playerName ?? score.playerId}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {score.pointsEarned > 0 && (
                          <span className="text-[10px] text-green-400 font-bold">
                            +{score.pointsEarned}
                          </span>
                        )}
                        <span className="text-xs font-bold text-white/80">
                          {score.totalScore} pts
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
