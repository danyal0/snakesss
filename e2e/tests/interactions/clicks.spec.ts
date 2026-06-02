import { test, expect } from '../../fixtures/test-fixture';

test.describe('Click / Tap interactions', () => {
  test('every home CTA is visible and navigates', async ({ page, homePage }) => {
    await homePage.goto();

    const create = page.getByTestId('btn-create-room');
    await expect(create).toBeVisible();
    await expect(create).toBeEnabled();
    await create.click();
    await expect(page.getByTestId('create-room-form')).toBeVisible();

    await page.getByRole('button', { name: /Back/i }).click();
    await page.getByTestId('btn-join-room').click();
    await expect(page.getByTestId('join-room-form')).toBeVisible();

    await page.getByRole('button', { name: /Back/i }).click();
    await page.getByTestId('btn-browse-rooms').click();
    await expect(page.getByTestId('public-rooms-screen')).toBeVisible();

    await page.getByRole('button', { name: /Back/i }).click();
    await page.getByTestId('btn-leaderboard').click();
    await expect(page.getByTestId('leaderboard-screen')).toBeVisible();
  });

  test('disabled create when disconnected shows disabled state', async ({ page }) => {
    await page.route('**/socket.io/**', (route) => route.abort());
    await page.goto('/');
    const create = page.getByTestId('btn-create-room');
    await expect(create).toBeDisabled();
  });

  test('rapid double click on start does not duplicate', async ({ page, homePage, lobbyPage }) => {
    await homePage.goto();
    const roomId = await homePage.openCreateRoom('Mgr');
    await lobbyPage.addBot('chaotic_liar');
    await lobbyPage.addBot('aggressive');
    const start = page.getByTestId('btn-start-game');
    await expect(start).toBeEnabled({ timeout: 10_000 });
    await start.dblclick({ delay: 50 });
    await page.getByTestId('game-screen').waitFor({ timeout: 30_000 });
    const phases = await page.evaluate(() => {
      const s = window.__SNAKESS_TEST__?.getStore().gameState;
      return s?.phase;
    });
    expect(phases).not.toBe('lobby');
  });

  test('lobby tab buttons switch content', async ({ page, lobbyPage, e2eRoomId }) => {
    await lobbyPage.gotoRoom(e2eRoomId);
    for (const tab of ['players', 'bots', 'settings'] as const) {
      await lobbyPage.switchTab(tab);
      await expect(page.getByTestId(`lobby-tab-${tab}`)).toHaveClass(/text-white/);
    }
  });
});
