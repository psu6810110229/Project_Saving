/**
 * Single-tone progress bar atom. Used everywhere a single value needs to be
 * shown against a target (Head-to-Head, Recorded Vault, individual buckets).
 *
 * `tone` picks the fill color:
 * - `primary`  — bright `brand-500` (Recorded Vault, my row in Head-to-Head)
 * - `deep`     — `brand-800` deep terracotta (Recorded Vault filled section,
 *                contribution rows)
 * - `muted`    — `ink-muted` cocoa (other player's bar, default)
 * - `theme`    — accepts a `themeColor` hex via CSS var for per-user theme
 */

type Tone = 'primary' | 'deep' | 'muted' | 'theme';
type Size = 'sm' | 'md' | 'lg';

interface ProgressBarProps {
  /** Percentage 0–100. Clamped internally. */
  value: number;
  tone?: Tone;
  size?: Size;
  /** Hex color used only when `tone === 'theme'`. */
  themeHex?: string;
  /** When true, the fill animates from 0 → value on mount. */
  animate?: boolean;
  shimmer?: boolean;
  className?: string;
}

const TONES: Record<Tone, string> = {
  primary: 'bg-brand-500',
  deep:    'bg-brand-800',
  muted:   'bg-ink-muted',
  theme:   '', // applied inline below
};

const SIZES: Record<Size, string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-3.5',
};

export function ProgressBar({
  value,
  tone = 'primary',
  size = 'md',
  themeHex,
  animate = false,
  shimmer = false,
  className = '',
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const fillStyle: React.CSSProperties = {
    width: `${clamped}%`,
    ...(tone === 'theme' && themeHex ? { backgroundColor: themeHex } : {}),
    ...(animate ? { animationName: 'fill-bar', animationDuration: '0.8s', animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)', animationFillMode: 'both', ['--target-width' as string]: `${clamped}%` } : {}),
  };
  return (
    <div
      className={`w-full rounded-pill bg-well overflow-hidden ${SIZES[size]} ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
      <div
        className={`relative h-full overflow-hidden rounded-pill transition-[width] duration-500 ${TONES[tone]}`}
        style={fillStyle}
      >
        {shimmer && (
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-75"
          >
            <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/55 to-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
