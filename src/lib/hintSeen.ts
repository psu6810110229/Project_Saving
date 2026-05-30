/**
 * Tiny localStorage-backed "seen" flags for one-time, low-stakes UI hints
 * (e.g. the edit-mode reorder coach). Device-local on purpose: these hints
 * are cheap to re-teach and not worth a profile column / network round-trip.
 * Account-level hints that should sync across devices (like the
 * drag-to-transfer hint) keep their own `profiles` column instead.
 *
 * All access is guarded — Safari private mode and locked-down WebViews throw
 * on `localStorage`, in which case a hint simply shows every time rather than
 * breaking the page.
 */

const PREFIX = 'go-out:hint-seen:';

export function hasSeenHint(key: string): boolean {
  try {
    return window.localStorage.getItem(PREFIX + key) != null;
  } catch {
    return false;
  }
}

export function markHintSeen(key: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, new Date().toISOString());
  } catch {
    /* storage unavailable — the hint just won't be remembered */
  }
}

/** localStorage key suffix for the edit-mode reorder/remove/edit coach. */
export const BUCKET_EDIT_HINT_KEY = 'bucket-edit-hint';
