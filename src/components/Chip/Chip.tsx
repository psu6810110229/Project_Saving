import type { ReactNode } from 'react';

/**
 * Compact informational chip. Used for:
 * - "Slip Attached" tag in Activity Timeline (peach bg, brand-800 ink, icon)
 * - "+12%" trend tag on Recorded Vault (white bg, accent leaf/red ink)
 * - Destination tag on Confirm Deposit ("✈ Flights" peach pill)
 *
 * Variants are just tone presets; consumers pick by visual role.
 */

type Tone = 'peach' | 'white' | 'leaf' | 'danger';

interface ChipProps {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

const TONES: Record<Tone, string> = {
  peach:  'bg-brand-50 text-brand-800',
  white:  'bg-surface text-ink shadow-soft',
  leaf:   'bg-brand-50 text-accent-leaf',
  danger: 'bg-danger-soft text-danger',
};

export function Chip({ tone = 'peach', icon, children, className = '' }: ChipProps) {
  return (
    <span
      className={
        'inline-flex items-center gap-1.5 rounded-pill ' +
        'px-3 py-1 text-xs font-mono font-bold ' +
        `${TONES[tone]} ${className}`
      }
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}
