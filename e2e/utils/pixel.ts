import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { PIXEL_SNAPSHOT } from '../../playwright.config';

const DYNAMIC_MASKS = [
  '[data-testid="leaderboard-widget"]',
  '[data-testid="phase-badge"]',
  '.animate-pulse',
  '.animate-spin',
  '[class*="animate-"]',
  '[data-testid="room-code"]',
];

export async function assertPixelPerfect(
  page: Page,
  name: string,
  options?: { locator?: Locator; maskDynamic?: boolean }
): Promise<void> {
  const target = options?.locator ?? page;
  const mask =
    options?.maskDynamic !== false
      ? DYNAMIC_MASKS.map((s) => page.locator(s))
      : [];

  await expect(target).toHaveScreenshot(`${name}.png`, {
    ...PIXEL_SNAPSHOT,
    mask,
    caret: 'hide',
    scale: 'css',
    maxDiffPixelRatio: 0.001,
  });
}

/** Screens with minor dynamic content (timers, lists) — still tight but stable in CI */
export async function assertPixelStable(
  page: Page,
  name: string,
  options?: { locator?: Locator }
): Promise<void> {
  const target = options?.locator ?? page;
  await expect(target).toHaveScreenshot(`${name}.png`, {
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
    maxDiffPixelRatio: 0.02,
    threshold: 0.15,
  });
}
