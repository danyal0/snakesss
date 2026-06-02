import type { Page } from '@playwright/test';

export class LobbyPage {
  constructor(readonly page: Page) {}

  async expectVisible(): Promise<void> {
    await this.page.getByTestId('lobby-screen').waitFor({ state: 'visible' });
  }

  async switchTab(tab: 'players' | 'bots' | 'settings'): Promise<void> {
    await this.page.getByTestId(`lobby-tab-${tab}`).click();
  }

  async addBot(persona: 'aggressive' | 'silent_strategist' | 'chaotic_liar' = 'chaotic_liar'): Promise<void> {
    await this.switchTab('bots');
    await this.page.getByRole('button', { name: new RegExp(persona === 'aggressive' ? 'Aggressive' : persona === 'silent_strategist' ? 'Strategist' : 'Chaotic') }).click();
  }

  async startGame(): Promise<void> {
    await this.page.getByTestId('btn-start-game').click();
    await this.page.getByTestId('game-screen').waitFor({ timeout: 30_000 });
  }

  async gotoRoom(roomId: string): Promise<void> {
    await this.page.goto(`/room/${roomId}`);
    await this.expectVisible();
  }
}
