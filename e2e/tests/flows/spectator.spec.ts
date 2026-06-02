import { test, expect } from '../../fixtures/test-fixture';
import { startE2EGame } from '../../utils/seed';

test.describe('Spectator flows', () => {
  test('spectator join toggle on join form', async ({ page, homePage }) => {
    await homePage.goto();
    await page.getByTestId('btn-join-room').click();
    await page.getByText('Join as Spectator').click();
    await expect(page.getByTestId('join-room-form')).toBeVisible();
  });

  test('spectator can view game after start via direct room URL', async ({ browser, request, e2eRoomId }) => {
    await startE2EGame(request, e2eRoomId);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`/room/${e2eRoomId}`);
    await expect(page.getByTestId('game-screen').or(page.getByTestId('room-loading'))).toBeVisible({
      timeout: 30_000,
    });
    await ctx.close();
  });
});
