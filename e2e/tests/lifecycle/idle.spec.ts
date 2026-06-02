import { test, expect } from '../../fixtures/test-fixture';

test.describe('Idle / no activity', () => {
  test('simulated idle in lobby keeps session', async ({ page, e2eRoomId }) => {
    await expect(page.getByTestId('lobby-screen')).toBeVisible();
    await page.evaluate(() => window.__SNAKESS_TEST__?.advanceIdle(30_000));
    await expect(page.getByTestId('lobby-screen')).toBeVisible();
    expect(await page.evaluate(() => window.__SNAKESS_TEST__?.getStore().isConnected)).toBe(true);
  });

  test('long idle fast-forward in lobby', async ({ page, e2eRoomId }) => {
    await expect(page.getByTestId('lobby-screen')).toBeVisible();
    await page.evaluate(() => window.__SNAKESS_TEST__?.advanceIdle(5_000));
    await expect(page.getByTestId('room-code')).toBeVisible();
  });
});
