import { test, expect } from '../../fixtures/test-fixture';
import { startE2EGame, forceE2EPhase } from '../../utils/seed';
import { expectGameTabMatchesPanel } from '../../utils/panel-sync';
import { dismissBlockingGameOverlays } from '../../utils/game-ui';

test.describe('Game tab content must match active tab', () => {
  test.beforeEach(async ({ page, request, e2eRoomId }) => {
    await startE2EGame(request, e2eRoomId);
    await forceE2EPhase(request, e2eRoomId, 'discussion');
    await page.reload();
    await page.getByTestId('game-screen').waitFor({ timeout: 30_000 });
    await dismissBlockingGameOverlays(page);
  });

  test('question tab shows debate question, not chat', async ({ page }) => {
    await page.getByTestId('game-tab-question').click();
    await expectGameTabMatchesPanel(page, 'question');
    await expect(page.getByTestId('debate-question')).toBeVisible();
    await expect(page.getByTestId('chat-input')).toHaveCount(0);
  });

  test('chat tab shows chat input, not debate question', async ({ page }) => {
    await page.getByTestId('game-tab-chat').click();
    await expectGameTabMatchesPanel(page, 'chat');
    await expect(page.getByTestId('chat-input')).toBeVisible();
    await expect(page.getByTestId('debate-question')).toHaveCount(0);
  });

  test('vote tab shows vote placeholder, not chat', async ({ page }) => {
    await page.getByTestId('game-tab-vote').click();
    await expectGameTabMatchesPanel(page, 'vote');
    await expect(page.getByText(/Answer voting opens|Secret vote/i)).toBeVisible();
    await expect(page.getByTestId('chat-input')).toHaveCount(0);
  });
});
