import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { PlayerAnswer, AnswerIndex, RoundScore, QuizQuestion } from '@snakesss/shared-types';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { triggerHaptic } from '../../utils/haptics';

interface AnswerRevealProps {
  question: Omit<QuizQuestion, 'correctIndex'> | null;
  answers: PlayerAnswer[];
  correctIndex: AnswerIndex | null;
  scores: RoundScore[];
  myPlayerId: string | null;
}

const OPTION_LABELS = ['A', 'B', 'C'] as const;
const REVEAL_HIGHLIGHT_MS = 1500;

export function AnswerReveal({
  question,
  answers,
  correctIndex,
  scores,
  myPlayerId,
}: AnswerRevealProps) {
  const reducedMotion = useReducedMotion();
  const [revealStep, setRevealStep] = useState(0);
  const [highlightCorrect, setHighlightCorrect] = useState(false);

  useEffect(() => {
    setRevealStep(0);
    setHighlightCorrect(false);
    const timers = [
      setTimeout(() => {
        setRevealStep(1);
        setHighlightCorrect(true);
        triggerHaptic('reveal');
      }, reducedMotion ? 0 : 400),
      setTimeout(() => setRevealStep(2), reducedMotion ? 200 : 1200),
      setTimeout(() => setRevealStep(3), reducedMotion ? 400 : 2200),
    ];
    const highlightOff = setTimeout(
      () => setHighlightCorrect(false),
      reducedMotion ? 800 : REVEAL_HIGHLIGHT_MS + 400
    );
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(highlightOff);
    };
  }, [answers, correctIndex, reducedMotion]);

  if (!question) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 gap-3 text-center">
        <div className="text-4xl animate-pulse">⏳</div>
        <p className="text-sm text-white/50">Loading results…</p>
      </div>
    );
  }

  if (correctIndex === null) {
    return (
      <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto scrollbar-none">
        <div className="glass rounded-2xl p-4 flex-shrink-0">
          <p className="text-sm text-white/70 leading-relaxed text-center">{question.text}</p>
        </div>
        {answers.length > 0 && (
          <p className="text-xs text-white/40 text-center">Revealing answers…</p>
        )}
      </div>
    );
  }

  const myAnswer = answers.find((a) => a.playerId === myPlayerId);
  const iGotItRight = myAnswer?.isCorrect ?? false;

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto scrollbar-none" data-testid="answer-reveal">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass rounded-2xl p-4 flex-shrink-0"
      >
        <p className="text-sm text-white/70 leading-relaxed text-center">{question.text}</p>
      </motion.div>

      <AnimatePresence>
        {revealStep >= 1 && (
          <motion.div
            initial={reducedMotion ? { opacity: 1 } : { scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            className={clsx(
              'rounded-2xl p-4 flex-shrink-0 reveal-correct-card',
              highlightCorrect && 'reveal-correct-active'
            )}
            data-testid="reveal-correct-answer"
          >
            <p className="text-[10px] text-white/40 uppercase tracking-wider text-center mb-2">
              Correct Answer
            </p>
            <div className="flex items-center justify-center gap-3">
              <div
                className={clsx(
                  'w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg reveal-correct-letter',
                  highlightCorrect ? 'text-emerald-200' : 'text-green-300'
                )}
              >
                {OPTION_LABELS[correctIndex]}
              </div>
              <p className="text-base font-semibold text-emerald-200/95">
                {question.options[correctIndex]}
              </p>
            </div>

            {myAnswer && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reducedMotion ? 0 : 0.3 }}
                className={clsx(
                  'mt-3 text-center text-sm font-semibold',
                  iGotItRight ? 'text-green-400' : 'text-red-400/90'
                )}
              >
                {iGotItRight ? '✓ You got it right!' : `✗ You answered ${OPTION_LABELS[myAnswer.answerIndex]}`}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
              const isCorrect = answer.isCorrect && !answer.isSnakeVote;
              const isCorrectPlayer = isCorrect;
              const dimOthers = highlightCorrect && !answer.isSnakeVote;

              return (
                <motion.div
                  key={answer.playerId}
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: -16 }}
                  animate={{
                    opacity: dimOthers && !isCorrectPlayer ? 0.55 : 1,
                    x: 0,
                    scale: isCorrectPlayer && highlightCorrect && !reducedMotion ? 1.015 : 1,
                  }}
                  transition={{ delay: reducedMotion ? 0 : i * 0.08 }}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-2xl transition-all duration-500',
                    answer.isSnakeVote
                      ? 'bg-red-500/10 border border-red-500/20'
                      : isCorrectPlayer
                        ? clsx(
                            'border border-emerald-400/25',
                            highlightCorrect ? 'reveal-player-correct' : 'bg-green-500/10 border-green-500/20'
                          )
                        : clsx('glass border border-white/8', dimOthers && 'reveal-option-dim')
                  )}
                  data-testid={isCorrectPlayer ? `reveal-player-correct-${answer.playerId}` : undefined}
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
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div
                      className={clsx(
                        'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm',
                        answer.isSnakeVote
                          ? 'bg-red-500/25 text-red-300'
                          : isCorrect
                            ? 'bg-emerald-500/25 text-emerald-200'
                            : 'bg-orange-500/20 text-orange-300'
                      )}
                    >
                      {answer.isSnakeVote ? '🐍' : OPTION_LABELS[answer.answerIndex]}
                    </div>
                    {!answer.isSnakeVote && (
                      <span className="text-base">{isCorrect ? '✓' : '✗'}</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

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
