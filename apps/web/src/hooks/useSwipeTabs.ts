import { useCallback, useRef } from 'react';

const SWIPE_THRESHOLD_PX = 48;
const MAX_VERTICAL_DRIFT_PX = 80;

/**
 * Touch swipe between ordered tabs (e.g. lobby players / bots / settings).
 */
export function useSwipeTabs<T extends string>(
  tabs: readonly T[],
  activeTab: T,
  setActiveTab: (tab: T) => void
) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStart.current;
      touchStart.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      if (!t) return;

      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dy) > MAX_VERTICAL_DRIFT_PX) return;
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;

      const idx = tabs.indexOf(activeTab);
      if (idx < 0) return;

      if (dx < 0 && idx < tabs.length - 1) {
        setActiveTab(tabs[idx + 1]!);
      } else if (dx > 0 && idx > 0) {
        setActiveTab(tabs[idx - 1]!);
      }
    },
    [tabs, activeTab, setActiveTab]
  );

  return { onTouchStart, onTouchEnd };
}
