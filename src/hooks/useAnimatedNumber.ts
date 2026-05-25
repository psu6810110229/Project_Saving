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
    if (safe === targetRef.current) return;
    targetRef.current = safe;

    const from = fromRef.current;
    const delta = Math.abs(safe - from);

    if (REDUCED_MOTION || delta < SNAP_THRESHOLD || isPageTransitioning() || !acquireAnimationSlot()) {
      fromRef.current = safe;
      setValue(safe);
      return;
    }
    slotRef.current = true;

    const start = performance.now();
    const to = safe;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const v = from + (to - from) * easeOutCubic(t);
      fromRef.current = v;
      setValue(v);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (slotRef.current) {
        releaseAnimationSlot();
        slotRef.current = false;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (slotRef.current) {
        releaseAnimationSlot();
        slotRef.current = false;
      }
    };
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
    const newTargets = targetKey.split('|').map(Number);
    const prev = targetsRef.current;

    let anyChanged = false;
    for (let i = 0; i < newTargets.length; i++) {
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

    if (REDUCED_MOTION || maxDelta < SNAP_THRESHOLD || isPageTransitioning() || !acquireAnimationSlot()) {
      fromsRef.current = newTargets.slice();
      setValues(newTargets.slice());
      return;
    }
    slotRef.current = true;

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const animFroms = froms.slice();
    const start = performance.now();
    const tick = (now: number) => {
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
        releaseAnimationSlot();
        slotRef.current = false;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (slotRef.current) {
        releaseAnimationSlot();
        slotRef.current = false;
      }
    };
  }, [targetKey, duration]);

  return values;
}
