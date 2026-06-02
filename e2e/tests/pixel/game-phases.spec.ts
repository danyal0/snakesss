import { test, expect } from '../../fixtures/test-fixture';
import { startE2EGame, forceE2EPhase } from '../../utils/seed';
import { expectGameTabMatchesPanel } from '../../utils/panel-sync';
import { dismissBlockingGameOverlays } from '../../utils/game-ui';
import { waitForMotionSettled } from '../../utils/animation';
import { assertPixelStable } from '../../utils/pixel';

test.describe('Pixel — In-game', () => {
  test('game screen visible after start', async ({ page, lobbyPage, e2eRoomId }) => {
    await lobbyPage.startGame();
    await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 30_000 });
  });

  test('discussion chat panel matches tab', async ({ page, request, e2eRoomId }) => {
    await startE2EGame(request, e2eRoomId);
    await forceE2EPhase(request, e2eRoomId, 'discussion');
    await page.reload();
    await page.getByTestId('game-screen').waitFor({ timeout: 30_000 });
    await dismissBlockingGameOverlays(page);
    await expectGameTabMatchesPanel(page, 'chat');
    await waitForMotionSettled(page);
    await assertPixelStable(page.getByTestId('game-panel-chat'), 'game-discussion-chat');
  });
});
