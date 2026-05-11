/**
 * Dual-segment progress bar used on the Add Money screen.
 *
 * Renders THREE layers stacked left-to-right inside a single track:
 * 1. `current`   — already-saved portion, bright `brand-500`.
 * 2. `projected` — preview of what the bar will look like AFTER the pending
 *                  deposit; rendered in soft peach `brand-100` to the right of
 *                  `current`.
 * 3. The remainder stays as the `well` recessed track.
 *
 * Both values are percentages 0–100 of the bucket target; the component
 * clamps and orders them so `projected >= current`.
 */

interface ProjectedProgressBarProps {
  /** Current saved % (0–100). */
  current: number;
  /** Projected post-deposit % (0–100). Must be ≥ current to render the bump. */
  projected: number;
  className?: string;
}

export function ProjectedProgressBar({
  current,
  projected,
  className = '',
}: ProjectedProgressBarProps) {
  const c = Math.max(0, Math.min(100, current));
  const p = Math.max(c, Math.min(100, projected));
  const delta = p - c;

  return (
    <div
      className={`w-full h-3 rounded-pill bg-well overflow-hidden flex ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={c}
      aria-valuetext={`${c}% current, ${p}% projected`}
    >
      <div
        className="h-full bg-brand-500 transition-[width] duration-500"
        style={{ width: `${c}%` }}
      />
      <div
        className="h-full bg-brand-100 transition-[width] duration-500"
        style={{ width: `${delta}%` }}
      />
    </div>
  );
}
