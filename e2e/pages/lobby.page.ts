import type { Page } from '@playwright/test';

export class LobbyPage {
  constructor(readonly page: Page) {}

  async expectVisible(): Promise<void> {
    await this.page.getByTestId('lobby-screen').waitFor({ state: 'visible' });
  }

  async switchTab(tab: 'players' | 'bots' | 'settings'): Promise<void> {
    await this.page.getByTestId(`lobby-tab-${tab}`).click();
  }

  async expectQuestionCategoryVisible(): Promise<void> {
    await this.switchTab('settings');
    const card = this.page.getByTestId('lobby-question-category-card');
    await card.waitFor({ state: 'visible' });
    await card.scrollIntoViewIfNeeded();
    await this.page.getByTestId('lobby-question-topic-input').waitFor({ state: 'visible' });
    await this.page.getByTestId('lobby-question-topic-presets').waitFor({ state: 'visible' });
  }

  async setQuestionTopic(topic: string): Promise<void> {
    await this.expectQuestionCategoryVisible();
    await this.page.getByTestId('lobby-question-topic-input').fill(topic);
  }

  async selectQuestionTopicPreset(preset: string): Promise<void> {
    await this.expectQuestionCategoryVisible();
    const slug = preset.replace(/\s+/g, '-').replace(/&/g, 'and');
    await this.page.getByTestId(`lobby-question-topic-preset-${slug}`).click();
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
