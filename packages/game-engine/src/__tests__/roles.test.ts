import { describe, it, expect } from 'vitest';
import { buildRolePool, assignRoles, checkWinCondition } from '../roles';
import type { Player, RoomSettings, AvatarEmoji } from '@snakesss/shared-types';
import { DEFAULT_ROOM_SETTINGS } from '@snakesss/shared-types';

function makePlayer(id: string, isAlive = true): Player {
  return {
    id,
    username: id,
    avatar: '🦊' as AvatarEmoji,
    isBot: false,
    isSpectator: false,
    isRoomManager: false,
    isConnected: true,
    isAlive,
    score: 0,
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  };
}

const settings: RoomSettings = {
  ...DEFAULT_ROOM_SETTINGS,
  roleDistribution: { snakes: 2, humans: 5, mongooses: 0 },
};

describe('buildRolePool', () => {
  it('returns correct count for 7 players per Big Potato table', () => {
    const pool = buildRolePool(settings, 7);
    expect(pool.length).toBe(7);
    // Big Potato 7-player: 3 snakes, 3 humans, 1 mongoose
    expect(pool.filter((r) => r === 'snake').length).toBe(3);
    expect(pool.filter((r) => r === 'mongoose').length).toBe(1);
    expect(pool.filter((r) => r === 'human').length).toBe(3);
  });

  it('returns correct distribution for 4 players (Big Potato default)', () => {
    // 4-player: 2 snakes, 1 human, 1 mongoose
    const pool = buildRolePool(settings, 4);
    expect(pool.length).toBe(4);
    expect(pool.filter((r) => r === 'snake').length).toBe(2);
    expect(pool.filter((r) => r === 'human').length).toBe(1);
    expect(pool.filter((r) => r === 'mongoose').length).toBe(1);
  });

  it('includes mongoose when advancedRoles enabled', () => {
    const s: RoomSettings = { ...settings, advancedRoles: true };
    const pool = buildRolePool(s, 7);
    expect(pool.filter((r) => r === 'mongoose').length).toBe(1);
  });
});

describe('assignRoles', () => {
  it('assigns unique roles to each player per Big Potato table', () => {
    const players = [
      makePlayer('p1'), makePlayer('p2'), makePlayer('p3'),
      makePlayer('p4'), makePlayer('p5'), makePlayer('p6'), makePlayer('p7'),
    ];
    const roles = assignRoles(players, settings);
    expect(roles.size).toBe(7);
    // Big Potato 7-player: 3 snakes
    const snakes = Array.from(roles.values()).filter((r) => r.type === 'snake');
    expect(snakes.length).toBe(3);
  });

  it('skips spectators in role assignment', () => {
    const players = [
      makePlayer('p1'), makePlayer('p2'), makePlayer('p3'),
      { ...makePlayer('spec'), isSpectator: true },
    ];
    const roles = assignRoles(players, {
      ...settings,
      roleDistribution: { snakes: 1, humans: 2, mongooses: 0 },
    });
    expect(roles.has('spec')).toBe(false);
    expect(roles.size).toBe(3);
  });
});

describe('checkWinCondition', () => {
  it('returns humans when all snakes eliminated', () => {
    const players = [makePlayer('v1'), makePlayer('v2'), makePlayer('v3')];
    const roles = new Map([
      ['v1', { type: 'human' as const, revealed: false }],
      ['v2', { type: 'human' as const, revealed: false }],
      ['v3', { type: 'human' as const, revealed: false }],
    ]);
    expect(checkWinCondition(players, roles, 6, 1)).toBe('humans');
  });

  it('returns snakes when snakes >= villagers', () => {
    const players = [makePlayer('s1'), makePlayer('v1')];
    const roles = new Map([
      ['s1', { type: 'snake' as const, revealed: false }],
      ['v1', { type: 'human' as const, revealed: false }],
    ]);
    expect(checkWinCondition(players, roles, 6, 1)).toBe('snakes');
  });

  it('returns null when game continues', () => {
    const players = [makePlayer('s1'), makePlayer('v1'), makePlayer('v2')];
    const roles = new Map([
      ['s1', { type: 'snake' as const, revealed: false }],
      ['v1', { type: 'human' as const, revealed: false }],
      ['v2', { type: 'human' as const, revealed: false }],
    ]);
    expect(checkWinCondition(players, roles, 6, 1)).toBe(null);
  });
});
