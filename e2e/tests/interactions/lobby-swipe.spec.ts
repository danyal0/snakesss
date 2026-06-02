import { test, expect } from '../../fixtures/test-fixture';
import { swipeHorizontal } from '../../utils/swipe';
import { expectLobbyTabMatchesPanel } from '../../utils/panel-sync';

test.describe('Lobby swipe gestures', () => {
  test.use({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });

  test('swipe left reveals bots panel', async ({ page, e2eRoomId }) => {
    await expect(page.getByTestId('lobby-screen')).toBeVisible();
    await expectLobbyTabMatchesPanel(page, 'players');

    const swipeTarget = page.getByTestId('lobby-carousel');
    await swipeHorizontal(page, swipeTarget, 'left');
    await expectLobbyTabMatchesPanel(page, 'bots');
    await expect(page.getByText(/Add a bot|Only the room manager/i).first()).toBeVisible();
  });

  test('swipe left twice reaches settings panel', async ({ page, e2eRoomId }) => {
    await expect(page.getByTestId('lobby-screen')).toBeVisible();
    const swipeTarget = page.getByTestId('lobby-carousel');

    await swipeHorizontal(page, swipeTarget, 'left');
    await expectLobbyTabMatchesPanel(page, 'bots');

    await swipeHorizontal(page, swipeTarget, 'left');
    await expectLobbyTabMatchesPanel(page, 'settings');
    await expect(page.getByText(/Max Players/i)).toBeVisible();
  });

  test('swipe right from settings returns to bots', async ({ page, e2eRoomId }) => {
    await expect(page.getByTestId('lobby-screen')).toBeVisible();
    await page.getByTestId('lobby-tab-settings').click();
    await expectLobbyTabMatchesPanel(page, 'settings');

    const swipeTarget = page.getByTestId('lobby-carousel');
    await swipeHorizontal(page, swipeTarget, 'right');
    await expectLobbyTabMatchesPanel(page, 'bots');
  });

  test('tab click and swipe stay in sync', async ({ page, e2eRoomId }) => {
    await page.getByTestId('lobby-tab-bots').click();
    await expectLobbyTabMatchesPanel(page, 'bots');

    await page.getByTestId('lobby-tab-settings').click();
    await expectLobbyTabMatchesPanel(page, 'settings');

    await swipeHorizontal(page, page.getByTestId('lobby-carousel'), 'right');
    await expectLobbyTabMatchesPanel(page, 'bots');
  });
});
