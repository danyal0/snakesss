import type { Page } from '@playwright/test';

export async function syncAnimationFrames(page: Page, frames = 2): Promise<void> {
  await page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    }
  }, frames);
}

export async function waitForMotionSettled(page: Page, ms = 300): Promise<void> {
  await page.evaluate(async (delay) => {
    await window.__SNAKESS_TEST__?.waitForAnimations(delay);
  }, ms);
}

export async function setReducedMotion(page: Page, enabled: boolean): Promise<void> {
  await page.evaluate((on) => {
    window.__SNAKESS_TEST__?.setReducedMotion(on);
  }, enabled);
}
