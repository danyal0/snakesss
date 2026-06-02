import type { Page } from '@playwright/test';

export async function resetBrowserState(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      window.__SNAKESS_TEST__?.resetStore();
    });
  } catch {
    // Page may be on about:blank during teardown
  }
  await page.context().clearCookies();
}

export async function prepareTestPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    document.documentElement.classList.add('e2e-reduce-motion');
  });
}

export async function settleTestHarness(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__SNAKESS_TEST__?.setReducedMotion(true);
  });
}
