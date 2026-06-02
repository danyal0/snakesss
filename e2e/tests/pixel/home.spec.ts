import { test, expect } from '../../fixtures/test-fixture';
import { assertPixelPerfect, assertPixelStable } from '../../utils/pixel';
import { waitForMotionSettled } from '../../utils/animation';
import { createE2ERoom } from '../../utils/seed';

test.describe('Pixel — Home', () => {
  test.beforeEach(async ({ homePage }) => {
    await homePage.goto();
    await waitForMotionSettled(homePage.page, 500);
  });

  test('home screen matches baseline', async ({ page }) => {
    await expect(page.getByText('Connected')).toBeVisible();
    await assertPixelPerfect(page, 'home-default', { maskDynamic: true });
  });

  test('create room form matches baseline', async ({ page }) => {
    await page.getByTestId('btn-create-room').click();
    await page.getByTestId('create-room-form').waitFor();
    await waitForMotionSettled(page);
    await assertPixelStable(page.getByTestId('create-room-form'), 'home-create-form');
  });
});

test.describe('Pixel — Public & Leaderboard', () => {
  test('public rooms screen layout', async ({ page, homePage }) => {
    await homePage.goto();
    await page.getByTestId('btn-browse-rooms').click();
    await expect(page.getByTestId('public-rooms-screen')).toBeVisible();
    await expect(page.getByRole('button', { name: /Refresh|Create/i }).first()).toBeVisible();
  });

  test('leaderboard screen', async ({ page, homePage }) => {
    await homePage.goto();
    await page.getByTestId('btn-leaderboard').click();
    await page.getByTestId('leaderboard-screen').waitFor();
    await waitForMotionSettled(page);
    await assertPixelPerfect(page, 'leaderboard');
  });
});
