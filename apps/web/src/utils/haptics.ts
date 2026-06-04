export type HapticKind =
  | 'tap'
  | 'toggle'
  | 'select'
  | 'confirm'
  | 'success'
  | 'warning'
  | 'reveal'
  | 'elimination'
  | 'error';

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  toggle: 12,
  select: 14,
  confirm: 22,
  success: [12, 40, 18],
  warning: [18, 30, 18],
  reveal: [10, 30, 14],
  elimination: [24, 50, 28],
  error: [30, 40, 30],
};

let hapticsMuted = false;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function hapticsDisabled(): boolean {
  if (typeof window === 'undefined') return true;
  if (hapticsMuted) return true;
  if (prefersReducedMotion()) return true;
  try {
    const stored = localStorage.getItem('snakesss_haptics');
    if (stored === 'off') return true;
  } catch {
    // ignore
  }
  return false;
}

/** Call from UI actions for Apple-style tactile feedback (web vibration fallback). */
export function triggerHaptic(kind: HapticKind = 'tap'): void {
  if (hapticsDisabled()) return;
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // unsupported or blocked
  }
}

export function setHapticsMuted(muted: boolean): void {
  hapticsMuted = muted;
}
