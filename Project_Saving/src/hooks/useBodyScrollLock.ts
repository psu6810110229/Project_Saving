import { useEffect } from 'react';

/**
 * Locks document.body scrolling while `active` is true. Used by the
 * Modal component so mobile users cannot scroll the page underneath
 * an open dialog (which was the §9 mobile bug — taps on background
 * leaked through and scrolled the dashboard).
 *
 * Implementation notes:
 * - Saves and restores the previous overflow value so nested usage
 *   (rare) and unmounting before the modal closes are safe.
 * - Compensates for the disappearing scrollbar on desktop by adding
 *   padding-right matching the scrollbar width — without this the
 *   page jumps when a modal opens.
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const body = document.body;
    const html = document.documentElement;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - html.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [active]);
}
