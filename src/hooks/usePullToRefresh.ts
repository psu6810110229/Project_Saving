import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { haptic } from '../lib/haptics';

type PullState = 'idle' | 'pulling' | 'triggered' | 'refreshing' | 'releasing';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
  minimumDuration?: number;
}

interface UsePullToRefreshResult {
  scrollRef: RefObject<HTMLDivElement | null>;
  pullDistance: number;
  state: PullState;
  contentStyle: CSSProperties;
}

const DEFAULT_THRESHOLD = 80;
const DEFAULT_MAX_PULL = 128;
const DEFAULT_MIN_DURATION = 600;
const RESISTANCE = 0.45;
const SPRING_DURATION_MS = 300;
const SPRING_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function usePullToRefresh({
  onRefresh,
  threshold = DEFAULT_THRESHOLD,
  maxPull = DEFAULT_MAX_PULL,
  minimumDuration = DEFAULT_MIN_DURATION,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [state, setState] = useState<PullState>('idle');

  const startY = useRef(0);
  const startX = useRef(0);
  const active = useRef(false);
  const directionLocked = useRef(false);
  const crossedThreshold = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; });

  const animateToZero = useCallback(() => {
    setState('releasing');
    requestAnimationFrame(() => {
      setPullDistance(0);
      setTimeout(() => {
        setState('idle');
      }, SPRING_DURATION_MS);
    });
  }, []);

  const cleanupGesture = useCallback(() => {
    active.current = false;
    directionLocked.current = false;
    crossedThreshold.current = false;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      if (state === 'refreshing' || state === 'releasing') return;
      if (el!.scrollTop > 0) return;
      const touch = e.touches[0];
      startY.current = touch.clientY;
      startX.current = touch.clientX;
      active.current = true;
      directionLocked.current = false;
      crossedThreshold.current = false;
    }

    function onTouchMove(e: TouchEvent) {
      if (!active.current || state === 'refreshing' || state === 'releasing') return;

      const touch = e.touches[0];
      const rawDeltaY = touch.clientY - startY.current;
      const rawDeltaX = touch.clientX - startX.current;

      if (!directionLocked.current) {
        if (Math.abs(rawDeltaX) > Math.abs(rawDeltaY)) {
          active.current = false;
          return;
        }
        directionLocked.current = true;
      }

      if (rawDeltaY <= 0) {
        if (pullDistance > 0) {
          setPullDistance(0);
          setState('idle');
        }
        return;
      }

      if (el!.scrollTop > 0) {
        active.current = false;
        return;
      }

      e.preventDefault();

      const dampened = Math.min(rawDeltaY * RESISTANCE, maxPull);
      setPullDistance(dampened);
      setState(dampened >= threshold ? 'triggered' : 'pulling');

      if (dampened >= threshold && !crossedThreshold.current) {
        crossedThreshold.current = true;
        haptic('success');
      }
      if (dampened < threshold && crossedThreshold.current) {
        crossedThreshold.current = false;
      }
    }

    function onTouchEnd() {
      if (!active.current && state !== 'pulling' && state !== 'triggered') return;

      cleanupGesture();

      if (pullDistance >= threshold) {
        setState('refreshing');
        setPullDistance(threshold * 0.6);

        const start = Date.now();
        onRefreshRef.current().finally(() => {
          const elapsed = Date.now() - start;
          const remaining = Math.max(0, minimumDuration - elapsed);
          setTimeout(() => {
            haptic('success');
            animateToZero();
          }, remaining);
        });
      } else {
        animateToZero();
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [state, pullDistance, threshold, maxPull, minimumDuration, animateToZero, cleanupGesture]);

  const reducedMotion = prefersReducedMotion();
  const needsTransition = state === 'refreshing' || state === 'releasing';
  const transition = needsTransition && !reducedMotion
    ? `transform ${SPRING_DURATION_MS}ms ${SPRING_EASING}`
    : 'none';

  const contentStyle: CSSProperties = {
    transform: `translateY(${pullDistance}px)`,
    transition,
  };

  return { scrollRef, pullDistance, state, contentStyle };
}
