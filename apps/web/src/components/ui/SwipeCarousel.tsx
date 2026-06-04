import React from 'react';
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
  /** Applied to the touch viewport (overflow clip container). */
  testId?: string;
  children: React.ReactNode;
}

/**
 * Horizontal swipe carousel. Each slide is one viewport width; transform uses
 * track-relative % so index 1 does not jump to the last slide (common -100% bug).
 * Inactive slides are visibility:hidden until drag so off-screen controls are not focusable.
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
  const count = Math.max(1, slideCount);
  const safeIndex = Math.min(Math.max(0, activeIndex), count - 1);
  const slideWidthPercent = 100 / count;
  const offsetPercent = safeIndex * slideWidthPercent;
  const items = React.Children.toArray(children);

  return (
    <div
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
          width: `${count * 100}%`,
          transform: `translateX(calc(-${offsetPercent}% + ${dragOffset}px))`,
          transition: isDragging ? 'none' : 'transform 0.25s ease-out',
        }}
      >
        {items.map((child, index) => {
          const isActive = index === safeIndex;
          const showSlide = isDragging || isActive;
          return (
            <div
              key={index}
              aria-hidden={!isActive && !isDragging}
              className={clsx(
                'h-full flex-shrink-0 min-h-0 overflow-hidden',
                !showSlide && 'pointer-events-none invisible'
              )}
              style={{ width: `${slideWidthPercent}%` }}
            >
              {child}
            </div>
          );
        })}
      </div>
    </div>
  );
}
