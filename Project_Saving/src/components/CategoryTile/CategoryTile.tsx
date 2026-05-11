import type { ReactNode } from 'react';

/**
 * Rounded-square category selector tile. Used on both the Create Project
 * flow (Travel / Gadget / Wedding / ...) and the Create Bucket flow as the
 * small circular variant.
 *
 * Two visual modes via `shape`:
 * - `square` — large rounded card with icon + label below (Create Project).
 * - `circle` — round bubble with icon centered and label *under* the bubble
 *              (Create Bucket category row).
 *
 * `selected = true` filled with brand-800 (square) or brand-500 ring (circle);
 * `selected = false` ghosted on bg-surface / brand-50.
 */

type Shape = 'square' | 'circle';

interface CategoryTileProps {
  label: string;
  icon: ReactNode;
  shape?: Shape;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function CategoryTile({
  label,
  icon,
  shape = 'square',
  selected = false,
  onClick,
  className = '',
}: CategoryTileProps) {
  if (shape === 'circle') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex flex-col items-center gap-2 ${className}`}
      >
        <span
          className={
            'w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ' +
            (selected
              ? 'bg-brand-50 text-brand-800 ring-2 ring-brand-500'
              : 'bg-brand-50/70 text-ink-muted hover:bg-brand-50')
          }
        >
          {icon}
        </span>
        <span
          className={`text-xs font-mono ${selected ? 'text-brand-800 font-bold' : 'text-ink-muted'}`}
        >
          {label}
        </span>
      </button>
    );
  }

  // square
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex flex-col items-center justify-center gap-2 ' +
        'min-w-[88px] aspect-square rounded-2xl px-3 transition-all duration-200 ' +
        (selected
          ? 'bg-brand-800 text-ink-inverse shadow-soft'
          : 'bg-surface text-ink-muted shadow-soft hover:bg-brand-50') +
        ` ${className}`
      }
      aria-pressed={selected}
    >
      <span className={selected ? 'text-ink-inverse' : 'text-ink'}>{icon}</span>
      <span className="text-[11px] tracking-widest font-mono font-bold uppercase">{label}</span>
    </button>
  );
}
