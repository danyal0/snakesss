import { test, expect } from '../../fixtures/test-fixture';
import { startE2EGame, forceE2EPhase } from '../../utils/seed';

test.describe('Background / foreground', () => {
  test('tab hidden then visible preserves state', async ({ page, request, e2eRoomId }) => {
    await startE2EGame(request, e2eRoomId);
    await forceE2EPhase(request, e2eRoomId, 'discussion');
    await page.goto(`/room/${e2eRoomId}`);
    await page.getByTestId('game-screen').waitFor({ timeout: 30_000 });
    const before = await page.evaluate(() => window.__SNAKESS_TEST__?.getStore().gameState?.roomId);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const after = await page.evaluate(() => window.__SNAKESS_TEST__?.getStore().gameState?.roomId);
    expect(after).toBe(before);
    await expect(page.getByTestId('game-screen')).toBeVisible();
  });

  test('page hide / pageshow does not desync', async ({ page, lobbyPage, e2eRoomId }) => {
    await lobbyPage.gotoRoom(e2eRoomId);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await expect(page.getByTestId('lobby-screen')).toBeVisible();
  });
});
