import type { Page } from '@playwright/test';

/** Dismiss role reveal / other fullscreen blockers so tabs are clickable. */
export async function dismissBlockingGameOverlays(page: Page): Promise<void> {
  const dismiss = page.getByRole('button', { name: /I Understand/i });
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
    return;
  }

  await page.evaluate(() => {
    const store = window.__SNAKESS_TEST__?.getStore();
    if (store) {
      store.setShowRoleReveal(false);
      store.setShowElimination(false);
    }
  });
}
