import { describe, it, expect } from 'vitest';
import { buildRolePool, assignRoles, checkWinCondition, getHighestScorers } from '../roles';
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
  it('uses manager-configured snake count', () => {
    const pool = buildRolePool(
      { ...settings, roleDistribution: { snakes: 1, humans: 2, mongooses: 0 }, advancedRoles: false },
      4
    );
    expect(pool.length).toBe(4);
    expect(pool.filter((r) => r === 'snake').length).toBe(1);
    expect(pool.filter((r) => r === 'human').length).toBe(3);
  });

  it('returns correct count for 7 players with manager snake setting', () => {
    const pool = buildRolePool(settings, 7);
    expect(pool.length).toBe(7);
    expect(pool.filter((r) => r === 'snake').length).toBe(2);
    expect(pool.filter((r) => r === 'mongoose').length).toBe(1);
    expect(pool.filter((r) => r === 'human').length).toBe(4);
  });

  it('returns correct distribution for 4 players with default settings', () => {
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
    expect(snakes.length).toBe(2);
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

  it('returns snakes when snakes >= villagers mid-game', () => {
    const players = [makePlayer('s1'), makePlayer('v1')];
    const roles = new Map([
      ['s1', { type: 'snake' as const, revealed: false }],
      ['v1', { type: 'human' as const, revealed: false }],
    ]);
    expect(checkWinCondition(players, roles, 6, 1)).toBe('snakes');
  });

  it('returns null on the final round (individual score decides)', () => {
    const players = [
      { ...makePlayer('s1'), score: 2 },
      { ...makePlayer('s2'), score: 2 },
      { ...makePlayer('h1'), score: 9 },
      { ...makePlayer('h2'), score: 9 },
    ];
    const roles = new Map([
      ['s1', { type: 'snake' as const, revealed: false }],
      ['s2', { type: 'snake' as const, revealed: false }],
      ['h1', { type: 'human' as const, revealed: false }],
      ['h2', { type: 'human' as const, revealed: false }],
    ]);
    expect(checkWinCondition(players, roles, 6, 6)).toBe(null);
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

describe('getHighestScorers', () => {
  it('returns the player with the highest score', () => {
    const players = [
      { ...makePlayer('p1'), score: 4 },
      { ...makePlayer('p2'), score: 9 },
      { ...makePlayer('p3'), score: 2 },
    ];
    expect(getHighestScorers(players)).toEqual(['p2']);
  });

  it('returns all players tied for first', () => {
    const players = [
      { ...makePlayer('p1'), score: 9 },
      { ...makePlayer('p2'), score: 9 },
      { ...makePlayer('p3'), score: 2 },
    ];
    expect(getHighestScorers(players).sort()).toEqual(['p1', 'p2']);
  });

  it('ignores spectators', () => {
    const players = [
      { ...makePlayer('p1'), score: 5 },
      { ...makePlayer('spec'), score: 99, isSpectator: true },
    ];
    expect(getHighestScorers(players)).toEqual(['p1']);
  });
});
