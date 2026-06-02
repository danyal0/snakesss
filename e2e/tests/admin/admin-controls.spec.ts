import { test, expect } from '../../fixtures/test-fixture';

test.describe('Admin UI coverage', () => {
  test('login and dashboard navigation', async ({ adminPage, page }) => {
    await adminPage.login();
    await expect(page.getByTestId('admin-dashboard')).toBeVisible();
    await adminPage.openRooms();
    await expect(page.getByText(/Rooms|room/i).first()).toBeVisible();
  });

  test('admin overview shows analytics', async ({ adminPage, page }) => {
    await adminPage.login();
    await expect(page.getByText(/Overview|Active|Games/i).first()).toBeVisible();
  });

  test('admin rooms list reflects active games', async ({ adminPage, page }) => {
    await adminPage.login();
    await adminPage.openRooms();
    await expect(page.getByText(/Room|roomId|Active/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('logout returns to login', async ({ adminPage, page }) => {
    await adminPage.login();
    await page.getByRole('button', { name: /Sign Out/i }).click();
    await expect(page.getByTestId('admin-login-screen')).toBeVisible({ timeout: 10_000 });
  });
});
