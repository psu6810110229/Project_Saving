import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

export type AnimationPrimaryState =
  | 'route-transitioning'
  | 'sheet-opening'
  | 'sheet-closing'
  | 'dragging'
  | 'scroll-gesture-active'
  | 'chart-morphing';

interface AnimationSchedulerSnapshot {
  activePrimaryStates: AnimationPrimaryState[];
  activeSecondaryCount: number;
  secondaryMotionBlocked: boolean;
}

let _activeCount = 0;
const MAX_CONCURRENT = 4;
const DEFAULT_SETTLE_MS = 80;

const _primaryCounts = new Map<AnimationPrimaryState, number>();
const _singletonPrimaryReleases = new Map<AnimationPrimaryState, () => void>();
const _listeners = new Set<() => void>();
let _secondaryBlockedUntil = 0;
let _settleTimer: ReturnType<typeof setTimeout> | null = null;
let _snapshot: AnimationSchedulerSnapshot = buildSnapshot();

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function activePrimaryStates(): AnimationPrimaryState[] {
  return Array.from(_primaryCounts.entries())
    .filter(([, count]) => count > 0)
    .map(([state]) => state);
}

function hasActivePrimaryMotion(): boolean {
  return activePrimaryStates().length > 0;
}

function isSettleWindowActive(): boolean {
  return nowMs() < _secondaryBlockedUntil;
}

function buildSnapshot(): AnimationSchedulerSnapshot {
  const states = activePrimaryStates();
  return {
    activePrimaryStates: states,
    activeSecondaryCount: _activeCount,
    secondaryMotionBlocked: states.length > 0 || isSettleWindowActive(),
  };
}

function snapshotsEqual(a: AnimationSchedulerSnapshot, b: AnimationSchedulerSnapshot): boolean {
  return a.activeSecondaryCount === b.activeSecondaryCount
    && a.secondaryMotionBlocked === b.secondaryMotionBlocked
    && a.activePrimaryStates.length === b.activePrimaryStates.length
    && a.activePrimaryStates.every((state, index) => state === b.activePrimaryStates[index]);
}

function refreshSnapshot(): void {
  const nextSnapshot = buildSnapshot();
  if (!snapshotsEqual(_snapshot, nextSnapshot)) {
    _snapshot = nextSnapshot;
  }
}

function emitChange(): void {
  refreshSnapshot();
  _listeners.forEach(listener => listener());
}

function scheduleSettleNotify(): void {
  if (_settleTimer !== null) {
    clearTimeout(_settleTimer);
    _settleTimer = null;
  }

  const remaining = _secondaryBlockedUntil - nowMs();
  if (remaining <= 0) return;

  _settleTimer = setTimeout(() => {
    _settleTimer = null;
    emitChange();
  }, remaining + 1);
}

function blockSecondaryMotionFor(settleMs: number): void {
  if (settleMs <= 0) {
    emitChange();
    return;
  }
  _secondaryBlockedUntil = Math.max(_secondaryBlockedUntil, nowMs() + settleMs);
  scheduleSettleNotify();
  emitChange();
}

function subscribe(listener: () => void): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

function getSnapshot(): AnimationSchedulerSnapshot {
  refreshSnapshot();
  return _snapshot;
}

function getServerSnapshot(): AnimationSchedulerSnapshot {
  return {
    activePrimaryStates: [],
    activeSecondaryCount: 0,
    secondaryMotionBlocked: false,
  };
}

export function beginPrimaryMotion(
  state: AnimationPrimaryState,
  settleMs = DEFAULT_SETTLE_MS,
): () => void {
  _primaryCounts.set(state, (_primaryCounts.get(state) ?? 0) + 1);
  emitChange();

  let released = false;
  return () => {
    if (released) return;
    released = true;

    const nextCount = Math.max(0, (_primaryCounts.get(state) ?? 0) - 1);
    if (nextCount === 0) {
      _primaryCounts.delete(state);
    } else {
      _primaryCounts.set(state, nextCount);
    }

    blockSecondaryMotionFor(settleMs);
  };
}

