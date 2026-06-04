import { test, expect } from '../../fixtures/test-fixture';

test.describe('No page zoom', () => {
  test('viewport meta blocks scaling on home', async ({ page, homePage }) => {
    await homePage.goto();
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toMatch(/user-scalable=no/i);
    expect(viewport).toMatch(/maximum-scale=1/i);
    expect(viewport).toMatch(/minimum-scale=1/i);
  });

  test('viewport meta blocks scaling in game', async ({ page, request, e2eRoomId }) => {
    const { startE2EGame, forceE2EPhase } = await import('../../utils/seed');
    await startE2EGame(request, e2eRoomId);
    await forceE2EPhase(request, e2eRoomId, 'discussion');
    await page.reload();
    await page.getByTestId('game-screen').waitFor({ timeout: 30_000 });

    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toMatch(/user-scalable=no/i);
  });

  test('chat input uses 16px font (prevents iOS focus zoom)', async ({ page, request, e2eRoomId }) => {
    const { startE2EGame, forceE2EPhase } = await import('../../utils/seed');
    await startE2EGame(request, e2eRoomId);
    await forceE2EPhase(request, e2eRoomId, 'discussion');
    await page.reload();
    await page.getByTestId('game-screen').waitFor({ timeout: 30_000 });

    const fontSize = await page.getByTestId('chat-input').evaluate((el) =>
      parseFloat(getComputedStyle(el).fontSize)
    );
    expect(fontSize).toBeGreaterThanOrEqual(16);
  });
});
