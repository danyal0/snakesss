import type { GamePhase } from '@snakesss/shared-types';

export type GamePanel = 'question' | 'chat';

export const GAME_PANELS: readonly GamePanel[] = ['question', 'chat'];

/** Default bottom tab when entering a phase (before user swipes/clicks another tab). */
export function defaultPanelForPhase(phase: GamePhase): GamePanel {
  switch (phase) {
    case 'discussion':
      return 'chat';
    default:
      return 'question';
  }
}

export function gamePanelLabel(panel: GamePanel): string {
  switch (panel) {
    case 'question':
      return '❓ Question';
    case 'chat':
      return '💬 Chat';
  }
}
