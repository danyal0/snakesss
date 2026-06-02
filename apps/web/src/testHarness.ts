import { useGameStore } from './store/gameStore';

export interface SnakesssTestHarness {
  getStore: () => ReturnType<typeof useGameStore.getState>;
  resetStore: () => void;
  setReducedMotion: (enabled: boolean) => void;
  waitForAnimations: (ms?: number) => Promise<void>;
  advanceIdle: (ms: number) => Promise<void>;
  getInteractionMap: () => InteractionMapEntry[];
  version: string;
}

export interface InteractionMapEntry {
  selector: string;
  tag: string;
  visible: boolean;
  hasClick: boolean;
  hasKeyHandler: boolean;
  disabled: boolean;
  ariaLabel: string | null;
  /** Inside a carousel slide hidden via aria-hidden (not dead UI). */
  inHiddenSlide: boolean;
}

declare global {
  interface Window {
    __SNAKESS_TEST__?: SnakesssTestHarness;
  }
}

function collectInteractionMap(): InteractionMapEntry[] {
  const interactive = document.querySelectorAll(
    'button, a[href], input, textarea, select, [role="button"], [role="switch"], [onclick], [tabindex]:not([tabindex="-1"])'
  );
  return Array.from(interactive).map((el, i) => {
    const html = el as HTMLElement;
    const rect = html.getBoundingClientRect();
    const style = window.getComputedStyle(html);
    let hiddenByAncestor = false;
    for (let node: HTMLElement | null = html.parentElement; node; node = node.parentElement) {
      if (node.getAttribute('aria-hidden') === 'true') {
        hiddenByAncestor = true;
        break;
      }
      const nodeStyle = window.getComputedStyle(node);
      if (nodeStyle.visibility === 'hidden' || nodeStyle.display === 'none') {
        hiddenByAncestor = true;
        break;
      }
    }
    const visible =
      !hiddenByAncestor &&
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      parseFloat(style.opacity) > 0.01;

    const hasClick =
      html.onclick != null ||
      html.getAttribute('onclick') != null ||
      html.tagName === 'BUTTON' ||
      html.tagName === 'A';

    return {
      selector: `[data-testid="${html.dataset.testid}"]` || `${html.tagName.toLowerCase()}:nth-of-type(${i + 1})`,
      tag: html.tagName.toLowerCase(),
      visible,
      hasClick,
      hasKeyHandler: html.onkeydown != null,
      disabled:
        (html as HTMLButtonElement).disabled === true ||
        html.getAttribute('aria-disabled') === 'true',
      ariaLabel: html.getAttribute('aria-label'),
      inHiddenSlide: hiddenByAncestor,
    };
  });
}

export function installTestHarness(): void {
  if (typeof window === 'undefined') return;

  const harness: SnakesssTestHarness = {
    version: '1.0.0',
    getStore: () => useGameStore.getState(),
    resetStore: () => useGameStore.getState().reset(),
    setReducedMotion: (enabled) => {
      document.documentElement.classList.toggle('e2e-reduce-motion', enabled);
      document.documentElement.style.setProperty(
        'prefers-reduced-motion',
        enabled ? 'reduce' : 'no-preference'
      );
    },
    waitForAnimations: async (ms = 400) => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });
      if (ms > 0) await new Promise((r) => setTimeout(r, ms));
    },
    advanceIdle: async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
    },
    getInteractionMap: collectInteractionMap,
  };

  window.__SNAKESS_TEST__ = harness;
  document.documentElement.setAttribute('data-e2e', 'true');
  harness.setReducedMotion(true);
}
