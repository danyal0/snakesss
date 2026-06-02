import { test } from '../../fixtures/test-fixture';
import { assertNoDeadUI } from '../../utils/dom-audit';
import { startE2EGame, forceE2EPhase } from '../../utils/seed';

const screens = [
  { name: 'home', path: '/', testId: 'home-screen' },
  { name: 'public-rooms', path: '/rooms', testId: 'public-rooms-screen' },
  { name: 'leaderboard', path: '/leaderboard', testId: 'leaderboard-screen' },
] as const;

test.describe('Dead / invisible UI detection', () => {
  for (const screen of screens) {
    test(`audit ${screen.name}`, async ({ page, homePage }) => {
      if (screen.path === '/') await homePage.goto();
      else {
        await homePage.goto();
        await page.goto(screen.path);
      }
      await page.getByTestId(screen.testId).waitFor();
      await assertNoDeadUI(page);
    });
  }

  test('audit lobby', async ({ page, lobbyPage, e2eRoomId }) => {
    await lobbyPage.gotoRoom(e2eRoomId);
    await assertNoDeadUI(page);
  });

  test('audit game discussion', async ({ page, request, e2eRoomId }) => {
    await startE2EGame(request, e2eRoomId);
    await forceE2EPhase(request, e2eRoomId, 'discussion');
    await page.goto(`/room/${e2eRoomId}`);
    await page.getByTestId('game-screen').waitFor({ timeout: 30_000 });
    await assertNoDeadUI(page);
  });
});
