import { test, expect } from '../../fixtures/test-fixture';
import { startE2EGame, forceE2EPhase } from '../../utils/seed';
import { expectGameTabMatchesPanel, expectGamePanelCenteredInCarousel } from '../../utils/panel-sync';
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

  test('discussion phase: chat tab shows chat panel', async ({ page }) => {
    await expectGameTabMatchesPanel(page, 'chat');
    await expect(page.getByTestId('chat-panel')).toBeVisible();
    await expect(page.locator('[data-active-panel="chat"]')).toBeVisible();
  });

  test('avatar strip does not clip player highlight ring', async ({ page }) => {
    const clip = await page.evaluate(() => {
      const strip = document.querySelector('[data-testid="game-avatar-strip"]');
      const ring = strip?.querySelector('[class*="ring-green"]');
      if (!strip || !ring) return { ok: false, reason: 'missing nodes' };
      const stripRect = strip.getBoundingClientRect();
      const ringRect = ring.getBoundingClientRect();
      return {
        ok: ringRect.top >= stripRect.top - 2,
        stripTop: stripRect.top,
        ringTop: ringRect.top,
      };
    });
    expect(clip.ok, `avatar ring clipped: ${JSON.stringify(clip)}`).toBe(true);
  });

  test('discussion: chat input visible before any messages', async ({ page }) => {
    await expectGameTabMatchesPanel(page, 'chat');
    await expect(page.getByTestId('chat-empty-state')).toBeVisible();
    await expect(page.getByTestId('chat-input')).toBeVisible();
    await expect(page.getByTestId('chat-send')).toBeVisible();
    await expectGamePanelCenteredInCarousel(page, 'chat');
  });

  test('discussion: player can send first message before bots', async ({ page }) => {
    await expect(page.getByTestId('chat-input')).toBeVisible();
    await page.getByTestId('chat-input').fill('First human message');
    await page.getByTestId('chat-send').click();
    await expect(page.getByText('First human message')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('chat-empty-state')).not.toBeVisible();
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

  test('live socket transition voting → discussion: chat tab', async ({
    page,
    request,
    e2eRoomId,
  }) => {
    await forceE2EPhase(request, e2eRoomId, 'voting');
    await page.reload();
    await readyGameScreen(page);

    await forceE2EPhase(request, e2eRoomId, 'discussion');
    await page.waitForFunction(
      () =>
        document.querySelector('[data-active-panel]')?.getAttribute('data-active-panel') ===
        'chat',
      { timeout: 15_000 }
    );
    await dismissBlockingGameOverlays(page);

    await expectGameTabMatchesPanel(page, 'chat');
    await expect(page.getByTestId('chat-panel')).toBeVisible();
  });

  test('question → voting → discussion (reload per phase) shows chat panel', async ({
    page,
    request,
    e2eRoomId,
  }) => {
    await forceE2EPhase(request, e2eRoomId, 'question');
    await page.reload();
    await readyGameScreen(page);

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
    await page.getByTestId('game-tab-question').click();
    await expectGameTabMatchesPanel(page, 'question');

    await page.getByTestId('game-tab-chat').click();
    await expectGameTabMatchesPanel(page, 'chat');
  });

  test('leave button visible during game', async ({ page }) => {
    await expect(page.getByTestId('btn-leave-game')).toBeVisible();
    await page.getByTestId('btn-leave-game').click();
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await page.getByTestId('confirm-dialog-cancel').click();
    await expect(page.getByTestId('confirm-dialog')).toHaveCount(0);
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

  test('swipe from chat to question shows question panel', async ({ page }) => {
    await expectGameTabMatchesPanel(page, 'chat');
    await swipeHorizontal(page, page.getByTestId('game-carousel'), 'right');
    await expectGameTabMatchesPanel(page, 'question');
    await expectGamePanelCenteredInCarousel(page, 'question');
  });

  test('short swipe release keeps chat panel visible (no blank carousel)', async ({ page }) => {
    await expectGameTabMatchesPanel(page, 'chat');
    await swipeHorizontal(page, page.getByTestId('game-carousel'), 'left', 30);
    await expectGameTabMatchesPanel(page, 'chat');
    await expect(page.getByTestId('chat-input')).toBeVisible();
    await expectGamePanelCenteredInCarousel(page, 'chat');
  });

  test('swipe question → chat panels stay visible after each release', async ({ page }) => {
    await page.getByTestId('game-tab-question').click();
    await expectGameTabMatchesPanel(page, 'question');
    await expectGamePanelCenteredInCarousel(page, 'question');

    await swipeHorizontal(page, page.getByTestId('game-carousel'), 'left');
    await expectGameTabMatchesPanel(page, 'chat');
    await expect(page.getByTestId('chat-input')).toBeVisible();
    await expectGamePanelCenteredInCarousel(page, 'chat');

    await swipeHorizontal(page, page.getByTestId('game-carousel'), 'right');
    await expectGameTabMatchesPanel(page, 'question');
    await expect(page.getByTestId('debate-question')).toBeVisible();
    await expectGamePanelCenteredInCarousel(page, 'question');
  });

  test('discussion question stays visible on question tab after swipe', async ({ page }) => {
    await page.getByTestId('game-tab-question').click();
    await expectGameTabMatchesPanel(page, 'question');

    await expect(page.getByTestId('debate-question')).toBeVisible();

    await swipeHorizontal(page, page.getByTestId('game-carousel'), 'left');
    await expectGameTabMatchesPanel(page, 'chat');

    await swipeHorizontal(page, page.getByTestId('game-carousel'), 'right');
    await expectGameTabMatchesPanel(page, 'question');
    await expect(page.getByTestId('debate-question')).toBeVisible();
    await expectGamePanelCenteredInCarousel(page, 'question');
  });

  test('tab label shows Question not Players', async ({ page }) => {
    await expect(page.getByTestId('game-tab-question')).toHaveText(/Question/i);
    await expect(page.getByTestId('game-tab-vote')).toHaveCount(0);
  });
});

test.describe('Game desktop UX parity', () => {
  test.use({ viewport: { width: 1280, height: 720 }, hasTouch: false });

  test.beforeEach(async ({ page, request, e2eRoomId }) => {
    await startE2EGame(request, e2eRoomId);
    await forceE2EPhase(request, e2eRoomId, 'discussion');
    await page.reload();
    await readyGameScreen(page);
  });

  test('desktop shows Question and Chat tabs only (no Vote or Players tab)', async ({ page }) => {
    await expect(page.getByTestId('game-tab-question')).toBeVisible();
    await expect(page.getByTestId('game-tab-chat')).toBeVisible();
    await expect(page.getByTestId('game-tab-question')).toHaveText(/Question/i);
    await expect(page.getByTestId('game-tab-vote')).toHaveCount(0);
    await expect(page.getByTestId('game-tab-players')).toHaveCount(0);
  });

  test('desktop leave button opens confirm dialog', async ({ page }) => {
    await expect(page.getByTestId('btn-leave-game')).toBeVisible();
    await page.getByTestId('btn-leave-game').click();
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await page.getByTestId('confirm-dialog-cancel').click();
  });

  test('mouse drag on carousel switches chat to question', async ({ page }) => {
    await expectGameTabMatchesPanel(page, 'chat');
    const carousel = page.getByTestId('game-carousel');
    const box = await carousel.boundingBox();
    expect(box).toBeTruthy();
    const y = box!.y + box!.height / 2;
    const startX = box!.x + box!.width * 0.78;
    const endX = startX - 140;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(endX, y, { steps: 12 });
    await page.mouse.up();
    await expectGameTabMatchesPanel(page, 'question');
    await expect(page.getByTestId('debate-question')).toBeVisible();
  });
});

