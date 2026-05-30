/**
 * Shared "fake but realistic" progress curve used by loading modals (the PWA
 * update modal and the create-project loader). The keyframes jitter slightly
 * and include a deliberate mid-way plateau so the bar feels like real work
 * rather than a constant-speed fill.
 */
export interface ProgressKeyframe {
  t: number;
  v: number;
}

export function buildProgressKeyframes(): ProgressKeyframe[] {
  const r = () => Math.random();
  return [
    { t: 0, v: 0 },
    { t: 0.08 + r() * 0.04, v: 0.12 + r() * 0.06 },
    { t: 0.22 + r() * 0.04, v: 0.25 + r() * 0.05 },
    { t: 0.35 + r() * 0.05, v: 0.28 + r() * 0.04 },
    { t: 0.50 + r() * 0.05, v: 0.50 + r() * 0.08 },
    { t: 0.65 + r() * 0.04, v: 0.55 + r() * 0.05 },
    { t: 0.78 + r() * 0.04, v: 0.75 + r() * 0.08 },
    { t: 0.90 + r() * 0.03, v: 0.88 + r() * 0.05 },
    { t: 1, v: 1 },
  ];
}

export function interpolateKeyframes(kf: ProgressKeyframe[], t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let i = 0;
  while (i < kf.length - 1 && kf[i + 1].t <= t) i++;
  const a = kf[i];
  const b = kf[i + 1];
  const local = (t - a.t) / (b.t - a.t);
  return a.v + (b.v - a.v) * local;
}
