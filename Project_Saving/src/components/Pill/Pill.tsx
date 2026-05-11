import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Pill-shaped chip used for the +$50 / +$150 / +$500 quick-add row in the
 * Add Money flow. Two states:
 *
 * - `selected = false` — peach `brand-50` fill, muted ink label.
 * - `selected = true`  — bright `brand-500` fill with halo glow + brand-50
 *                        ring (matches the +$150 highlight in the mockup).
 */

interface PillProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  selected?: boolean;
  children: ReactNode;
}

export function Pill({ selected = false, className = '', children, ...rest }: PillProps) {
  const state = selected
    ? 'bg-brand-500 text-ink-inverse ring-4 ring-brand-50 shadow-haloOrange'
    : 'bg-brand-50 text-ink-muted hover:bg-brand-100';

  return (
    <button
      {...rest}
      className={
        'inline-flex items-center justify-center rounded-pill ' +
        'px-5 py-2.5 text-sm font-mono font-bold tracking-wide ' +
        'transition-all duration-200 active:scale-[0.97] ' +
        `${state} ${className}`
      }
    >
      {children}
    </button>
  );
}
