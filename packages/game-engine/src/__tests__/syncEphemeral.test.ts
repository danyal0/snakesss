/**
 * Regression tests for client ephemeral UI sync logic.
 * Mirrors apps/web/src/store/syncEphemeralState.ts — keep in sync when editing that file.
 */
import { describe, it, expect } from 'vitest';
import type { GameState } from '@snakesss/shared-types';
import { DEFAULT_ROOM_SETTINGS } from '@snakesss/shared-types';

function syncEphemeralFromGameState(
  state: GameState,
  playerId: string | null
): { hasSubmittedAnswer: boolean; quizRevealCorrectIndex: number | null } {
  if (state.phase === 'question') {
    return {
      hasSubmittedAnswer: !!(playerId && playerId in state.answers),
      quizRevealCorrectIndex: null,
    };
  }
  if (
    state.phase === 'answer_reveal' &&
    state.currentQuestion &&
    state.answersRevealed.length > 0
  ) {
    return {
      hasSubmittedAnswer: true,
      quizRevealCorrectIndex: state.currentQuestion.correctIndex,
    };
  }
  return { hasSubmittedAnswer: false, quizRevealCorrectIndex: null };
}

function baseState(overrides: Partial<GameState>): GameState {
  return {
    roomId: 'TEST',
    phase: 'lobby',
    round: 1,
    totalRounds: 6,
    players: [],
    currentQuestion: null,
    answers: {},
    answersRevealed: [],
    roundScores: {},
    votes: {},
    roundHistory: [],
    chat: [],
    winner: null,
    winnerPlayerIds: null,
    settings: DEFAULT_ROOM_SETTINGS,
    timeline: [],
    phaseEndsAt: null,
    spectators: [],
    isPaused: false,
    createdAt: 0,
    startedAt: null,
    endedAt: null,
    ...overrides,
  };
}

describe('syncEphemeralFromGameState (client UI)', () => {
  it('resets hasSubmittedAnswer on a new question round for humans', () => {
    const state = baseState({
      phase: 'question',
      answers: {},
      currentQuestion: {
        id: 'q2',
        text: 'Round 2?',
        options: ['A', 'B', 'C'],
        correctIndex: 1,
      },
    });
    expect(syncEphemeralFromGameState(state, 'human1').hasSubmittedAnswer).toBe(false);
  });

  it('sets hasSubmittedAnswer when player already answered', () => {
    const state = baseState({
      phase: 'question',
      answers: { human1: 2 },
      currentQuestion: {
        id: 'q1',
        text: 'Test?',
        options: ['A', 'B', 'C'],
        correctIndex: 0,
      },
    });
    expect(syncEphemeralFromGameState(state, 'human1').hasSubmittedAnswer).toBe(true);
  });

  it('exposes correct index during answer_reveal', () => {
    const state = baseState({
      phase: 'answer_reveal',
      currentQuestion: {
        id: 'q1',
        text: 'Test?',
        options: ['A', 'B', 'C'],
        correctIndex: 2,
      },
      answersRevealed: [
        {
          playerId: 'human1',
          playerName: 'Human',
          playerAvatar: '🦊',
          answerIndex: 2,
          isCorrect: true,
          role: 'human',
        },
      ],
    });
    expect(syncEphemeralFromGameState(state, 'human1').quizRevealCorrectIndex).toBe(2);
  });
});
