import { useId, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { palette } from '../../lib/theme';

type RingSize = 'md' | 'lg' | 'xl';

interface LeaderProgressRingProps {
  value: number;
  size?: RingSize;
  themeHex?: string;
  animate?: boolean;
  delayMs?: number;
  children?: ReactNode;
  className?: string;
}

const SIZES: Record<RingSize, { outer: number; stroke: number }> = {
  md: { outer: 76, stroke: 6 },
  lg: { outer: 104, stroke: 7 },
  xl: { outer: 132, stroke: 8 },
};

export function LeaderProgressRing({
  value,
  size = 'lg',
  themeHex,
  animate = false,
  delayMs = 0,
  children,
  className = '',
}: LeaderProgressRingProps) {
  const reduceMotion = useReducedMotion();
  const gradientId = useId();
  const trackGradientId = useId();
  const glowId = useId();
  const maskId = useId();
  const shouldAnimate = animate && !reduceMotion;
  const baseHex = themeHex ?? palette.brand500;
  const { outer, stroke } = SIZES[size];
  const clamped = Math.max(0, Math.min(100, value));
  const center = outer / 2;
  const r = (outer - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const targetOffset = circumference * (1 - clamped / 100);
  const progressLength = circumference - targetOffset;
  const shimmerLength = progressLength > 0
    ? Math.min(circumference * 0.14, Math.max(stroke * 2, progressLength * 0.18), progressLength)
    : 0;
  const delaySeconds = delayMs / 1000;

  const progressStart = mixRgb(baseHex, '#FFFFFF', 0.42);
  const progressMid = baseHex;
  const progressEnd = mixRgb(baseHex, palette.brand900, 0.2);
  const glowSoft = withAlpha(baseHex, 0.24);
  const glowStrong = withAlpha(baseHex, 0.48);
  const gloss = withAlpha('#FFFFFF', 0.48);
  const shimmerSoft = withAlpha('#FFF8F0', 0.38);
  const shimmerStrong = withAlpha('#FFFFFF', 0.78);

  return (
    <div
      className={`relative inline-grid place-items-center ${className}`}
      style={{ width: outer, height: outer }}
    >
      <svg
        width={outer}
        height={outer}
        viewBox={`0 0 ${outer} ${outer}`}
        className="absolute inset-0 -rotate-90 overflow-visible"
        aria-hidden
      >
        <defs>
          <linearGradient id={trackGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.92)" />
            <stop offset="100%" stopColor={palette.well} />
          </linearGradient>
          <linearGradient id={gradientId} x1="15%" y1="0%" x2="100%" y2="85%">
            <stop offset="0%" stopColor={progressStart} />
            <stop offset="56%" stopColor={progressMid} />
            <stop offset="100%" stopColor={progressEnd} />
          </linearGradient>
          <filter
            id={glowId}
            x={-outer * 0.4}
            y={-outer * 0.4}
            width={outer * 1.8}
            height={outer * 1.8}
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation={stroke * 1.1} />
          </filter>
          <mask id={maskId}>
            <rect width={outer} height={outer} fill="black" />
            <circle
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke="white"
              strokeWidth={stroke + 1}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={targetOffset}
            />
          </mask>
        </defs>

        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={glowSoft}
          strokeWidth={stroke + 8}
          opacity={0.75}
          filter={`url(#${glowId})`}
        />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={`url(#${trackGradientId})`}
          strokeWidth={stroke}
        />
        <motion.circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={glowStrong}
          strokeWidth={stroke + 3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={shouldAnimate ? { strokeDashoffset: circumference } : false}
          animate={{ strokeDashoffset: targetOffset }}
          transition={shouldAnimate ? {
            duration: 0.9,
            delay: delaySeconds,
            ease: [0.16, 1, 0.3, 1],
          } : { duration: 0 }}
          filter={`url(#${glowId})`}
          opacity={0.95}
        />
        <motion.circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={shouldAnimate ? { strokeDashoffset: circumference } : false}
          animate={{ strokeDashoffset: targetOffset }}
          transition={shouldAnimate ? {
            duration: 0.9,
            delay: delaySeconds,
            ease: [0.16, 1, 0.3, 1],
          } : { duration: 0 }}
        />

        {progressLength > 0 && (
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke={gloss}
            strokeWidth={Math.max(1.4, stroke * 0.32)}
            strokeLinecap="round"
            strokeDasharray={`${progressLength} ${circumference}`}
            strokeDashoffset={targetOffset}
            opacity={0.95}
          />
        )}

        {!reduceMotion && progressLength > 0 && shimmerLength > 0 && (
          <>
            <motion.circle
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke={shimmerSoft}
              strokeWidth={stroke + 1.4}
              strokeLinecap="round"
              strokeDasharray={`${shimmerLength * 1.7} ${circumference}`}
              strokeDashoffset={circumference}
              mask={`url(#${maskId})`}
              filter={`url(#${glowId})`}
              opacity={0.9}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: targetOffset - shimmerLength }}
              transition={{
                duration: 2.2,
                delay: delaySeconds + 0.22,
                ease: 'linear',
                repeat: Number.POSITIVE_INFINITY,
                repeatDelay: 0.35,
              }}
            />
            <motion.circle
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke={shimmerStrong}
              strokeWidth={Math.max(2, stroke * 0.62)}
              strokeLinecap="round"
              strokeDasharray={`${shimmerLength} ${circumference}`}
              strokeDashoffset={circumference}
              mask={`url(#${maskId})`}
              opacity={0.92}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: targetOffset - shimmerLength }}
              transition={{
                duration: 2.2,
                delay: delaySeconds + 0.22,
                ease: 'linear',
                repeat: Number.POSITIVE_INFINITY,
                repeatDelay: 0.35,
              }}
            />
          </>
        )}
      </svg>

      <div className="pointer-events-none absolute inset-[10%] rounded-full bg-[radial-gradient(circle_at_30%_28%,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0.04)_38%,rgba(255,255,255,0)_70%)]" />
      <div className="relative grid place-items-center">{children}</div>
    </div>
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map(char => char + char).join('')
    : normalized;

  if (!/^[\da-fA-F]{6}$/.test(expanded)) return null;

  const value = Number.parseInt(expanded, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function mixRgb(fromHex: string, toHex: string, amount: number): string {
  const from = hexToRgb(fromHex);
  const to = hexToRgb(toHex);
  if (!from || !to) return fromHex;

  const mix = (start: number, end: number) => Math.round(start + (end - start) * amount);
  return `rgb(${mix(from.r, to.r)}, ${mix(from.g, to.g)}, ${mix(from.b, to.b)})`;
}
