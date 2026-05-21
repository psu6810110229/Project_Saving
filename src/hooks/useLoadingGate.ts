import { useEffect, useRef, useState } from 'react';

/**
 * Coordinates whole-app/auth/project loading surfaces so they avoid flicker
 * and never intentionally hold ready content past the fake-loading cap.
 *
 * - `showAfterMs`: anti-flicker delay before the loader appears. If `loading`
 *   resolves within this window, the loader is never shown.
 * - `minimumVisibleMs`: once the loader is visible, keep it visible for at
 *   least this long so it does not flash off in a single frame.
 * - `maxFakeLoadingMs`: after this much elapsed visible time with `loading`
 *   still true, `fakeLoadingExpired` flips so the UI can swap rotating
 *   presentation copy for honest slow-load copy. The loader stays visible.
 */
interface LoadingGateOptions {
  loading: boolean;
  showAfterMs?: number;
  minimumVisibleMs?: number;
  maxFakeLoadingMs?: number;
}

interface LoadingGateState {
  shouldShowLoader: boolean;
  fakeLoadingExpired: boolean;
}

const DEFAULT_SHOW_AFTER_MS = 150;
const DEFAULT_MINIMUM_VISIBLE_MS = 500;
const DEFAULT_MAX_FAKE_LOADING_MS = 3000;

export function useLoadingGate({
  loading,
  showAfterMs = DEFAULT_SHOW_AFTER_MS,
  minimumVisibleMs = DEFAULT_MINIMUM_VISIBLE_MS,
  maxFakeLoadingMs = DEFAULT_MAX_FAKE_LOADING_MS,
}: LoadingGateOptions): LoadingGateState {
  const [shouldShowLoader, setShouldShowLoader] = useState(false);
  const [fakeLoadingExpired, setFakeLoadingExpired] = useState(false);

  const showTimerRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const expireTimerRef = useRef<number | null>(null);
  const visibleSinceRef = useRef<number | null>(null);

  useEffect(() => {
    const clearShow = () => {
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
    };
    const clearHold = () => {
      if (holdTimerRef.current !== null) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };
    const clearExpire = () => {
      if (expireTimerRef.current !== null) {
        window.clearTimeout(expireTimerRef.current);
        expireTimerRef.current = null;
      }
    };

    if (loading) {
      clearHold();
      if (!shouldShowLoader && showTimerRef.current === null) {
        showTimerRef.current = window.setTimeout(() => {
          showTimerRef.current = null;
          visibleSinceRef.current = Date.now();
          setShouldShowLoader(true);
          expireTimerRef.current = window.setTimeout(() => {
            expireTimerRef.current = null;
            setFakeLoadingExpired(true);
          }, maxFakeLoadingMs);
        }, showAfterMs);
      }
    } else {
      clearShow();
      if (shouldShowLoader && holdTimerRef.current === null) {
        const visibleSince = visibleSinceRef.current ?? Date.now();
        const remaining = Math.max(0, minimumVisibleMs - (Date.now() - visibleSince));
        holdTimerRef.current = window.setTimeout(() => {
          holdTimerRef.current = null;
          visibleSinceRef.current = null;
          clearExpire();
          setShouldShowLoader(false);
          setFakeLoadingExpired(false);
        }, remaining);
      }
    }
  }, [loading, shouldShowLoader, showAfterMs, minimumVisibleMs, maxFakeLoadingMs]);

  useEffect(() => {
    return () => {
      if (showTimerRef.current !== null) window.clearTimeout(showTimerRef.current);
      if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
      if (expireTimerRef.current !== null) window.clearTimeout(expireTimerRef.current);
    };
  }, []);

  return { shouldShowLoader, fakeLoadingExpired };
}
