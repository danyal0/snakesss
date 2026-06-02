import { test, expect } from '../../fixtures/test-fixture';
import { startE2EGame, forceE2EPhase } from '../../utils/seed';
import { expectGameTabMatchesPanel } from '../../utils/panel-sync';
import { swipeHorizontal } from '../../utils/swipe';
import { dismissBlockingGameOverlays } from '../../utils/game-ui';

async function readyGameScreen(page: import('@playwright/test').Page): Promise<void> {
  await page.getByTestId('game-screen').waitFor({ timeout: 30_000 });
  await dismissBlockingGameOverlays(page);
}

test.describe('Game tab ↔ panel sync', () => {
  test.beforeEach(async ({ page, request, e2eRoomId }) => {
    await startE2EGame(request, e2eRoomId);
    await forceE2EPhase(request, e2eRoomId, 'discussion');
    await page.reload();
    await readyGameScreen(page);
  });

  test('discussion phase: chat tab shows chat panel (not vote)', async ({ page }) => {
    await expectGameTabMatchesPanel(page, 'chat');
    await expect(page.getByTestId('chat-panel')).toBeVisible();
    await expect(page.locator('[data-active-panel="chat"]')).toBeVisible();
  });

  test('simulated round-2 transition voting → discussion keeps chat aligned', async ({
    page,
    request,
    e2eRoomId,
  }) => {
    await forceE2EPhase(request, e2eRoomId, 'voting');
    await page.reload();
    await readyGameScreen(page);

    await forceE2EPhase(request, e2eRoomId, 'discussion');
    await page.reload();
    await readyGameScreen(page);

    await expectGameTabMatchesPanel(page, 'chat');
    await expect(page.getByTestId('chat-panel')).toBeVisible();
  });

  test('manual tab clicks match visible panels', async ({ page }) => {
    await page.getByTestId('game-tab-players').click();
    await expectGameTabMatchesPanel(page, 'players');

    await page.getByTestId('game-tab-chat').click();
    await expectGameTabMatchesPanel(page, 'chat');

    await page.getByTestId('game-tab-vote').click();
    await expectGameTabMatchesPanel(page, 'vote');
  });
});

test.describe('Game swipe on touch devices', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page, request, e2eRoomId }) => {
    await startE2EGame(request, e2eRoomId);
    await forceE2EPhase(request, e2eRoomId, 'discussion');
    await page.reload();
    await readyGameScreen(page);
  });

  test('swipe from chat to vote shows vote panel', async ({ page }) => {
    await expectGameTabMatchesPanel(page, 'chat');
    const carousel = page.locator('[data-active-panel]').first();
    await swipeHorizontal(page, carousel, 'left');
    await expectGameTabMatchesPanel(page, 'vote');
  });
});
