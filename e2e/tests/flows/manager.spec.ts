import { test, expect } from '../../fixtures/test-fixture';

test.describe('Room manager flows', () => {
  test('manager can configure settings and start', async ({ page, homePage, lobbyPage }) => {
    await homePage.goto();
    await homePage.openCreateRoom('Manager');
    await lobbyPage.switchTab('settings');
    await expect(page.getByRole('button', { name: /Save Settings/i })).toBeVisible();
    await lobbyPage.switchTab('bots');
    await lobbyPage.addBot('aggressive');
    await lobbyPage.addBot('silent_strategist');
    const start = page.getByTestId('btn-start-game');
    await expect(start).toBeEnabled({ timeout: 15_000 });
    await start.click();
    await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 30_000 });
  });

  test('manager sees kick controls on players tab', async ({ page, homePage, lobbyPage }) => {
    await homePage.goto();
    await homePage.openCreateRoom('KickMgr');
    await lobbyPage.switchTab('bots');
    await lobbyPage.addBot('chaotic_liar');
    await lobbyPage.switchTab('players');
    const kicks = page.getByRole('button', { name: 'Kick' });
    await expect(kicks.first()).toBeVisible();
  });
});
