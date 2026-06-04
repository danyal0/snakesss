import { test, expect } from '../../fixtures/test-fixture';

test.describe('Haptic feedback', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __vibrateCalls: (number | number[])[] }).__vibrateCalls = [];
      navigator.vibrate = (pattern) => {
        (window as unknown as { __vibrateCalls: (number | number[])[] }).__vibrateCalls.push(
          pattern
        );
        return true;
      };
    });
  });

  test('home primary button triggers vibration', async ({ page, homePage }) => {
    await homePage.goto();
    await page.getByTestId('btn-create-room').click();
    const calls = await page.evaluate(
      () => (window as unknown as { __vibrateCalls: unknown[] }).__vibrateCalls
    );
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]).toEqual(35);
  });

  test('haptics fire even when reduce-motion is enabled in E2E', async ({ page, homePage }) => {
    await homePage.goto();
    await page.evaluate(() => {
      document.documentElement.classList.add('e2e-reduce-motion');
    });
    await page.getByTestId('btn-join-room').click();
    const calls = await page.evaluate(
      () => (window as unknown as { __vibrateCalls: unknown[] }).__vibrateCalls
    );
    expect(calls.length).toBeGreaterThan(0);
  });
});
