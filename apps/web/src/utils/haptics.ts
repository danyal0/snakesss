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

/** Android / desktop Chrome vibration patterns (milliseconds). */
const VIBRATE_PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 15,
  toggle: 18,
  select: 22,
  confirm: 35,
  success: [18, 45, 22],
  warning: [25, 40, 25],
  reveal: [15, 35, 18],
  elimination: [30, 55, 35],
  error: [35, 50, 35],
};

let hapticsMuted = false;

/** Last trigger for tests / debugging (E2E). */
const hapticLog: { kind: HapticKind; channel: 'vibrate' | 'ios-switch' }[] = [];

export function getHapticLog(): ReadonlyArray<{ kind: HapticKind; channel: 'vibrate' | 'ios-switch' }> {
  return hapticLog;
}

export function clearHapticLog(): void {
  hapticLog.length = 0;
}

function isHapticsOptedOut(): boolean {
  if (typeof window === 'undefined') return true;
  if (hapticsMuted) return true;
  try {
    if (localStorage.getItem('snakesss_haptics') === 'off') return true;
  } catch {
    // ignore
  }
  return false;
}

function isIOSWebKitWithoutVibrate(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const ios =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && !('vibrate' in navigator);
}

/** Safari 18+ — native Taptic pulse via ephemeral `switch` checkbox toggle. */
function iosSwitchHaptic(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText =
      'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;overflow:hidden;';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');

    label.appendChild(input);
    document.body.appendChild(label);
    label.click();
    document.body.removeChild(label);
    return true;
  } catch {
    return false;
  }
}

function vibratePattern(kind: HapticKind): boolean {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return false;
  try {
    const pattern = VIBRATE_PATTERNS[kind];
    const ok = navigator.vibrate(pattern);
    return ok !== false;
  } catch {
    return false;
  }
}

/**
 * Tactile feedback for taps and game events.
 * - Android / desktop: `navigator.vibrate`
 * - iOS Safari 18+: ephemeral `switch` checkbox pulse
 * Respects explicit opt-out (`snakesss_haptics=off`), not Reduce Motion (independent accessibility setting).
 */
export function triggerHaptic(kind: HapticKind = 'tap'): void {
  if (isHapticsOptedOut()) return;

  if (vibratePattern(kind)) {
    hapticLog.push({ kind, channel: 'vibrate' });
    return;
  }

  if (isIOSWebKitWithoutVibrate() && iosSwitchHaptic()) {
    hapticLog.push({ kind, channel: 'ios-switch' });
  }
}

export function setHapticsMuted(muted: boolean): void {
  hapticsMuted = muted;
}

export function isHapticFeedbackAvailable(): boolean {
  if (isHapticsOptedOut()) return false;
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) return true;
  return isIOSWebKitWithoutVibrate();
}
