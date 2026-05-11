import type { ReactNode } from 'react';

/**
 * Round container that hosts a category icon. The signature visual element
 * for Smart Buckets, the Add Money header, and the Confirm Deposit piggy
 * bank header.
 *
 * Three tones from the mockups:
 * - `peach` — soft `brand-50` background, brand-800 icon (Smart Buckets rows,
 *             Confirm Deposit header).
 * - `solid` — bright `brand-500` background, white icon, halo glow
 *             (Bucket Detail page header).
 * - `muted` — neutral well background, ink-muted icon (Activity Timeline
 *             user-initial bubbles).
 */

type Tone = 'peach' | 'solid' | 'muted';
type Size = 'sm' | 'md' | 'lg' | 'xl';

interface IconBubbleProps {
  tone?: Tone;
  size?: Size;
  children: ReactNode;
  className?: string;
}

const TONES: Record<Tone, string> = {
  peach: 'bg-brand-50 text-brand-800',
  solid: 'bg-brand-500 text-ink-inverse shadow-haloOrange',
  muted: 'bg-well text-ink-muted',
};

const SIZES: Record<Size, string> = {
  sm: 'w-8 h-8',
  md: 'w-11 h-11',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
};

export function IconBubble({ tone = 'peach', size = 'md', children, className = '' }: IconBubbleProps) {
  return (
    <span
      className={
        `inline-flex items-center justify-center rounded-full ${TONES[tone]} ${SIZES[size]} ${className}`
      }
    >
      {children}
    </span>
  );
}
