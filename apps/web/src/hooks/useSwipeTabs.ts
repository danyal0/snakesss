import { useCallback, useEffect, useRef, useState } from 'react';

const SWIPE_THRESHOLD_PX = 48;
const MAX_VERTICAL_DRIFT_PX = 80;

/**
 * Touch swipe between ordered tabs with live drag preview (e.g. game players / chat / vote).
 */
export function useSwipeTabs<T extends string>(
  tabs: readonly T[],
  activeTab: T,
  setActiveTab: (tab: T) => void
) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const activeTabRef = useRef(activeTab);

  activeTabRef.current = activeTab;

  const activeIndex = tabs.indexOf(activeTab);

  /** Clear drag offset when tab changes programmatically (phase switch, round change). */
  const resetDrag = useCallback(() => {
    touchStart.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }, []);

  useEffect(() => {
    resetDrag();
  }, [activeTab, resetDrag]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY };
    setIsDragging(true);
    setDragOffset(0);
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStart.current;
      if (!start) return;
      const t = e.touches[0];
      if (!t) return;

      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dy) > MAX_VERTICAL_DRIFT_PX && Math.abs(dx) < Math.abs(dy)) return;

      const idx = tabs.indexOf(activeTabRef.current);
      if (idx < 0) return;

      let offset = dx;
      if (idx === 0 && offset > 0) offset *= 0.35;
      if (idx === tabs.length - 1 && offset < 0) offset *= 0.35;

      setDragOffset(offset);
    },
    [tabs]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStart.current;
      touchStart.current = null;
      setIsDragging(false);

      if (!start) {
        setDragOffset(0);
        return;
      }

      const t = e.changedTouches[0];
      if (!t) {
        setDragOffset(0);
        return;
      }

      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dy) > MAX_VERTICAL_DRIFT_PX) {
        setDragOffset(0);
        return;
      }
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX) {
        setDragOffset(0);
        return;
      }

      const idx = tabs.indexOf(activeTabRef.current);
      if (idx < 0) {
        setDragOffset(0);
        return;
      }

      if (dx < 0 && idx < tabs.length - 1) {
        setActiveTab(tabs[idx + 1]!);
      } else if (dx > 0 && idx > 0) {
        setActiveTab(tabs[idx - 1]!);
      }

      setDragOffset(0);
    },
    [tabs, setActiveTab]
  );

  const onTouchCancel = useCallback(() => {
    touchStart.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }, []);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    dragOffset,
    isDragging,
    activeIndex: activeIndex < 0 ? 0 : activeIndex,
    resetDrag,
  };
}
