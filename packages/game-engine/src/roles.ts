import {
  RoleType,
  Role,
  RoleDistribution,
  Player,
  RoomSettings,
} from '@snakesss/shared-types';
import { shuffleArray } from './utils';

export function buildRolePool(settings: RoomSettings, playerCount: number): RoleType[] {
  const { roleDistribution, advancedRoles } = settings;
  const pool: RoleType[] = [];

  let snakes = roleDistribution.snakes;
  let seers = advancedRoles ? roleDistribution.seers : 0;
  let villagers = playerCount - snakes - seers;

  if (villagers < 1) {
    snakes = Math.max(1, Math.floor(playerCount / 3));
    seers = advancedRoles ? 1 : 0;
    villagers = playerCount - snakes - seers;
  }

  for (let i = 0; i < snakes; i++) pool.push('snake');
  for (let i = 0; i < seers; i++) pool.push('seer');
  for (let i = 0; i < villagers; i++) pool.push('villager');

  return shuffleArray(pool);
}

export function assignRoles(
  players: Player[],
  settings: RoomSettings
): Map<string, Role> {
  const activePlayers = players.filter((p) => !p.isSpectator);
  const roles = buildRolePool(settings, activePlayers.length);
  const assignments = new Map<string, Role>();

  activePlayers.forEach((player, idx) => {
    assignments.set(player.id, {
      type: roles[idx],
      revealed: false,
    });
  });

  return assignments;
}

export function checkWinCondition(
  players: Player[],
  roles: Map<string, Role>
): 'snakes' | 'villagers' | null {
  const alive = players.filter((p) => p.isAlive && !p.isSpectator);
  const aliveSnakes = alive.filter((p) => roles.get(p.id)?.type === 'snake');
  const aliveVillagers = alive.filter((p) => roles.get(p.id)?.type !== 'snake');

  if (aliveSnakes.length === 0) return 'villagers';
  if (aliveSnakes.length >= aliveVillagers.length) return 'snakes';
  return null;
}

export function revealRole(role: Role): Role {
  return { ...role, revealed: true };
}
