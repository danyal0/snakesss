import { test, expect } from '../../fixtures/test-fixture';
import { startE2EGame, forceE2EPhase } from '../../utils/seed';

test.describe('Browser refresh & resume', () => {
  test('refresh in lobby restores room', async ({ page, e2eRoomId }) => {
    await expect(page.getByTestId('lobby-screen')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('lobby-screen')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('room-code')).toHaveText(e2eRoomId);
  });

  test('refresh during voting restores game UI', async ({ page, request, e2eRoomId }) => {
    await startE2EGame(request, e2eRoomId);
    await forceE2EPhase(request, e2eRoomId, 'voting');
    await page.reload();
    await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 30_000 });
    const phase = await page.evaluate(() => window.__SNAKESS_TEST__?.getStore().gameState?.phase);
    expect(['voting', 'discussion', 'question', 'dealing']).toContain(phase);
  });

  test('manager refresh keeps lobby and room manager powers', async ({ page, e2eRoomId, lobbyPage }) => {
    await expect(page.getByTestId('lobby-screen')).toBeVisible();
    await expect(page.getByTestId('room-code')).toHaveText(e2eRoomId);
    await lobbyPage.switchTab('players');
    await expect(page.getByRole('button', { name: 'Kick' }).first()).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('lobby-screen')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('room-code')).toHaveText(e2eRoomId);
    await expect(page.getByTestId('btn-start-game')).toBeEnabled({ timeout: 20_000 });

    await lobbyPage.switchTab('settings');
    await expect(page.getByText(/Settings save automatically/i)).toBeVisible();
    await lobbyPage.switchTab('players');
    await expect(page.getByRole('button', { name: 'Kick' }).first()).toBeVisible();
    await expect(page.getByTestId('btn-start-game')).toBeEnabled({ timeout: 15_000 });
  });

  test('refresh does not duplicate room code display', async ({ page, e2eRoomId }) => {
    await expect(page.getByTestId('lobby-screen')).toBeVisible();
    const codeBefore = await page.getByTestId('room-code').innerText();
    await page.reload();
    await page.getByTestId('lobby-screen').waitFor({ timeout: 20_000 });
    const codeAfter = await page.getByTestId('room-code').innerText();
    expect(codeAfter).toBe(codeBefore);
    expect(codeAfter).toBe(e2eRoomId);
  });
});
