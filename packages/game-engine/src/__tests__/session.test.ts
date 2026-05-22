import { describe, it, expect } from 'vitest';
import type { GameState } from '@snakesss/shared-types';
import { DEFAULT_ROOM_SETTINGS } from '@snakesss/shared-types';

// Mirror client resolve logic for regression coverage
function resolvePlayerId(
  state: GameState,
  username: string,
  fallbackSocketId: string | null,
  savedPlayerId?: string | null
): string | null {
  if (savedPlayerId) {
    const byId = state.players.find((p) => p.id === savedPlayerId && !p.isSpectator);
    if (byId) return byId.id;
  }
  const me = state.players.find(
    (p) =>
      p.username.toLowerCase().trim() === username.toLowerCase().trim() &&
      !p.isSpectator
  );
  return me?.id ?? fallbackSocketId;
}

function baseState(players: GameState['players']): GameState {
  return {
    roomId: 'ABC123',
    phase: 'discussion',
    round: 1,
    totalRounds: 6,
    players,
    currentQuestion: null,
    answers: {},
    answersRevealed: [],
    roundScores: {},
    votes: {},
    roundHistory: [],
    chat: [],
    winner: null,
    settings: DEFAULT_ROOM_SETTINGS,
    timeline: [],
    phaseEndsAt: Date.now() + 60000,
    spectators: [],
    isPaused: false,
    createdAt: 0,
    startedAt: 1,
    endedAt: null,
  };
}

describe('refresh player identity', () => {
  it('resolves original player id after refresh (not new socket id)', () => {
    const state = baseState([
      {
        id: 'original-socket-id',
        username: 'Alice',
        avatar: '🦊',
        isBot: false,
        isSpectator: false,
        isRoomManager: true,
        isConnected: true,
        isAlive: true,
        score: 0,
        joinedAt: 0,
        lastSeenAt: 0,
      },
    ]);

    const id = resolvePlayerId(state, 'Alice', 'brand-new-socket-id', 'original-socket-id');
    expect(id).toBe('original-socket-id');
  });
});
