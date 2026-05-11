import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Primary CTA atom. Pill-shaped, full-width by default (override with `w-*`).
 *
 * Variants (drawn from the mockups):
 * - `primary`   — deep terracotta `brand-800` ("Create Project", "Confirm",
 *                 "Send Invite Link"). Hover lifts to a soft halo.
 * - `action`    — bright `brand-500` orange with permanent halo glow
 *                 ("Confirm Deposit", "Add Money", "Create Bucket").
 * - `ghost`     — transparent / underlined text-link style ("Go Back").
 * - `dangerSoft`— soft red bg for the Archive Project zone.
 */

type Variant = 'primary' | 'action' | 'ghost' | 'dangerSoft';
type Size = 'md' | 'lg';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  children: ReactNode;
}

const BASE =
  'inline-flex items-center justify-center gap-3 rounded-pill font-mono font-bold ' +
  'transition-all duration-200 active:scale-[0.98] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-800 text-ink-inverse shadow-soft hover:shadow-haloOrange',
  action:
    'bg-brand-500 text-ink-inverse shadow-haloOrange hover:bg-brand-400',
  ghost:
    'bg-transparent text-ink-muted hover:text-ink hover:bg-brand-50',
  dangerSoft:
    'bg-danger-soft text-danger hover:bg-danger-soft/80',
};

const SIZES: Record<Size, string> = {
  md: 'px-5 py-3 text-sm tracking-wide',
  lg: 'px-6 py-4 text-base tracking-wide',
};

export function Button({
  variant = 'primary',
  size = 'lg',
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </button>
  );
}
