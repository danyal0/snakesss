import { test, expect } from '../../fixtures/test-fixture';

test.describe('Swipe & gesture (lobby tabs)', () => {
  test('lobby tab buttons switch panels', async ({ page, lobbyPage, e2eRoomId }) => {
    await expect(page.getByTestId('lobby-screen')).toBeVisible();
    await lobbyPage.switchTab('bots');
    await lobbyPage.switchTab('settings');
    await lobbyPage.switchTab('players');
    await expect(page.getByTestId('lobby-tab-players')).toBeVisible();
  });

  test('rapid tab switching does not freeze lobby', async ({ page, lobbyPage, e2eRoomId }) => {
    await lobbyPage.switchTab('bots');
    await lobbyPage.switchTab('players');
    await lobbyPage.switchTab('settings');
    await expect(page.getByTestId('lobby-screen')).toBeVisible();
  });
});
