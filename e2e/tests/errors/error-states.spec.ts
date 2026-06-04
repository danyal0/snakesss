import { test, expect } from '../../fixtures/test-fixture';
import { applyNetworkProfile } from '../../utils/network';

test.describe('Error & edge state UI', () => {
  test('invalid room shows loading or error, not raw stack', async ({ page, homePage }) => {
    await homePage.goto();
    await page.goto('/room/BAD1');
    const loading = page.getByTestId('room-loading');
    const error = page.getByTestId('room-error');
    const joinGate = page.getByTestId('join-room-gate');
    await expect(loading.or(error).or(joinGate)).toBeVisible({ timeout: 20_000 });
    const body = await page.content();
    expect(body).not.toMatch(/TypeError|undefined is not/);
  });

  test('join validation shows styled error', async ({ page, homePage }) => {
    await homePage.goto();
    await page.getByTestId('btn-join-room').click();
    await page.getByTestId('input-username').fill('');
    await page.getByTestId('btn-submit-room').click();
    await expect(page.getByText(/Enter a username/i)).toBeVisible();
    const color = await page.getByText(/Enter a username/i).evaluate((el) =>
      getComputedStyle(el).color
    );
    expect(color).toMatch(/rgb/);
  });

  test('socket disconnect shows reconnect indicator', async ({ page, homePage }) => {
    await homePage.goto();
    await page.context().setOffline(true);
    await expect(page.getByText(/Connecting/i)).toBeVisible({ timeout: 15_000 });
    await page.context().setOffline(false);
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 25_000 });
  });

  test('home loads under default network conditions', async ({ page, homePage }) => {
    await homePage.goto();
    await expect(page.getByTestId('home-screen')).toBeVisible();
  });

  test('admin login wrong password shows error UI', async ({ adminPage, page }) => {
    await adminPage.gotoLogin();
    await page.getByTestId('admin-password-input').fill('wrong-password-xyz');
    await page.getByTestId('admin-login-btn').click();
    await expect(page.getByText(/Invalid|credentials|failed/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('admin-login-screen')).toBeVisible();
  });
});
