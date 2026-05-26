import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Circular icon-only button. Used for the back-arrow / settings / bell
 * controls in the headers, and as the floating "+" on the Smart Buckets
 * grid (variant `solid`).
 */

type Variant = 'ghost' | 'solid' | 'glass';
type Size = 'sm' | 'md' | 'lg';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: Variant;
  size?: Size;
  ariaLabel: string;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  ghost: 'bg-brand-50 text-ink border border-white/60 shadow-soft hover:bg-brand-100',
  solid: 'bg-brand-500 text-ink-inverse shadow-haloOrange hover:bg-brand-400',
  glass: 'border border-white/25 bg-white/25 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] hover:bg-white/30',
};

const SIZES: Record<Size, string> = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

export function IconButton({
  variant = 'ghost',
  size = 'md',
  ariaLabel,
  className = '',
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      aria-label={ariaLabel}
      className={
        'inline-flex items-center justify-center rounded-full transition-all duration-200 ' +
        'active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed ' +
        `${VARIANTS[variant]} ${SIZES[size]} ${className}`
      }
    >
      {children}
    </button>
  );
}
