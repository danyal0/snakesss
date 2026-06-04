import type { Page } from '@playwright/test';

export class GamePage {
  constructor(readonly page: Page) {}

  async expectVisible(): Promise<void> {
    await this.page.getByTestId('game-screen').waitFor({ state: 'visible' });
  }

  async switchTab(tab: 'question' | 'chat'): Promise<void> {
    await this.page.getByTestId(`game-tab-${tab}`).click();
  }

  /** Simulates horizontal swipe via touch events (works on desktop + mobile). */
  async swipeToTab(direction: 'left' | 'right'): Promise<void> {
    const swipeArea = this.page.locator('[data-testid="game-screen"] .flex-col.flex-1').first();
    const box = await swipeArea.boundingBox();
    if (!box) {
      await this.switchTab(direction === 'left' ? 'chat' : 'question');
      return;
    }
    const y = box.y + box.height / 2;
    const startX = direction === 'left' ? box.x + box.width * 0.8 : box.x + box.width * 0.2;
    const endX = direction === 'left' ? box.x + box.width * 0.2 : box.x + box.width * 0.8;

    await this.page.evaluate(
      ({ startX, endX, y }) => {
        const el = document.elementFromPoint(startX, y) as HTMLElement | null;
        const target = el?.closest('[class*="flex-col"]') ?? el;
        if (!target) return;
        const makeTouch = (x: number, yPos: number) => ({
          identifier: 0,
          clientX: x,
          clientY: yPos,
          pageX: x,
          pageY: yPos,
          screenX: x,
          screenY: yPos,
          radiusX: 1,
          radiusY: 1,
          rotationAngle: 0,
          force: 1,
        });
        const touchInit = { bubbles: true, cancelable: true, touches: [makeTouch(startX, y)] as unknown as Touch[] };
        target.dispatchEvent(new TouchEvent('touchstart', touchInit));
        target.dispatchEvent(
          new TouchEvent('touchmove', {
            ...touchInit,
            touches: [makeTouch(startX + (endX - startX) * 0.9, y)] as unknown as Touch[],
          })
        );
        target.dispatchEvent(
          new TouchEvent('touchend', {
            bubbles: true,
            cancelable: true,
            changedTouches: [makeTouch(endX, y)] as unknown as Touch[],
          })
        );
      },
      { startX, endX, y }
    );
  }

  async sendChat(message: string): Promise<void> {
    await this.switchTab('chat');
    const input = this.page.getByTestId('chat-panel').locator('input').first();
    await input.fill(message);
    await input.press('Enter');
  }

  async getPhaseLabel(): Promise<string> {
    return this.page.getByTestId('phase-badge').innerText();
  }
}
