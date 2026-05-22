import type { AnswerIndex, GameState, RoundScore } from '@snakesss/shared-types';

/** Derive client-only UI fields from authoritative server state. */
export function syncEphemeralFromGameState(
  state: GameState,
  playerId: string | null
): {
  hasSubmittedAnswer: boolean;
  answerCount: number;
  answerTotal: number;
  quizRevealAnswers: GameState['answersRevealed'];
  quizRevealCorrectIndex: AnswerIndex | null;
  quizRevealScores: RoundScore[];
  showQuizReveal: boolean;
} {
  const alive = state.players.filter((p) => p.isAlive && !p.isSpectator);
  const answerTotal = alive.length;
  const answerCount = Object.keys(state.answers).length;

  if (state.phase === 'question') {
    return {
      hasSubmittedAnswer: !!(playerId && playerId in state.answers),
      answerCount,
      answerTotal,
      quizRevealAnswers: [],
      quizRevealCorrectIndex: null,
      quizRevealScores: [],
      showQuizReveal: false,
    };
  }

  if (
    state.phase === 'answer_reveal' &&
    state.currentQuestion &&
    state.answersRevealed.length > 0
  ) {
    return {
      hasSubmittedAnswer: true,
      answerCount,
      answerTotal,
      quizRevealAnswers: state.answersRevealed,
      quizRevealCorrectIndex: state.currentQuestion.correctIndex,
      quizRevealScores: state.roundScores[state.round] ?? [],
      showQuizReveal: true,
    };
  }

  return {
    hasSubmittedAnswer: false,
    answerCount,
    answerTotal,
    quizRevealAnswers: [],
    quizRevealCorrectIndex: null,
    quizRevealScores: [],
    showQuizReveal: false,
  };
}
