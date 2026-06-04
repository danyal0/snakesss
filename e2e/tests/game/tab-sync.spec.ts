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
    await expect(page.getByTestId('game-panel-vote')).not.toBeVisible();
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

  test('live socket transition voting → discussion: chat tab, not vote UI', async ({
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
    await expect(page.getByText('Secret vote')).not.toBeVisible();
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
    await expect(page.getByText('Secret vote')).not.toBeVisible();
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
    await swipeHorizontal(page, page.getByTestId('game-carousel'), 'left');
    await expectGameTabMatchesPanel(page, 'vote');
  });
});
