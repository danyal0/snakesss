import { test, expect } from '../../fixtures/test-fixture';

test.describe('Room navigation UX', () => {
  test('join gate back exits without confirmation', async ({ page }) => {
    await page.goto('/room/ZZZZ');
    await page.getByTestId('join-room-gate').waitFor({ timeout: 20_000 });
    await page.getByTestId('btn-join-gate-back').click();
    await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('confirm-dialog')).toHaveCount(0);
  });

  test('mic control visible in lobby for registered player', async ({ page, lobbyPage, e2eRoomId }) => {
    await lobbyPage.gotoRoom(e2eRoomId);
    await expect(page.getByTestId('btn-voice-mic')).toBeVisible();
  });
});
