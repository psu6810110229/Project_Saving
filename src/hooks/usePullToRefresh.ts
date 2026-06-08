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

  const pullDistanceRef = useRef(0);
  const committedRoundedPullRef = useRef(0);
  const stateRef = useRef<PullState>('idle');
  const startY = useRef(0);
  const startX = useRef(0);
  const active = useRef(false);
  const directionLocked = useRef(false);
  const crossedThreshold = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  const touchFrame = useRef<number | null>(null);
  const pendingPullDistance = useRef<number | null>(null);
  const pendingState = useRef<PullState | null>(null);
  useEffect(() => { onRefreshRef.current = onRefresh; });

  const commitState = useCallback((nextState: PullState) => {
    if (stateRef.current === nextState) return;
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const commitPullDistance = useCallback((nextDistance: number, force = false) => {
    pullDistanceRef.current = nextDistance;
    const rounded = Math.round(nextDistance);
    if (!force && rounded === committedRoundedPullRef.current) return;
    committedRoundedPullRef.current = rounded;
    setPullDistance(nextDistance);
  }, []);

  const flushTouchFrame = useCallback(() => {
    touchFrame.current = null;
    const nextDistance = pendingPullDistance.current;
    const nextState = pendingState.current;
    pendingPullDistance.current = null;
    pendingState.current = null;

    if (nextDistance !== null) commitPullDistance(nextDistance);
    if (nextState !== null) commitState(nextState);
  }, [commitPullDistance, commitState]);

  const cancelTouchFrame = useCallback(() => {
    if (touchFrame.current !== null) {
      cancelAnimationFrame(touchFrame.current);
      touchFrame.current = null;
    }
    pendingPullDistance.current = null;
    pendingState.current = null;
  }, []);

  const scheduleTouchUpdate = useCallback((nextDistance: number, nextState: PullState) => {
    pullDistanceRef.current = nextDistance;
    pendingPullDistance.current = nextDistance;
    pendingState.current = nextState;
    if (touchFrame.current !== null) return;
    touchFrame.current = requestAnimationFrame(flushTouchFrame);
  }, [flushTouchFrame]);

  const animateToZero = useCallback(() => {
    cancelTouchFrame();
    commitState('releasing');
    requestAnimationFrame(() => {
      commitPullDistance(0, true);
      setTimeout(() => {
        commitState('idle');
      }, SPRING_DURATION_MS);
    });
  }, [cancelTouchFrame, commitPullDistance, commitState]);

  const cleanupGesture = useCallback(() => {
    active.current = false;
    directionLocked.current = false;
    crossedThreshold.current = false;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      if (stateRef.current === 'refreshing' || stateRef.current === 'releasing') return;
      if (el!.scrollTop > 0) return;
      const touch = e.touches[0];
      startY.current = touch.clientY;
      startX.current = touch.clientX;
      active.current = true;
      directionLocked.current = false;
      crossedThreshold.current = false;
    }

    function onTouchMove(e: TouchEvent) {
      if (!active.current || stateRef.current === 'refreshing' || stateRef.current === 'releasing') return;

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
        if (pullDistanceRef.current > 0) {
          cancelTouchFrame();
          commitPullDistance(0, true);
          commitState('idle');
        }
        return;
      }

      if (el!.scrollTop > 0) {
        active.current = false;
        return;
      }

      e.preventDefault();

      const dampened = Math.min(rawDeltaY * RESISTANCE, maxPull);
      scheduleTouchUpdate(dampened, dampened >= threshold ? 'triggered' : 'pulling');

      if (dampened >= threshold && !crossedThreshold.current) {
        crossedThreshold.current = true;
        haptic('success');
      }
      if (dampened < threshold && crossedThreshold.current) {
        crossedThreshold.current = false;
      }
    }

    function onTouchEnd() {
      if (!active.current && stateRef.current !== 'pulling' && stateRef.current !== 'triggered') return;

      cleanupGesture();
      cancelTouchFrame();

      if (pullDistanceRef.current >= threshold) {
        commitState('refreshing');
        commitPullDistance(threshold * 0.6, true);

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
      cancelTouchFrame();
    };
  }, [
    threshold,
    maxPull,
    minimumDuration,
    animateToZero,
    cleanupGesture,
    cancelTouchFrame,
    commitPullDistance,
    commitState,
    scheduleTouchUpdate,
  ]);

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
