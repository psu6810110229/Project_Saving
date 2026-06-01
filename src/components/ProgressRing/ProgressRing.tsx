import { useEffect, useId, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import { palette } from '../../lib/theme';

/**
 * Circular progress ring atom — the radial counterpart to `ProgressBar`.
 *
 * Renders an antialiased SVG donut (rounded cap) with `children` (typically an
 * `<Avatar>`) centered in the hole. Used by the Team podium so each member's
 * progress reads at a glance without a separate bar.
 *
 * `themeHex` tints the progress stroke (per-user theme color); it falls back to
 * brand-500. The track uses the recessed `well` token to match inputs/bars.
 *
 * Animation: the fill sweeps 0 → value on mount via a `stroke-dashoffset`
 * transition. `prefers-reduced-motion` users (OS-level guard in global.css plus
 * the `useReducedMotion` check here) get the final ring immediately, no sweep.
 */

type RingSize = 'md' | 'lg' | 'xl';

interface ProgressRingProps {
  /** Percentage 0–100. Clamped internally. */
  value: number;
  size?: RingSize;
  /** Progress stroke color; defaults to brand-500 when omitted. */
  themeHex?: string;
  /** When true, the ring sweeps from 0 → value on mount. */
  animate?: boolean;
  /** Stagger the mount sweep by this many ms (ignored under reduced motion). */
  delayMs?: number;
  /** Centered content (e.g. an Avatar) rendered in the ring hole. */
  children?: ReactNode;
  shimmer?: boolean;
  className?: string;
}

const SIZES: Record<RingSize, { outer: number; stroke: number }> = {
  md: { outer: 76, stroke: 6 },
  lg: { outer: 104, stroke: 7 },
  xl: { outer: 132, stroke: 8 },
};

export function ProgressRing({
  value,
  size = 'md',
  themeHex,
  animate = false,
  delayMs = 0,
  children,
  shimmer = false,
  className = '',
}: ProgressRingProps) {
  const reduceMotion = useReducedMotion();
  const maskId = useId();
  const { outer, stroke } = SIZES[size];
  const clamped = Math.max(0, Math.min(100, value));
  const center = outer / 2;
  const r = (outer - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const targetOffset = circumference * (1 - clamped / 100);
  const progressLength = circumference - targetOffset;
  const shimmerLength = Math.min(progressLength * 0.22, circumference * 0.11);

  // Start empty, then flip to target on the next frame so the transition runs.
  // Reduced-motion (or animate=false) is filled from the initial state, so the
  // effect only schedules the mount sweep — no synchronous setState in-effect.
  const [filled, setFilled] = useState(reduceMotion === true || !animate);
  useEffect(() => {
    if (reduceMotion || !animate) return;
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, [reduceMotion, animate]);

  return (
    <div
      className={`relative inline-grid place-items-center ${className}`}
      style={{ width: outer, height: outer }}
    >
      <svg
        width={outer}
        height={outer}
        viewBox={`0 0 ${outer} ${outer}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden
      >
        {shimmer && progressLength > 0 && (
          <defs>
            <mask id={maskId}>
              <rect width={outer} height={outer} fill="black" />
              <circle
                cx={center}
                cy={center}
                r={r}
                fill="none"
                stroke="white"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={targetOffset}
              />
            </mask>
          </defs>
        )}
        <circle cx={center} cy={center} r={r} fill="none" stroke={palette.well} strokeWidth={stroke} />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={themeHex ?? palette.brand500}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={filled ? targetOffset : circumference}
          className="transition-[stroke-dashoffset] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ transitionDelay: `${delayMs}ms` }}
        />
        {shimmer && progressLength > 0 && shimmerLength > 0 && (
          <>
            <circle
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke="rgba(255,248,240,0.18)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${shimmerLength * 1.9} ${circumference}`}
              strokeDashoffset={circumference}
              opacity={0.48}
              mask={`url(#${maskId})`}
            >
              {!reduceMotion && (
                <animate
                  attributeName="stroke-dashoffset"
                  from={circumference}
                  to={targetOffset - shimmerLength}
                  dur="1.9s"
                  repeatCount="indefinite"
                />
              )}
            </circle>
            <circle
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke="rgba(255,248,240,0.34)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${shimmerLength} ${circumference}`}
              strokeDashoffset={circumference}
              opacity={0.62}
              mask={`url(#${maskId})`}
            >
              {!reduceMotion && (
                <animate
                  attributeName="stroke-dashoffset"
                  from={circumference}
                  to={targetOffset - shimmerLength}
                  dur="1.9s"
                  repeatCount="indefinite"
                />
              )}
            </circle>
          </>
        )}
      </svg>
      <div className="relative grid place-items-center">{children}</div>
    </div>
  );
}
