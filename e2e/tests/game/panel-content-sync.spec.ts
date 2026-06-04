import { test, expect } from '../../fixtures/test-fixture';
import { startE2EGame, forceE2EPhase } from '../../utils/seed';
import {
  expectGameTabMatchesPanel,
  expectGameElementInCarouselViewport,
} from '../../utils/panel-sync';
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
    await expectGameElementInCarouselViewport(page, 'debate-question', true);
    await expectGameElementInCarouselViewport(page, 'chat-input', false);
  });

  test('chat tab shows chat input, not debate question', async ({ page }) => {
    await page.getByTestId('game-tab-chat').click();
    await expectGameTabMatchesPanel(page, 'chat');
    await expectGameElementInCarouselViewport(page, 'chat-input', true);
    await expectGameElementInCarouselViewport(page, 'debate-question', false);
  });

  test('no vote tab in game', async ({ page }) => {
    await expect(page.getByTestId('game-tab-vote')).toHaveCount(0);
    await expect(page.getByTestId('game-panel-vote')).toHaveCount(0);
  });
});
