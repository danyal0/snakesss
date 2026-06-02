import { test, expect } from '../../fixtures/test-fixture';

test.describe('Pixel — Lobby (structural)', () => {
  test('lobby players tab layout', async ({ page, e2eRoomId }) => {
    await expect(page.getByTestId('lobby-screen')).toBeVisible();
    await page.getByTestId('lobby-tab-players').click();
    await expect(page.getByTestId('room-code')).toHaveText(e2eRoomId);
    await expect(page.getByTestId('btn-start-game')).toBeVisible();
  });

  test('lobby bots tab layout', async ({ page, e2eRoomId }) => {
    await expect(page.getByTestId('lobby-screen')).toBeVisible();
    await page.getByTestId('lobby-tab-bots').click();
    await expect(page.getByText(/Add a bot|chaotic|Aggressive/i).first()).toBeVisible();
  });

  test('lobby settings tab layout', async ({ page, e2eRoomId }) => {
    await expect(page.getByTestId('lobby-screen')).toBeVisible();
    await page.getByTestId('lobby-tab-settings').click();
    await expect(page.getByText(/Max Players/i)).toBeVisible();
  });
});
