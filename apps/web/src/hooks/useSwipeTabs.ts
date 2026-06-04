import { useCallback, useEffect, useRef, useState } from 'react';

const SWIPE_THRESHOLD_PX = 48;
const AXIS_LOCK_PX = 12;
const HORIZONTAL_BIAS = 1.35;

type GestureAxis = 'none' | 'horizontal' | 'vertical';
type Point = { x: number; y: number };

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

function isSwipeDisabledTarget(target: EventTarget | null): boolean {
  let node = target instanceof HTMLElement ? target : null;
  while (node) {
    if (node.dataset.noSwipe !== undefined) return true;
    const tag = node.tagName;
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      return true;
    }
    if (tag === 'A' && node.hasAttribute('href')) return true;
    if (node.getAttribute('role') === 'button' || node.getAttribute('role') === 'switch') {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * Touch + mouse swipe between ordered tabs with live drag preview.
 * Touch uses touch handlers; mouse/pen uses pointer handlers (same axis lock rules).
 */
export function useSwipeTabs<T extends string>(
  tabs: readonly T[],
  activeTab: T,
  setActiveTab: (tab: T) => void,
  options?: { scrollableBias?: boolean }
) {
  const scrollableBias = options?.scrollableBias !== false;
  const gestureStart = useRef<Point | null>(null);
  const scrollableTouchTarget = useRef<HTMLElement | null>(null);
  const gestureAxis = useRef<GestureAxis>('none');
  const pointerIdRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const activeTabRef = useRef(activeTab);

  activeTabRef.current = activeTab;

  const activeIndex = tabs.indexOf(activeTab);

  const resetGesture = useCallback(() => {
    gestureStart.current = null;
    scrollableTouchTarget.current = null;
    gestureAxis.current = 'none';
    pointerIdRef.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }, []);

  const resetDrag = resetGesture;

  useEffect(() => {
    resetGesture();
  }, [activeTab, resetGesture]);

  const beginGesture = useCallback((x: number, y: number, target: EventTarget | null) => {
    if (isSwipeDisabledTarget(target)) {
      gestureStart.current = null;
      scrollableTouchTarget.current = null;
      gestureAxis.current = 'none';
      return false;
    }
    gestureStart.current = { x, y };
    scrollableTouchTarget.current = findScrollableAncestor(target);
    gestureAxis.current = 'none';
    setIsDragging(false);
    setDragOffset(0);
    return true;
  }, []);

  const moveGesture = useCallback(
    (x: number, y: number, preventDefault?: () => void) => {
      const start = gestureStart.current;
      if (!start) return;

      const dx = x - start.x;
      const dy = y - start.y;

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

      if (gestureAxis.current === 'horizontal') preventDefault?.();

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

  const endGesture = useCallback(
    (x: number) => {
      const start = gestureStart.current;
      const axis = gestureAxis.current;
      gestureStart.current = null;
      gestureAxis.current = 'none';
      pointerIdRef.current = null;
      setIsDragging(false);

      if (!start || axis === 'vertical') {
        setDragOffset(0);
        return;
      }

      const dx = x - start.x;
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

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      beginGesture(t.clientX, t.clientY, e.target);
    },
    [beginGesture]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      moveGesture(t.clientX, t.clientY, () => {
        if (e.cancelable) e.preventDefault();
      });
    },
    [moveGesture]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const t = e.changedTouches[0];
      endGesture(t?.clientX ?? gestureStart.current?.x ?? 0);
    },
    [endGesture]
  );

  const onTouchCancel = useCallback(() => {
    resetGesture();
  }, [resetGesture]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'touch' || e.button !== 0 || !e.isPrimary) return;
      if (!beginGesture(e.clientX, e.clientY, e.target)) return;
      pointerIdRef.current = e.pointerId;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [beginGesture]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (pointerIdRef.current !== e.pointerId) return;
      moveGesture(e.clientX, e.clientY, () => {
        if (e.cancelable) e.preventDefault();
      });
    },
    [moveGesture]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (pointerIdRef.current !== e.pointerId) return;
      endGesture(e.clientX);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [endGesture]
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      if (pointerIdRef.current !== e.pointerId) return;
      resetGesture();
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [resetGesture]
  );

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    dragOffset,
    isDragging,
    activeIndex: activeIndex < 0 ? 0 : activeIndex,
    resetDrag,
  };
}
