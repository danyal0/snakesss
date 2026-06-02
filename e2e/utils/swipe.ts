import type { Page, Locator } from '@playwright/test';

/** Dispatch touch events so React onTouch* handlers fire (mouse does not). */
export async function swipeHorizontal(
  page: Page,
  target: Locator,
  direction: 'left' | 'right',
  distancePx = 140
): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error('Swipe target has no bounding box');

  const y = box.y + box.height / 2;
  const startX =
    direction === 'left' ? box.x + box.width * 0.78 : box.x + box.width * 0.22;
  const endX = direction === 'left' ? startX - distancePx : startX + distancePx;

  await target.dispatchEvent('touchstart', {
    touches: [{ clientX: startX, clientY: y, identifier: 0 }],
    targetTouches: [{ clientX: startX, clientY: y, identifier: 0 }],
    changedTouches: [{ clientX: startX, clientY: y, identifier: 0 }],
  });

  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    const x = startX + ((endX - startX) * i) / steps;
    await target.dispatchEvent('touchmove', {
      touches: [{ clientX: x, clientY: y, identifier: 0 }],
      targetTouches: [{ clientX: x, clientY: y, identifier: 0 }],
      changedTouches: [{ clientX: x, clientY: y, identifier: 0 }],
    });
  }

  await target.dispatchEvent('touchend', {
    touches: [],
    changedTouches: [{ clientX: endX, clientY: y, identifier: 0 }],
  });
}

/** Vertical swipe on a scrollable panel (finger moves up = scroll down). */
export async function swipeVertical(
  page: Page,
  target: Locator,
  direction: 'up' | 'down',
  distancePx = 120
): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error('Swipe target has no bounding box');

  const x = box.x + box.width / 2;
  const startY =
    direction === 'down' ? box.y + box.height * 0.28 : box.y + box.height * 0.72;
  const endY = direction === 'down' ? startY - distancePx : startY + distancePx;

  await target.dispatchEvent('touchstart', {
    touches: [{ clientX: x, clientY: startY, identifier: 0 }],
    targetTouches: [{ clientX: x, clientY: startY, identifier: 0 }],
    changedTouches: [{ clientX: x, clientY: startY, identifier: 0 }],
  });

  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    const y = startY + ((endY - startY) * i) / steps;
    await target.dispatchEvent('touchmove', {
      touches: [{ clientX: x, clientY: y, identifier: 0 }],
      targetTouches: [{ clientX: x, clientY: y, identifier: 0 }],
      changedTouches: [{ clientX: x, clientY: y, identifier: 0 }],
    });
  }

  await target.dispatchEvent('touchend', {
    touches: [],
    changedTouches: [{ clientX: x, clientY: endY, identifier: 0 }],
  });
}
