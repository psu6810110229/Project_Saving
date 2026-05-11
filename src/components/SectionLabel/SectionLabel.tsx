import type { ReactNode } from 'react';

/**
 * Tiny uppercase tracked label used above amounts and section headers
 * ("DEPOSIT AMOUNT", "TOTAL VAULT", "DAILY SAVINGS TREND", "TOTAL
 * CONTRIBUTED", "FROM ACCOUNT"). Always renders in the typewriter face.
 */

type Tone = 'ink' | 'muted' | 'brand';

interface SectionLabelProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

const TONES: Record<Tone, string> = {
  ink:    'text-ink',
  muted:  'text-ink-muted',
  brand:  'text-brand-800',
};

export function SectionLabel({ tone = 'ink', children, className = '' }: SectionLabelProps) {
  return (
    <span
      className={
        `block text-[11px] font-mono font-bold uppercase tracking-[0.18em] ${TONES[tone]} ${className}`
      }
    >
      {children}
    </span>
  );
}
