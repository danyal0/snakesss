import {
  RoleType,
  Role,
  RoleDistribution,
  Player,
  RoomSettings,
  VoteChoice,
  getOptimalRoleDistribution,
} from '@snakesss/shared-types';
import { shuffleArray } from './utils';

export function buildRolePool(settings: RoomSettings, playerCount: number): RoleType[] {
  const pool: RoleType[] = [];

  const optimal = getOptimalRoleDistribution(playerCount);
  const mongooses = settings.advancedRoles ? optimal.mongooses : 0;

  // Manager-configured snake count, clamped to a valid pool for this lobby size
  const maxSnakes = Math.max(1, playerCount - mongooses - 1);
  let snakes = Math.min(Math.max(1, settings.roleDistribution.snakes), maxSnakes);
  let humans = playerCount - snakes - mongooses;

  if (humans < 1) {
    snakes = Math.max(1, playerCount - mongooses - 1);
    humans = playerCount - snakes - mongooses;
  }

  for (let i = 0; i < snakes; i++) pool.push('snake');
  for (let i = 0; i < mongooses; i++) pool.push('mongoose');
  for (let i = 0; i < humans; i++) pool.push('human');

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
      type: roles[idx]!,
      revealed: false,
    });
  });

  return assignments;
}

export function checkWinCondition(
  players: Player[],
  roles: Map<string, Role>,
  totalRounds: number,
  currentRound: number
): 'snakes' | 'humans' | null {
  const active = players.filter((p) => !p.isSpectator);
  const alive = active.filter((p) => p.isAlive);
  const aliveSnakes = alive.filter((p) => roles.get(p.id)?.type === 'snake');
  const aliveHumans = alive.filter((p) => roles.get(p.id)?.type !== 'snake');

  if (aliveSnakes.length === 0) return 'humans';

  // Final round uses individual high-score winner, not team parity
  if (currentRound >= totalRounds) return null;

  // Mid-game elimination parity (when elimination voting is active)
  if (aliveSnakes.length >= aliveHumans.length) return 'snakes';

  return null;
}

/** Returns player ids tied for the highest score (non-spectators only). */
export function getHighestScorers(players: Player[]): string[] {
  const active = players.filter((p) => !p.isSpectator);
  if (active.length === 0) return [];

  const maxScore = Math.max(...active.map((p) => p.score));
  return active.filter((p) => p.score === maxScore).map((p) => p.id);
}

export function revealRole(role: Role): Role {
  return { ...role, revealed: true };
}

export function calculateRoundScores(
  answers: Map<string, VoteChoice>,
  correctIndex: number,
  roles: Map<string, Role>,
  players: Player[]
): Map<string, number> {
  const scoreDeltas = new Map<string, number>();

  const activePlayers = players.filter((p) => !p.isSpectator && p.isAlive);

  const correctHumans = activePlayers.filter((p) => {
    const role = roles.get(p.id);
    if (!role || role.type === 'snake') return false;
    const choice = answers.get(p.id);
    return choice !== 'snake' && choice === correctIndex;
  });

  const incorrectCount = activePlayers.filter((p) => {
    const role = roles.get(p.id);
    if (!role || role.type === 'snake') return false;
    const choice = answers.get(p.id);
    if (choice === 'snake' || choice === undefined) return false;
    return choice !== correctIndex;
  }).length;

  activePlayers.forEach((player) => {
    const role = roles.get(player.id);
    if (!role) {
      scoreDeltas.set(player.id, 0);
      return;
    }

    if (role.type === 'snake') {
      scoreDeltas.set(player.id, incorrectCount);
    } else {
      const choice = answers.get(player.id);
      const theyGotItRight = choice !== 'snake' && choice === correctIndex;
      scoreDeltas.set(player.id, theyGotItRight ? correctHumans.length : 0);
    }
  });

  return scoreDeltas;
}
