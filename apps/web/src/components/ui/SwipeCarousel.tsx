import React, { useRef, useState, useLayoutEffect } from 'react';
import clsx from 'clsx';

export interface SwipeCarouselProps {
  activeIndex: number;
  slideCount: number;
  dragOffset?: number;
  isDragging?: boolean;
  className?: string;
  trackClassName?: string;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  onTouchCancel?: (e: React.TouchEvent) => void;
  testId?: string;
  children: React.ReactNode;
}

/**
 * Standard horizontal pager: fixed-width slides + translate3d track.
 * Drag offset follows the finger; release snaps via parent tab index.
 */
export function SwipeCarousel({
  activeIndex,
  slideCount,
  dragOffset = 0,
  isDragging = false,
  className,
  trackClassName,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  testId,
  children,
}: SwipeCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const lastWidthRef = useRef(0);
  const count = Math.max(1, slideCount);
  const safeIndex = Math.min(Math.max(0, activeIndex), count - 1);
  const items = React.Children.toArray(children);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) {
        lastWidthRef.current = w;
        setViewportWidth(w);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (isDragging) return;
    const el = viewportRef.current;
    if (!el || el.clientWidth <= 0) return;
    lastWidthRef.current = el.clientWidth;
    setViewportWidth(el.clientWidth);
  }, [safeIndex, isDragging]);

  const slideWidth = viewportWidth > 0 ? viewportWidth : lastWidthRef.current;
  const trackWidth = slideWidth > 0 ? slideWidth * count : undefined;
  const translateX =
    slideWidth > 0 ? -safeIndex * slideWidth + dragOffset : 0;

  return (
    <div
      ref={viewportRef}
      data-testid={testId}
      className={clsx('overflow-hidden flex-1 min-h-0 w-full', className)}
      style={{ touchAction: 'pan-y', contain: 'layout' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      <div
        className={clsx('flex h-full', trackClassName)}
        style={{
          width: trackWidth ?? `${count * 100}%`,
          transform:
            slideWidth > 0
              ? `translate3d(${translateX}px, 0, 0)`
              : `translate3d(-${(safeIndex * 100) / count}%, 0, 0)`,
          transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          willChange: 'transform',
        }}
      >
        {items.map((child, index) => (
          <div
            key={index}
            aria-hidden={index !== safeIndex}
            className="h-full w-full min-w-0 flex-shrink-0 overflow-hidden"
            style={{
              width: slideWidth > 0 ? slideWidth : `${100 / count}%`,
              maxWidth: slideWidth > 0 ? slideWidth : undefined,
            }}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
