import { describe, it, expect } from 'vitest';
import { tallyVotes, buildRoundVotes } from '../voting';
import type { Vote, Player, AvatarEmoji } from '@snakesss/shared-types';

function makePlayer(id: string): Player {
  return {
    id,
    username: id,
    avatar: '🦊' as AvatarEmoji,
    isBot: false,
    isSpectator: false,
    isRoomManager: false,
    isConnected: true,
    isAlive: true,
    score: 0,
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  };
}

function makeVote(voterId: string, targetId: string): Vote {
  return { voterId, targetId, round: 1, timestamp: Date.now() };
}

describe('tallyVotes', () => {
  it('returns null for empty votes', () => {
    expect(tallyVotes([], [])).toBeNull();
  });

  it('finds the winner correctly', () => {
    const players = ['p1', 'p2', 'p3'].map(makePlayer);
    const votes = [
      makeVote('p1', 'p3'),
      makeVote('p2', 'p3'),
      makeVote('p3', 'p1'),
    ];
    const result = tallyVotes(votes, players);
    expect(result?.targetId).toBe('p3');
    expect(result?.voteCount).toBe(2);
    expect(result?.isTie).toBe(false);
  });

  it('detects a tie', () => {
    const players = ['p1', 'p2', 'p3', 'p4'].map(makePlayer);
    const votes = [
      makeVote('p1', 'p3'),
      makeVote('p2', 'p4'),
    ];
    const result = tallyVotes(votes, players);
    expect(result?.isTie).toBe(true);
  });
});

describe('buildRoundVotes', () => {
  it('builds round votes from vote map', () => {
    const players = ['p1', 'p2', 'p3', 'p4'].map(makePlayer);
    const currentVotes = { p1: 'p3', p2: 'p3', p3: 'p1', p4: 'p2' };
    const roundVotes = buildRoundVotes(1, currentVotes, players);
    expect(roundVotes.round).toBe(1);
    expect(roundVotes.votes.length).toBe(4);
    expect(roundVotes.eliminatedId).toBe('p3');
    expect(roundVotes.result?.voteCount).toBe(2);
  });
});
