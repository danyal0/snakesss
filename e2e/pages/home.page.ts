import type { Page } from '@playwright/test';
import { settleTestHarness } from '../utils/reset';

export class HomePage {
  constructor(readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/');
    await settleTestHarness(this.page);
    await this.page.getByTestId('home-screen').waitFor({ state: 'visible' });
    await this.waitForConnected();
  }

  async waitForConnected(): Promise<void> {
    await this.page.getByText('Connected', { exact: false }).waitFor({ timeout: 20_000 });
  }

  async openCreateRoom(username = 'TestHost'): Promise<string> {
    await this.page.getByTestId('btn-create-room').click();
    await this.page.getByTestId('create-room-form').waitFor();
    await this.page.getByTestId('input-username').fill(username);
    await this.page.getByTestId('btn-submit-room').click();
    await this.page.getByTestId('lobby-screen').waitFor({ timeout: 20_000 });
    return this.page.getByTestId('room-code').innerText();
  }

  async openJoinRoom(roomCode: string, username = 'TestGuest'): Promise<void> {
    await this.page.getByTestId('btn-join-room').click();
    await this.page.getByTestId('join-room-form').waitFor();
    await this.page.getByTestId('input-username').fill(username);
    await this.page.getByTestId('input-room-code').fill(roomCode);
    await this.page.getByTestId('btn-submit-room').click();
    await this.page.getByTestId('lobby-screen').waitFor({ timeout: 20_000 });
  }
}
