import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export interface DomAuditResult {
  orphanVisible: string[];
  hiddenWithHandlers: string[];
  visibleWithoutHandlers: string[];
}

export async function auditDomInteractions(page: Page): Promise<DomAuditResult> {
  return page.evaluate(() => {
    const map = window.__SNAKESS_TEST__?.getInteractionMap() ?? [];
    const orphanVisible: string[] = [];
    const hiddenWithHandlers: string[] = [];
    const visibleWithoutHandlers: string[] = [];

    for (const entry of map) {
      if (!entry.visible && entry.hasClick) {
        hiddenWithHandlers.push(entry.selector);
      }
      if (entry.visible && !entry.hasClick && !entry.hasKeyHandler && entry.tag === 'div') {
        visibleWithoutHandlers.push(entry.selector);
      }
    }

    const testIds = new Set(
      Array.from(document.querySelectorAll('[data-testid]')).map(
        (el) => (el as HTMLElement).dataset.testid
      )
    );
    for (const id of testIds) {
      if (!id) continue;
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        orphanVisible.push(id);
      }
    }

    return { orphanVisible, hiddenWithHandlers, visibleWithoutHandlers };
  });
}

export async function assertNoDeadUI(page: Page): Promise<void> {
  const audit = await auditDomInteractions(page);
  expect(audit.hiddenWithHandlers, 'hidden elements with click handlers').toEqual([]);
  expect(audit.orphanVisible, 'testid elements with zero size').toEqual([]);
}
