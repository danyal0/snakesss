import { test, expect } from '../../fixtures/test-fixture';
import { expectLobbyTabMatchesPanel } from '../../utils/panel-sync';

test.describe('Lobby settings steppers vs swipe', () => {
  test.use({
    hasTouch: true,
    viewport: { width: 390, height: 520 },
  });

  test('rapid minus taps on discussion timer register every step', async ({ page, e2eRoomId }) => {
    await page.getByTestId('lobby-tab-settings').click();
    await expectLobbyTabMatchesPanel(page, 'settings');

    const value = page.getByTestId('setting-discussion-timer-value');
    const minus = page.getByTestId('setting-discussion-timer-minus');

    await expect(value).toHaveText('120s');

    for (let i = 0; i < 5; i++) {
      await minus.tap();
    }

    await expect(value).toHaveText('45s');
    await expectLobbyTabMatchesPanel(page, 'settings');
  });

  test('touch on minus with slight horizontal drift does not change tab', async ({ page, e2eRoomId }) => {
    await page.getByTestId('lobby-tab-settings').click();
    await expectLobbyTabMatchesPanel(page, 'settings');

    const minus = page.getByTestId('setting-discussion-timer-minus');
    const box = await minus.boundingBox();
    expect(box).toBeTruthy();

    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;

    await page.touchscreen.touchStart(x, y);
    await page.touchscreen.touchMove(x + 18, y + 2);
    await page.touchscreen.touchEnd();

    await expect(page.getByTestId('setting-discussion-timer-value')).toHaveText('105s');
    await expectLobbyTabMatchesPanel(page, 'settings');
  });
});
