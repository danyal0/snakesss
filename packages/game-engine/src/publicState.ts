import type { GamePhase, GameState, PlayerAnswer } from '@snakesss/shared-types';

const TIMED_PHASES: GamePhase[] = [
  'dealing',
  'question',
  'answer_reveal',
  'discussion',
  'voting',
  'vote_reveal',
  'elimination',
  'scores',
];

export function stripAnswerRoles(answers: PlayerAnswer[]): PlayerAnswer[] {
  return answers.map(({ role: _role, ...rest }) => rest);
}

export function buildVoteTally(votes: Record<string, string>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const targetId of Object.values(votes)) {
    counts[targetId] = (counts[targetId] ?? 0) + 1;
  }
  return counts;
}

export function sanitizePublicState(
  state: GameState,
  answeredPlayerIds?: string[]
): GameState {
  const hideAnswers = state.phase === 'question';
  const hideVotes =
    state.phase === 'voting' ||
    state.phase === 'discussion' ||
    state.phase === 'question' ||
    state.phase === 'answer_reveal';

  return {
    ...state,
    answers: hideAnswers ? {} : state.answers,
    answeredPlayerIds: hideAnswers ? answeredPlayerIds : undefined,
    answersRevealed: stripAnswerRoles(state.answersRevealed),
    votes: hideVotes ? {} : state.votes,
  };
}

export function isTimedPhase(phase: GamePhase): boolean {
  return TIMED_PHASES.includes(phase);
}
