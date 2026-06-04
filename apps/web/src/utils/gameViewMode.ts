import type { GameState, Player } from '@snakesss/shared-types';

/** Player participates; spectator / guest / eliminated watch without inputs. */
export function isWatchOnlyGameView(
  _gameState: GameState,
  playerId: string | null,
  me: Player | undefined
): boolean {
  if (!playerId || !me) return true;
  if (me.isSpectator) return true;
  if (!me.isAlive) return true;
  return false;
}

export function watchModeLabel(
  me: Player | undefined,
  needsRejoin: boolean
): string {
  if (needsRejoin || !me) return 'Watching';
  if (me.isSpectator) return 'Spectating';
  if (!me.isAlive) return 'Eliminated';
  return 'Watching';
}
