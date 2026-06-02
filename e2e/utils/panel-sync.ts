import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

const GAME_PANELS = ['players', 'chat', 'vote'] as const;
const LOBBY_PANELS = ['players', 'bots', 'settings'] as const;

/** Assert highlighted tab index matches visible carousel panel (no desync). */
export async function expectGameTabMatchesPanel(
  page: Page,
  expectedTab: (typeof GAME_PANELS)[number]
): Promise<void> {
  const expectedIndex = GAME_PANELS.indexOf(expectedTab);
  await expect(page.getByTestId(`game-tab-${expectedTab}`)).toHaveClass(/text-white/);

  const sync = await page.evaluate(
    ({ expectedIndex, panels }) => {
      const carousel = document.querySelector('[data-active-panel][data-carousel-index]');
      const idx = Number(carousel?.getAttribute('data-carousel-index'));
      const active = carousel?.getAttribute('data-active-panel');
      return {
        ok: idx === expectedIndex && active === panels[expectedIndex],
        idx,
        active,
      };
    },
    { expectedIndex, panels: [...GAME_PANELS] }
  );

  expect(sync.ok, `tab/panel desync: ${JSON.stringify(sync)}`).toBe(true);

  await expect(page.getByTestId(`game-panel-${expectedTab}`)).toBeVisible();
  await expect(page.getByTestId(`game-panel-${expectedTab}`)).toHaveAttribute(
    'data-panel-visible',
    'true'
  );

  for (const panel of GAME_PANELS) {
    if (panel === expectedTab) continue;
    await expect(page.getByTestId(`game-panel-${panel}`)).toHaveCount(0);
  }
}

export async function expectLobbyTabMatchesPanel(
  page: Page,
  expectedTab: (typeof LOBBY_PANELS)[number]
): Promise<void> {
  const expectedIndex = LOBBY_PANELS.indexOf(expectedTab);
  await expect(page.getByTestId(`lobby-tab-${expectedTab}`)).toHaveClass(/text-white/);

  await expect(page.getByTestId(`lobby-panel-${expectedTab}`)).toBeVisible();
  await expect(page.getByTestId(`lobby-panel-${expectedTab}`)).toHaveAttribute(
    'data-panel-visible',
    'true'
  );

  const sync = await page.evaluate(
    ({ expectedIndex, panels }) => {
      const root = document.querySelector('[data-active-tab]');
      const idx = Number(root?.getAttribute('data-carousel-index'));
      const active = root?.getAttribute('data-active-tab');
      return { ok: idx === expectedIndex && active === panels[expectedIndex], idx, active };
    },
    { expectedIndex, panels: [...LOBBY_PANELS] }
  );

  expect(sync.ok, `lobby tab desync: ${JSON.stringify(sync)}`).toBe(true);
}