export function runPrimaryMotion(
  state: AnimationPrimaryState,
  durationMs: number,
  settleMs = DEFAULT_SETTLE_MS,
  onComplete?: () => void,
): () => void {
  const release = beginPrimaryMotion(state, settleMs);
  let completed = false;
  const timeoutId = setTimeout(() => {
    completed = true;
    release();
    onComplete?.();
  }, Math.max(0, durationMs));

  return () => {
    clearTimeout(timeoutId);
    release();
    if (!completed) completed = true;
  };
}

export function useOpenClosePrimaryMotion(
  open: boolean,
  openingMs: number,
  closingMs: number,
  openingState: AnimationPrimaryState = 'sheet-opening',
  closingState: AnimationPrimaryState = 'sheet-closing',
): boolean {
  const [openingSettled, setOpeningSettled] = useState(false);
  const previousOpenRef = useRef(open);

  useEffect(() => {
    let cancelMotion: (() => void) | null = null;
    let resetTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let readyTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const resetOpeningSettled = () => {
      resetTimeoutId = setTimeout(() => setOpeningSettled(false), 0);
    };

    if (open) {
      resetOpeningSettled();
      cancelMotion = runPrimaryMotion(openingState, openingMs, DEFAULT_SETTLE_MS, () => {
        readyTimeoutId = setTimeout(() => setOpeningSettled(true), DEFAULT_SETTLE_MS);
      });
    } else {
      resetOpeningSettled();
      if (previousOpenRef.current !== open) {
        cancelMotion = runPrimaryMotion(closingState, closingMs);
      }
    }

    previousOpenRef.current = open;
    return () => {
      if (resetTimeoutId !== null) clearTimeout(resetTimeoutId);
      if (readyTimeoutId !== null) clearTimeout(readyTimeoutId);
      cancelMotion?.();
    };
  }, [closingMs, closingState, open, openingMs, openingState]);

  return open && openingSettled;
}

export function useAnimationSchedulerSnapshot(): AnimationSchedulerSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useSecondaryMotionReady(delayMs = 0): boolean {
  const { secondaryMotionBlocked } = useAnimationSchedulerSnapshot();
  const [delayedReady, setDelayedReady] = useState(false);

  useEffect(() => {
    if (secondaryMotionBlocked || delayMs <= 0) {
      const timeoutId = setTimeout(() => setDelayedReady(false), 0);
      return () => clearTimeout(timeoutId);
    }

    const timeoutId = setTimeout(() => setDelayedReady(true), delayMs);
    return () => clearTimeout(timeoutId);
  }, [delayMs, secondaryMotionBlocked]);

  if (delayMs <= 0) {
    return !secondaryMotionBlocked;
  }

  return !secondaryMotionBlocked && delayedReady;
}

export function useAmbientMotionReady(delayMs = 120): boolean {
  return useSecondaryMotionReady(delayMs);
}

export function setPrimaryMotionState(state: AnimationPrimaryState, active: boolean): void {
  const existingRelease = _singletonPrimaryReleases.get(state);

  if (active) {
    if (!existingRelease) {
      _singletonPrimaryReleases.set(state, beginPrimaryMotion(state));
    }
    return;
  }

  if (existingRelease) {
    existingRelease();
    _singletonPrimaryReleases.delete(state);
  }
}

export function isPrimaryMotionActive(state?: AnimationPrimaryState): boolean {
  if (state) return (_primaryCounts.get(state) ?? 0) > 0;
  return hasActivePrimaryMotion();
}

export function isSecondaryMotionBlocked(): boolean {
  return buildSnapshot().secondaryMotionBlocked;
}

export function canStartSecondaryAnimation(): boolean {
  return !isSecondaryMotionBlocked() && _activeCount < MAX_CONCURRENT;
}

export function acquireAnimationSlot(): boolean {
  if (!canStartSecondaryAnimation()) return false;
  _activeCount++;
  emitChange();
  return true;
}

export function releaseAnimationSlot(): void {
  _activeCount = Math.max(0, _activeCount - 1);
  emitChange();
}

export function setPageTransitioning(transitioning: boolean): void {
  setPrimaryMotionState('route-transitioning', transitioning);
}

export function isPageTransitioning(): boolean {
  return isPrimaryMotionActive('route-transitioning');
}
