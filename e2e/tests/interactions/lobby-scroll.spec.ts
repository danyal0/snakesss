import { test, expect } from '../../fixtures/test-fixture';
import { swipeHorizontal, swipeVertical } from '../../utils/swipe';
import { expectLobbyTabMatchesPanel } from '../../utils/panel-sync';

test.describe('Lobby vertical scroll vs horizontal swipe', () => {
  // Short viewport so bots panel content overflows and can scroll
  test.use({ hasTouch: true, viewport: { width: 390, height: 520 } });

  test('bots tab scrolls vertically without switching tabs', async ({ page, e2eRoomId }) => {
    await page.getByTestId('lobby-tab-bots').click();
    await expectLobbyTabMatchesPanel(page, 'bots');

    const panel = page.getByTestId('lobby-panel-bots');
    await panel.evaluate((el) => {
      el.scrollTop = 0;
    });

    const metrics = await panel.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight + 20);

    await swipeVertical(page, panel, 'down', 160);
    await expectLobbyTabMatchesPanel(page, 'bots');

    // Panel must allow programmatic scroll (touch-pan-y + overflow)
    await panel.evaluate((el) => {
      el.scrollTop = 40;
    });
    expect(await panel.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  });

  test('horizontal swipe still changes tabs after vertical scroll area', async ({ page, e2eRoomId }) => {
    await expectLobbyTabMatchesPanel(page, 'players');
    await swipeHorizontal(page, page.getByTestId('lobby-carousel'), 'left');
    await expectLobbyTabMatchesPanel(page, 'bots');
  });
});
