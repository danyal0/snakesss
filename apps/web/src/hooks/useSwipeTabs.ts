import { useCallback, useEffect, useRef, useState } from 'react';

const SWIPE_THRESHOLD_PX = 48;
const AXIS_LOCK_PX = 12;
const HORIZONTAL_BIAS = 1.35;

type GestureAxis = 'none' | 'horizontal' | 'vertical';

function isVerticallyScrollable(el: HTMLElement): boolean {
  const { overflowY } = getComputedStyle(el);
  if (overflowY !== 'auto' && overflowY !== 'scroll') return false;
  return el.scrollHeight > el.clientHeight + 1;
}

function findScrollableAncestor(target: EventTarget | null): HTMLElement | null {
  let node = target instanceof HTMLElement ? target : null;
  while (node) {
    if (isVerticallyScrollable(node)) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Touch swipe between ordered tabs with live drag preview (e.g. game players / chat / vote).
 * Locks gesture axis so vertical scroll inside panels is not stolen by horizontal tab swipes.
 */
export function useSwipeTabs<T extends string>(
  tabs: readonly T[],
  activeTab: T,
  setActiveTab: (tab: T) => void,
  options?: { scrollableBias?: boolean }
) {
  const scrollableBias = options?.scrollableBias !== false;
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const scrollableTouchTarget = useRef<HTMLElement | null>(null);
  const gestureAxis = useRef<GestureAxis>('none');
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const activeTabRef = useRef(activeTab);

  activeTabRef.current = activeTab;

  const activeIndex = tabs.indexOf(activeTab);

  const resetGesture = useCallback(() => {
    touchStart.current = null;
    scrollableTouchTarget.current = null;
    gestureAxis.current = 'none';
    setIsDragging(false);
    setDragOffset(0);
  }, []);

  /** Clear drag offset when tab changes programmatically (phase switch, round change). */
  const resetDrag = resetGesture;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY };
    scrollableTouchTarget.current = findScrollableAncestor(e.target);
    gestureAxis.current = 'none';
    setIsDragging(false);
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

      if (gestureAxis.current === 'none') {
        if (Math.hypot(dx, dy) < AXIS_LOCK_PX) return;
        const inScrollable = scrollableTouchTarget.current !== null;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (inScrollable && scrollableBias) {
          gestureAxis.current =
            absDx > absDy * HORIZONTAL_BIAS ? 'horizontal' : 'vertical';
        } else {
          gestureAxis.current = absDx > absDy ? 'horizontal' : 'vertical';
        }
      }

      if (gestureAxis.current === 'vertical') return;

      const idx = tabs.indexOf(activeTabRef.current);
      if (idx < 0) return;

      setIsDragging(true);

      let offset = dx;
      if (idx === 0 && offset > 0) offset *= 0.35;
      if (idx === tabs.length - 1 && offset < 0) offset *= 0.35;

      setDragOffset(offset);
    },
    [tabs, scrollableBias]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStart.current;
      const axis = gestureAxis.current;
      touchStart.current = null;
      gestureAxis.current = 'none';
      setIsDragging(false);

      if (!start || axis === 'vertical') {
        setDragOffset(0);
        return;
      }

      const t = e.changedTouches[0];
      if (!t) {
        setDragOffset(0);
        return;
      }

      const dx = t.clientX - start.x;
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
        setDragOffset(0);
        setActiveTab(tabs[idx + 1]!);
      } else if (dx > 0 && idx > 0) {
        setDragOffset(0);
        setActiveTab(tabs[idx - 1]!);
      } else {
        setDragOffset(0);
      }
    },
    [tabs, setActiveTab]
  );

  const onTouchCancel = useCallback(() => {
    resetGesture();
  }, [resetGesture]);

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
