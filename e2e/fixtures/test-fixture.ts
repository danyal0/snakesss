import { test as base, expect } from '@playwright/test';
import { resetE2EState, setDeterministicSeed } from '../utils/seed';
import { prepareTestPage, resetBrowserState } from '../utils/reset';
import { HomePage } from '../pages/home.page';
import { LobbyPage } from '../pages/lobby.page';
import { GamePage } from '../pages/game.page';
import { AdminPage } from '../pages/admin.page';

type Fixtures = {
  homePage: HomePage;
  lobbyPage: LobbyPage;
  gamePage: GamePage;
  adminPage: AdminPage;
  e2eRoomId: string;
};

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    await prepareTestPage(page);
    await use(page);
    await resetBrowserState(page);
  },

  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },

  lobbyPage: async ({ page }, use) => {
    await use(new LobbyPage(page));
  },

  gamePage: async ({ page }, use) => {
    await use(new GamePage(page));
  },

  adminPage: async ({ page }, use) => {
    await use(new AdminPage(page));
  },

  e2eRoomId: async ({ page, homePage, request }, use) => {
    await resetE2EState(request);
    await setDeterministicSeed(request, `room-${Date.now()}`);
    await homePage.goto();
    const roomId = await homePage.openCreateRoom('E2EHost');
    await page.getByTestId('lobby-tab-bots').click();
    await page.getByRole('button', { name: /Chaotic/i }).click();
    await page.getByRole('button', { name: /Aggressive/i }).click();
    await page.getByTestId('lobby-tab-players').click();
    await use(roomId);
  },
});

export { expect };
