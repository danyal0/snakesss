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
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  };
}

const settings: RoomSettings = {
  ...DEFAULT_ROOM_SETTINGS,
  roleDistribution: { snakes: 2, villagers: 5, seers: 0 },
};

describe('buildRolePool', () => {
  it('returns correct count for 7 players with 2 snakes', () => {
    const pool = buildRolePool(settings, 7);
    expect(pool.length).toBe(7);
    expect(pool.filter((r) => r === 'snake').length).toBe(2);
    expect(pool.filter((r) => r === 'villager').length).toBe(5);
  });

  it('clamps snakes when more snakes than players', () => {
    const s: RoomSettings = {
      ...settings,
      roleDistribution: { snakes: 10, villagers: 1, seers: 0 },
    };
    const pool = buildRolePool(s, 4);
    expect(pool.length).toBe(4);
    expect(pool.filter((r) => r === 'snake').length).toBeGreaterThanOrEqual(1);
    expect(pool.filter((r) => r === 'villager').length).toBeGreaterThanOrEqual(1);
  });

  it('includes seers when advancedRoles enabled', () => {
    const s: RoomSettings = {
      ...settings,
      advancedRoles: true,
      roleDistribution: { snakes: 2, villagers: 4, seers: 1 },
    };
    const pool = buildRolePool(s, 7);
    expect(pool.filter((r) => r === 'seer').length).toBe(1);
  });
});

describe('assignRoles', () => {
  it('assigns unique roles to each player', () => {
    const players = [
      makePlayer('p1'), makePlayer('p2'), makePlayer('p3'),
      makePlayer('p4'), makePlayer('p5'), makePlayer('p6'), makePlayer('p7'),
    ];
    const roles = assignRoles(players, settings);
    expect(roles.size).toBe(7);
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
      roleDistribution: { snakes: 1, villagers: 2, seers: 0 },
    });
    expect(roles.has('spec')).toBe(false);
    expect(roles.size).toBe(3);
  });
});

describe('checkWinCondition', () => {
  it('returns villagers when all snakes eliminated', () => {
    const players = [makePlayer('v1'), makePlayer('v2'), makePlayer('v3')];
    const roles = new Map([
      ['v1', { type: 'villager' as const, revealed: false }],
      ['v2', { type: 'villager' as const, revealed: false }],
      ['v3', { type: 'villager' as const, revealed: false }],
    ]);
    expect(checkWinCondition(players, roles)).toBe('villagers');
  });

  it('returns snakes when snakes >= villagers', () => {
    const players = [makePlayer('s1'), makePlayer('v1')];
    const roles = new Map([
      ['s1', { type: 'snake' as const, revealed: false }],
      ['v1', { type: 'villager' as const, revealed: false }],
    ]);
    expect(checkWinCondition(players, roles)).toBe('snakes');
  });

  it('returns null when game continues', () => {
    const players = [makePlayer('s1'), makePlayer('v1'), makePlayer('v2')];
    const roles = new Map([
      ['s1', { type: 'snake' as const, revealed: false }],
      ['v1', { type: 'villager' as const, revealed: false }],
      ['v2', { type: 'villager' as const, revealed: false }],
    ]);
    expect(checkWinCondition(players, roles)).toBe(null);
  });
});
