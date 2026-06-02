import type { Page } from '@playwright/test';

const ADMIN_URL = 'http://127.0.0.1:5174/admin/';

export class AdminPage {
  constructor(readonly page: Page) {}

  async gotoLogin(): Promise<void> {
    await this.page.goto(ADMIN_URL);
    await this.page.getByTestId('admin-login-screen').waitFor();
  }

  async login(password = 'e2e-admin-pass'): Promise<void> {
    await this.gotoLogin();
    await this.page.getByTestId('admin-password-input').fill(password);
    await this.page.getByTestId('admin-login-btn').click();
    await this.page.getByTestId('admin-dashboard').waitFor({ timeout: 15_000 });
  }

  async openRooms(): Promise<void> {
    await this.page.getByRole('link', { name: /Rooms/i }).click();
  }
}
