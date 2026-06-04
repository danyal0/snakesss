import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  triggerHaptic,
  clearHapticLog,
  getHapticLog,
  setHapticsMuted,
  isHapticFeedbackAvailable,
} from './haptics';

describe('haptics', () => {
  beforeEach(() => {
    clearHapticLog();
    setHapticsMuted(false);
    localStorage.removeItem('snakesss_haptics');
    vi.stubGlobal('navigator', {
      ...navigator,
      vibrate: vi.fn(() => true),
      userAgent: 'Chrome',
      platform: 'Linux',
      maxTouchPoints: 0,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls navigator.vibrate with tap pattern', () => {
    triggerHaptic('tap');
    expect(navigator.vibrate).toHaveBeenCalledWith(15);
    expect(getHapticLog()).toEqual([{ kind: 'tap', channel: 'vibrate' }]);
  });

  it('respects explicit opt-out in localStorage', () => {
    localStorage.setItem('snakesss_haptics', 'off');
    triggerHaptic('confirm');
    expect(navigator.vibrate).not.toHaveBeenCalled();
    expect(getHapticLog()).toHaveLength(0);
  });

  it('does not block when prefers-reduced-motion is set', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
    triggerHaptic('tap');
    expect(navigator.vibrate).toHaveBeenCalled();
  });

  it('reports availability when vibrate exists', () => {
    expect(isHapticFeedbackAvailable()).toBe(true);
  });
});
