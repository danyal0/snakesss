import type { GamePhase } from '@snakesss/shared-types';

export type GamePanel = 'question' | 'chat' | 'vote';

export const GAME_PANELS: readonly GamePanel[] = ['question', 'chat', 'vote'];

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
      return 'question';
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
    case 'vote':
      return '🗳️ Vote';
  }
}
