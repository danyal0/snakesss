import type { GamePhase } from '@snakesss/shared-types';

export type GamePanel = 'players' | 'chat' | 'vote';

export const GAME_PANELS: readonly GamePanel[] = ['players', 'chat', 'vote'];

/** Default bottom tab when entering a phase (before user swipes/clicks another tab). */
export function defaultPanelForPhase(phase: GamePhase): GamePanel {
  switch (phase) {
    case 'discussion':
      return 'chat';
    case 'voting':
      return 'vote';
    case 'question':
    case 'answer_reveal':
    case 'scores':
    case 'elimination':
    case 'vote_reveal':
      return 'players';
    default:
      return 'players';
  }
}
