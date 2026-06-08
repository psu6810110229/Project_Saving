import { useEffect, useRef, useState } from 'react';
import {
  acquireAnimationSlot,
  releaseAnimationSlot,
  isPageTransitioning,
} from '../lib/animationBudget';

const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const SNAP_THRESHOLD = 1;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function useAnimatedNumber(target: number, duration = 600): number {
  const safe = Number.isFinite(target) ? target : 0;
  const [value, setValue] = useState(safe);
  const fromRef = useRef(safe);
  const targetRef = useRef(safe);
  const rafRef = useRef<number | null>(null);
  const slotRef = useRef(false);

  useEffect(() => {
    const cancelAnimation = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (slotRef.current) {
        releaseAnimationSlot();
        slotRef.current = false;
      }
    };

    if (safe === targetRef.current) return;
    targetRef.current = safe;

    const from = fromRef.current;
    const delta = Math.abs(safe - from);

    if (REDUCED_MOTION || duration <= 0 || delta <= SNAP_THRESHOLD || isPageTransitioning() || !acquireAnimationSlot()) {
      cancelAnimation();
      fromRef.current = safe;
      setValue(safe);
      return;
    }
    slotRef.current = true;

    const start = performance.now();
    const to = safe;
    const tick = (now: number) => {
      if (isPageTransitioning()) {
        rafRef.current = null;
        fromRef.current = to;
        setValue(to);
        if (slotRef.current) {
          releaseAnimationSlot();
          slotRef.current = false;
        }
        return;
      }

      const t = Math.min(1, (now - start) / duration);
      const v = from + (to - from) * easeOutCubic(t);
      fromRef.current = v;
      setValue(v);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (slotRef.current) {
        rafRef.current = null;
        releaseAnimationSlot();
        slotRef.current = false;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return cancelAnimation;
  }, [safe, duration]);

  return value;
}

export function useAnimatedNumbers(targets: number[], duration = 600): number[] {
  const safeTargets = targets.map(t => (Number.isFinite(t) ? t : 0));
  const targetKey = safeTargets.join('|');

  const [values, setValues] = useState<number[]>(() => safeTargets.slice());
  const fromsRef = useRef<number[]>(safeTargets.slice());
  const targetsRef = useRef<number[]>(safeTargets.slice());
  const rafRef = useRef<number | null>(null);
  const slotRef = useRef(false);

  useEffect(() => {
    const cancelAnimation = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (slotRef.current) {
        releaseAnimationSlot();
        slotRef.current = false;
      }
    };

    const newTargets = targetKey.split('|').map(Number);
    const prev = targetsRef.current;

    let anyChanged = newTargets.length !== prev.length;
    for (let i = 0; !anyChanged && i < newTargets.length; i++) {
      if (newTargets[i] !== prev[i]) {
        anyChanged = true;
        break;
      }
    }
    if (!anyChanged) return;

    const froms = fromsRef.current;
    targetsRef.current = newTargets;

    const maxDelta = Math.max(
      ...newTargets.map((t, i) => Math.abs(t - (froms[i] ?? 0))),
    );

    if (REDUCED_MOTION || duration <= 0 || maxDelta <= SNAP_THRESHOLD || isPageTransitioning() || !acquireAnimationSlot()) {
      cancelAnimation();
      fromsRef.current = newTargets.slice();
      setValues(newTargets.slice());
      return;
    }
    slotRef.current = true;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const animFroms = froms.slice();
    const start = performance.now();
    const tick = (now: number) => {
      if (isPageTransitioning()) {
        rafRef.current = null;
        fromsRef.current = newTargets.slice();
        setValues(newTargets.slice());
        if (slotRef.current) {
          releaseAnimationSlot();
          slotRef.current = false;
        }
        return;
      }

      const t = Math.min(1, (now - start) / duration);
      const e = easeOutCubic(t);
      const next = newTargets.map((target, i) => {
        const f = animFroms[i] ?? 0;
        return f + (target - f) * e;
      });
      fromsRef.current = next;
      setValues(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (slotRef.current) {
        rafRef.current = null;
        releaseAnimationSlot();
        slotRef.current = false;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return cancelAnimation;
  }, [targetKey, duration]);

  return values;
}
