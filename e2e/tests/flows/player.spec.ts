import { test, expect } from '../../fixtures/test-fixture';
import { startE2EGame, forceE2EPhase } from '../../utils/seed';

test.describe('Player flow completeness', () => {
  test('player reaches lobby → game', async ({ page, request, e2eRoomId }) => {
    await expect(page.getByTestId('lobby-screen')).toBeVisible();
    await startE2EGame(request, e2eRoomId);
    await page.reload();
    await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 30_000 });
    await forceE2EPhase(request, e2eRoomId, 'discussion');
    await expect(page.getByTestId('game-tab-chat')).toBeVisible();
  });

  test('no dead ends from home navigation', async ({ page, homePage }) => {
    await homePage.goto();
    await page.getByTestId('btn-browse-rooms').click();
    await expect(page.getByTestId('public-rooms-screen')).toBeVisible();
    await page.getByRole('button', { name: /Back/i }).click();
    await page.getByTestId('btn-leaderboard').click();
    await expect(page.getByTestId('leaderboard-screen')).toBeVisible();
    await page.getByRole('button', { name: /Back/i }).click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
  });
});
