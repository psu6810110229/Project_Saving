import { useCallback, useEffect, useState } from 'react';

/**
 * useState that syncs to localStorage. Used for the comparison chart
 * filter, activity sort/search defaults, and other per-user-per-device
 * preferences that should survive a refresh.
 *
 * Safe in SSR / non-browser environments — reads are guarded by
 * `typeof window`. Failed reads/writes fall back silently to in-memory
 * state so a corrupt localStorage entry never crashes the app.
 */
export function useLocalStorageState<T>(key: string, initial: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignored — quota errors or private-browsing rejections should
      // not break the UI; the value just won't persist this session.
    }
  }, [key, value]);

  const set = useCallback((next: T) => setValue(next), []);
  return [value, set];
}
