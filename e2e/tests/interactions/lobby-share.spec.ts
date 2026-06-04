import { test, expect } from '../../fixtures/test-fixture';

test.describe('Lobby room link', () => {
  test('clicking room code copies invite link to clipboard', async ({ page, e2eRoomId }) => {
    await expect(page.getByTestId('lobby-screen')).toBeVisible();
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.getByTestId('room-code').click();

    await expect(page.getByTestId('room-code-copied')).toBeVisible({ timeout: 5_000 });

    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain(`/room/${e2eRoomId}`);
    expect(clip).toMatch(/^https?:\/\//);
  });

  test('share link button copies invite link when Web Share unavailable', async ({
    page,
    e2eRoomId,
  }) => {
    await page.addInitScript(() => {
      delete (navigator as Navigator & { share?: unknown }).share;
    });
    await page.reload();
    await expect(page.getByTestId('lobby-screen')).toBeVisible({ timeout: 20_000 });
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.getByTestId('btn-share-link').click();
    await expect(page.getByTestId('room-code-copied')).toBeVisible({ timeout: 5_000 });

    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain(`/room/${e2eRoomId}`);
  });

  test('lobby has share link button and no separate copy button', async ({ page, e2eRoomId }) => {
    await expect(page.getByTestId('btn-share-link')).toHaveText('Share Link');
    await expect(page.getByRole('button', { name: /^Copy$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Link$/i })).toHaveCount(0);
  });
});
