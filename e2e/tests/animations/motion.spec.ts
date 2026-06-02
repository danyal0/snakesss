import { test, expect } from '../../fixtures/test-fixture';
import { setReducedMotion, waitForMotionSettled, syncAnimationFrames } from '../../utils/animation';
import { startE2EGame } from '../../utils/seed';

test.describe('Animations & motion', () => {
  test('reduce motion ON stabilizes layout', async ({ page, homePage }) => {
    await homePage.goto();
    await setReducedMotion(page, true);
    const before = await page.getByTestId('home-screen').boundingBox();
    await waitForMotionSettled(page, 100);
    const after = await page.getByTestId('home-screen').boundingBox();
    expect(before?.height).toBeCloseTo(after?.height ?? 0, 0);
  });

  test('reduce motion OFF still reaches stable end state', async ({ page, homePage }) => {
    await homePage.goto();
    await setReducedMotion(page, false);
    await page.getByTestId('btn-create-room').click();
    await syncAnimationFrames(page, 4);
    await setReducedMotion(page, true);
    await expect(page.getByTestId('create-room-form')).toBeVisible();
  });

  test('mid-animation tab switch does not freeze UI', async ({ page, lobbyPage, e2eRoomId }) => {
    await lobbyPage.gotoRoom(e2eRoomId);
    await page.getByTestId('lobby-tab-bots').click();
    await page.getByTestId('lobby-tab-players').click({ delay: 50 });
    await expect(page.getByTestId('lobby-tab-players')).toBeVisible();
  });

  test('game start animation chain completes', async ({ page, request, lobbyPage, e2eRoomId }) => {
    await startE2EGame(request, e2eRoomId);
    await page.goto(`/room/${e2eRoomId}`);
    await page.getByTestId('game-screen').waitFor({ timeout: 30_000 });
    await waitForMotionSettled(page, 500);
    const phase = await page.evaluate(() => window.__SNAKESS_TEST__?.getStore().gameState?.phase);
    expect(phase).not.toBe('lobby');
  });
});
