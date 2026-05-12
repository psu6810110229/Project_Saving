/**
 * Tiny haptics helper. Wraps navigator.vibrate so callers don't have
 * to check for support at every call site. iOS Safari does not yet
 * support vibrate, so feature-detect and no-op silently instead of
 * throwing.
 *
 * Patterns are intentionally short and discrete so they don't feel
 * obnoxious on Android — see UX guidelines on Material's haptic
 * documentation. We never run a vibration longer than 30 ms in a
 * single pulse.
 */

export type HapticIntent =
  /** Light tap: confirms a write hit the server (add money / save bucket). */
  | 'success'
  /** Heavier double-pulse: a streak or 100 % milestone fired. */
  | 'milestone';

const PATTERNS: Record<HapticIntent, number | number[]> = {
  success: 12,
  milestone: [10, 50, 10],
};

export function haptic(intent: HapticIntent): void {
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(PATTERNS[intent]);
  } catch {
    // Some browsers throw on the first call if user hasn't interacted
    // with the page yet — swallow the error rather than break UX.
  }
}
