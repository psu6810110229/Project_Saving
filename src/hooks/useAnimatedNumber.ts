import { useEffect, useRef, useState } from 'react';

/**
 * Tween a single numeric value toward `target` whenever it changes.
 * Mirrors the RAF + ease-out-cubic approach used by `MomentumChart`'s
 * `useAnimatedSeries` so data updates on cards morph instead of snapping.
 *
 * - First mount initialises the displayed value to `target` (no
 *   count-up-from-zero on entry).
 * - Subsequent target changes start a fresh tween from the *currently
 *   displayed* value, so rapid updates remain smooth.
 * - Respects `prefers-reduced-motion` by returning `target` directly.
 */
export function useAnimatedNumber(target: number, duration = 600): number {
  const prefersReducedMotion = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [value, setValue] = useState<number>(Number.isFinite(target) ? target : 0);
  const fromRef = useRef<number>(Number.isFinite(target) ? target : 0);
  const targetRef = useRef<number>(Number.isFinite(target) ? target : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    if (target === targetRef.current) return;
    targetRef.current = target;

    if (prefersReducedMotion) {
      fromRef.current = target;
      const id = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(id);
    }

    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      const v = from + (target - from) * e;
      fromRef.current = v;
      setValue(v);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, prefersReducedMotion]);

  return value;
}
