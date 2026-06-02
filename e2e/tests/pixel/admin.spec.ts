import { test } from '../../fixtures/test-fixture';
import { assertPixelPerfect } from '../../utils/pixel';
import { waitForMotionSettled } from '../../utils/animation';

test.describe('Pixel — Admin', () => {
  test('admin login screen', async ({ page, adminPage }) => {
    await adminPage.gotoLogin();
    await waitForMotionSettled(page);
    await assertPixelPerfect(page, 'admin-login');
  });

  test('admin dashboard', async ({ page, adminPage }) => {
    await adminPage.login();
    await waitForMotionSettled(page);
    await assertPixelPerfect(page.getByTestId('admin-dashboard'), 'admin-dashboard');
  });
});
