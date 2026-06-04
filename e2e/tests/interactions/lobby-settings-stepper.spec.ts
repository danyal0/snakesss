import { test, expect } from '../../fixtures/test-fixture';
import { tapWithHorizontalDrift } from '../../utils/swipe';
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
      await minus.click({ delay: 0 });
    }

    await expect(value).toHaveText('45s');
    await expectLobbyTabMatchesPanel(page, 'settings');
  });

  test('touch on minus with slight horizontal drift does not change tab', async ({ page, e2eRoomId }) => {
    await page.getByTestId('lobby-tab-settings').click();
    await expectLobbyTabMatchesPanel(page, 'settings');

    const minus = page.getByTestId('setting-discussion-timer-minus');
    await tapWithHorizontalDrift(minus, 18);

    await expect(page.getByTestId('setting-discussion-timer-value')).toHaveText('105s');
    await expectLobbyTabMatchesPanel(page, 'settings');
  });
});
