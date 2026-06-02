import { test, expect } from '../../fixtures/test-fixture';

test.describe('Pixel — In-game', () => {
  test('game screen visible after start', async ({ page, lobbyPage, e2eRoomId }) => {
    await lobbyPage.startGame();
    await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 30_000 });
  });
});
