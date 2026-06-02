import { useEffect } from 'react';

/**
 * Drives the `--app-height` CSS variable from the live viewport so the fixed
 * app frame (AppShell) always matches what is actually on screen.
 *
 * Why this exists: bare `100dvh` can snapshot a stale height after a
 * *programmatic* reload — e.g. the service-worker update reload in an
 * installed PWA — and then never fire a resize event to correct itself,
 * leaving the bottom nav clipped below the fold until a manual refresh.
 * Re-measuring `window.innerHeight` on mount (immediately, on the next frame,
 * and shortly after to catch the viewport settling) plus on every relevant
 * viewport event keeps the frame honest. `100dvh` stays the CSS fallback for
 * the first paint before this runs.
 *
 * `window.innerHeight` (layout viewport) is used rather than
 * `visualViewport.height` so an on-screen keyboard does not shrink the frame.
 */
export function useAppHeight(): void {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      root.style.setProperty('--app-height', `${window.innerHeight}px`);
    };

    apply();
    // A programmatic reload can paint before the viewport settles; remeasure
    // on the next frame and again shortly after to catch the settle.
    const raf = window.requestAnimationFrame(apply);
    const settleTimeout = window.setTimeout(apply, 300);

    const visualViewport = window.visualViewport;
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    window.addEventListener('pageshow', apply);
    visualViewport?.addEventListener('resize', apply);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(settleTimeout);
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
      window.removeEventListener('pageshow', apply);
      visualViewport?.removeEventListener('resize', apply);
    };
  }, []);
}
