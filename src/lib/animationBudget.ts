let _activeCount = 0;
let _transitioning = false;
const MAX_CONCURRENT = 8;

export function acquireAnimationSlot(): boolean {
  if (_transitioning || _activeCount >= MAX_CONCURRENT) return false;
  _activeCount++;
  return true;
}

export function releaseAnimationSlot(): void {
  _activeCount = Math.max(0, _activeCount - 1);
}

export function setPageTransitioning(transitioning: boolean): void {
  _transitioning = transitioning;
}

export function isPageTransitioning(): boolean {
  return _transitioning;
}
