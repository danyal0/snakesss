import { test, expect } from '../../fixtures/test-fixture';

test.describe('Keyboard & focus', () => {
  test('Enter submits create room form', async ({ page, homePage }) => {
    await homePage.goto();
    await page.getByTestId('btn-create-room').click();
    await page.getByTestId('input-username').fill('EnterUser');
    await page.getByTestId('input-username').press('Enter');
    await expect(page.getByTestId('lobby-screen')).toBeVisible({ timeout: 20_000 });
  });

  test('tab order reaches primary actions', async ({ page, homePage }) => {
    await homePage.goto();
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'A', 'INPUT']).toContain(focused);
  });

  test('Escape does not crash app', async ({ page, homePage }) => {
    await homePage.goto();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('home-screen')).toBeVisible();
  });
});
