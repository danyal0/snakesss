import { describe, it, expect } from 'vitest';
import { sanitizePublicState, stripAnswerRoles, buildVoteTally } from '../publicState';
import type { GameState } from '@snakesss/shared-types';
import { DEFAULT_ROOM_SETTINGS } from '@snakesss/shared-types';

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: 'TEST',
    phase: 'question',
    round: 1,
    totalRounds: 6,
    players: [],
    currentQuestion: null,
    answers: { p1: 0, p2: 1 },
    answersRevealed: [
      {
        playerId: 'p1',
        playerName: 'A',
        playerAvatar: '🦊',
        answerIndex: 0,
        isCorrect: true,
        role: 'snake',
      },
    ],
    roundScores: {},
    votes: { v1: 'p2', v2: 'p2' },
    roundHistory: [],
    chat: [],
    winner: null,
    settings: DEFAULT_ROOM_SETTINGS,
    timeline: [],
    phaseEndsAt: null,
    spectators: [],
    isPaused: false,
    createdAt: Date.now(),
    startedAt: null,
    endedAt: null,
    ...overrides,
  };
}

describe('publicState', () => {
  it('hides answers and vote map during question phase', () => {
    const pub = sanitizePublicState(baseState(), ['p1', 'p2']);
    expect(pub.answers).toEqual({});
    expect(pub.answeredPlayerIds).toEqual(['p1', 'p2']);
    expect(pub.votes).toEqual({});
  });

  it('strips roles from revealed answers', () => {
    const stripped = stripAnswerRoles(baseState().answersRevealed);
    expect(stripped[0]?.role).toBeUndefined();
  });

  it('builds vote tally without voter ids', () => {
    expect(buildVoteTally({ a: 'x', b: 'x', c: 'y' })).toEqual({ x: 2, y: 1 });
  });
});
