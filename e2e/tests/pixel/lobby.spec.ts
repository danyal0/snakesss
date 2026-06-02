import { test, expect } from '../../fixtures/test-fixture';
import { assertPixelPerfect, assertPixelStable } from '../../utils/pixel';
import { waitForMotionSettled } from '../../utils/animation';
import { expectLobbyTabMatchesPanel } from '../../utils/panel-sync';

test.describe('Pixel — Lobby tabs', () => {
  test('lobby players tab', async ({ page, e2eRoomId }) => {
    await expect(page.getByTestId('lobby-screen')).toBeVisible();
    await page.getByTestId('lobby-tab-players').click();
    await expectLobbyTabMatchesPanel(page, 'players');
    await waitForMotionSettled(page);
    await assertPixelStable(page.getByTestId('lobby-panel-players'), 'lobby-players');
  });

  test('lobby bots tab', async ({ page, e2eRoomId }) => {
    await expect(page.getByTestId('lobby-screen')).toBeVisible();
    await page.getByTestId('lobby-tab-bots').click();
    await expectLobbyTabMatchesPanel(page, 'bots');
    await waitForMotionSettled(page);
    await assertPixelStable(page.getByTestId('lobby-panel-bots'), 'lobby-bots');
  });

  test('lobby settings tab', async ({ page, e2eRoomId }) => {
    await expect(page.getByTestId('lobby-screen')).toBeVisible();
    await page.getByTestId('lobby-tab-settings').click();
    await expectLobbyTabMatchesPanel(page, 'settings');
    await waitForMotionSettled(page);
    await assertPixelPerfect(page.getByTestId('lobby-panel-settings'), 'lobby-settings');
  });
});
