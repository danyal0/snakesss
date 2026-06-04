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
 * Horizontal swipe carousel. Transform is based on viewport width (px) so slides
 * stay aligned; inactive slides remain in the layout but are clipped by overflow.
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
  const count = Math.max(1, slideCount);
  const safeIndex = Math.min(Math.max(0, activeIndex), count - 1);
  const items = React.Children.toArray(children);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setViewportWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const slideWidth = viewportWidth > 0 ? viewportWidth : undefined;
  const translateX =
    slideWidth != null
      ? -safeIndex * slideWidth + dragOffset
      : `calc(-${(safeIndex * 100) / count}% + ${dragOffset}px)`;

  return (
    <div
      ref={viewportRef}
      data-testid={testId}
      className={clsx('overflow-hidden flex-1 min-h-0 touch-pan-y', className)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      <div
        className={clsx('flex h-full', trackClassName)}
        style={{
          width: slideWidth != null ? slideWidth * count : `${count * 100}%`,
          transform:
            typeof translateX === 'number'
              ? `translate3d(${translateX}px, 0, 0)`
              : `translate3d(${translateX}, 0, 0)`,
          transition: isDragging ? 'none' : 'transform 0.25s ease-out',
          willChange: 'transform',
        }}
      >
        {items.map((child, index) => {
          const isActive = index === safeIndex;
          return (
            <div
              key={index}
              aria-hidden={!isActive}
              className={clsx(
                'h-full flex-shrink-0 min-h-0 overflow-hidden',
                !isActive && !isDragging && 'pointer-events-none'
              )}
              style={{
                width: slideWidth ?? `${100 / count}%`,
              }}
            >
              {child}
            </div>
          );
        })}
      </div>
    </div>
  );
}
