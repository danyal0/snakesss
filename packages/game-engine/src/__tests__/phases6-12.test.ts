import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import { sanitizeSpectatorState } from '../publicState';
import { resolveTie } from '../voting';
import type { AvatarEmoji, Player, Vote } from '@snakesss/shared-types';
import { DEFAULT_ROOM_SETTINGS } from '@snakesss/shared-types';

const AVATAR = '🦊' as AvatarEmoji;

function makeEngine() {
  return new GameEngine({
    managerId: 'mgr',
    managerName: 'Host',
    managerAvatar: AVATAR,
    settings: { ...DEFAULT_ROOM_SETTINGS, discussionTimer: 5, voteTimer: 5, questionTimer: 5 },
  });
}

describe('Phase 6 — chat', () => {
  it('rate-limits rapid chat messages', () => {
    const engine = makeEngine();
    engine.addPlayer('p2', 'Bob', '🐺', false);
    engine.startGame();
    // Force discussion
    engine.forcePhase('discussion');

    const first = engine.addMessage('p2', 'hello', 'chat');
    expect(first).not.toBeNull();
    const spam = engine.addMessage('p2', 'spam', 'chat');
    expect(spam).toBeNull();
  });
});

describe('Phase 7 — spectator state', () => {
  it('hides round vote details from spectators during voting', () => {
    const state = makeEngine().getState();
    const spec = sanitizeSpectatorState({
      ...state,
      phase: 'voting',
      votes: { a: 'b' },
      roundHistory: [
        {
          round: 1,
          votes: [{ voterId: 'a', targetId: 'b', round: 1, timestamp: 1 }],
          result: { targetId: 'b', targetName: 'b', voteCount: 1, voters: ['a'], isTie: false },
          eliminatedId: 'b',
        },
      ],
    });
    expect(spec.votes).toEqual({});
    expect(spec.roundHistory[0]?.votes).toEqual([]);
  });
});

describe('Phase 11 — voting security', () => {
  it('rejects duplicate votes from same player', () => {
    const engine = makeEngine();
    engine.addPlayer('p2', 'Bob', '🐺', false);
    engine.addPlayer('p3', 'Cara', '🦁', false);
    engine.startGame();
    engine.forcePhase('voting');

    const v1 = engine.castVote('p2', 'p3');
    expect(v1.success).toBe(true);
    const v2 = engine.castVote('p2', 'p2');
    expect(v2.success).toBe(false);
  });

  it('resolves ties deterministically by player id', () => {
    const players: Player[] = [
      { id: 'zara', username: 'Z', avatar: AVATAR, isBot: false, isSpectator: false, isRoomManager: false, isConnected: true, isAlive: true, score: 0, joinedAt: 0, lastSeenAt: 0 },
      { id: 'amy', username: 'A', avatar: AVATAR, isBot: false, isSpectator: false, isRoomManager: false, isConnected: true, isAlive: true, score: 0, joinedAt: 0, lastSeenAt: 0 },
    ];
    const votes: Vote[] = [
      { voterId: 'v1', targetId: 'zara', round: 1, timestamp: 1 },
      { voterId: 'v2', targetId: 'amy', round: 1, timestamp: 2 },
    ];
    const r1 = resolveTie(votes, players);
    const r2 = resolveTie(votes, players);
    expect(r1?.targetId).toBe('amy');
    expect(r2?.targetId).toBe('amy');
  });
});

describe('Phase 12 — soak', () => {
  it('runs 25 vote rounds without throwing', () => {
    const engine = makeEngine();
    for (let i = 0; i < 3; i++) {
      engine.addPlayer(`p${i}`, `P${i}`, AVATAR, false);
    }
    engine.startGame();
    for (let r = 0; r < 25; r++) {
      engine.forcePhase('voting');
      engine.castVote('p0', 'p1');
      engine.castVote('p1', 'p2');
      engine.castVote('p2', 'p0');
      engine.resolveVotes();
    }
    expect(engine.getState().roundHistory.length).toBeGreaterThan(0);
  });
});
