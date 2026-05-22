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
  const mongooses = advancedRoles ? Math.min(1, roleDistribution.mongooses) : 0;
  let humans = playerCount - snakes - mongooses;

  if (humans < 1) {
    snakes = Math.max(1, Math.floor(playerCount / 3));
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
  const alive = players.filter((p) => p.isAlive && !p.isSpectator);
  const aliveSnakes = alive.filter((p) => roles.get(p.id)?.type === 'snake');
  const aliveHumans = alive.filter((p) => roles.get(p.id)?.type !== 'snake');

  if (aliveSnakes.length === 0) return 'humans';
  if (aliveSnakes.length >= aliveHumans.length) return 'snakes';

  // After all rounds with no more eliminations, compare scores
  if (currentRound > totalRounds) {
    const snakeScore = players
      .filter((p) => roles.get(p.id)?.type === 'snake')
      .reduce((s, p) => s + p.score, 0);
    const humanScore = players
      .filter((p) => roles.get(p.id)?.type !== 'snake')
      .reduce((s, p) => s + p.score, 0);
    return snakeScore >= humanScore ? 'snakes' : 'humans';
  }

  return null;
}

export function revealRole(role: Role): Role {
  return { ...role, revealed: true };
}

export function calculateRoundScores(
  answers: Map<string, number>,
  correctIndex: number,
  roles: Map<string, Role>,
  players: Player[]
): Map<string, number> {
  const scoreDeltas = new Map<string, number>();

  const activePlayers = players.filter((p) => !p.isSpectator && p.isAlive);

  // Count correct answers among humans/mongooses
  const correctHumans = activePlayers.filter((p) => {
    const role = roles.get(p.id);
    if (!role || role.type === 'snake') return false;
    return answers.get(p.id) === correctIndex;
  });

  const incorrectCount = activePlayers.filter((p) => {
    const role = roles.get(p.id);
    if (!role || role.type === 'snake') return false;
    return answers.get(p.id) !== correctIndex;
  }).length;

  activePlayers.forEach((player) => {
    const role = roles.get(player.id);
    if (!role) { scoreDeltas.set(player.id, 0); return; }

    if (role.type === 'snake') {
      // Snake scores 1 point per human who got it wrong
      scoreDeltas.set(player.id, incorrectCount);
    } else {
      // Human/mongoose scores 1 per correct answer if they got it right
      const theyGotItRight = answers.get(player.id) === correctIndex;
      scoreDeltas.set(player.id, theyGotItRight ? correctHumans.length : 0);
    }
  });

  return scoreDeltas;
}
