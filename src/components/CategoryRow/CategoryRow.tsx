import type { ReactNode } from 'react';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { CategoryTile } from '../CategoryTile/CategoryTile';

/**
 * Horizontal scroll-able row of CategoryTiles. Used on both:
 * - Create Project (large `square` tiles)
 * - Create Bucket (smaller `circle` tiles)
 *
 * Controlled — parent owns the selected `value` and gets the picked id
 * back via `onChange`. The `options` array drives both visible label
 * and underlying enum value.
 */

interface Option<T extends string> {
  id: T;
  label: string;
  icon: ReactNode;
}

interface CategoryRowProps<T extends string> {
  label?: string;
  shape?: 'square' | 'circle';
  options: Option<T>[];
  value: T | null;
  onChange: (next: T) => void;
}

export function CategoryRow<T extends string>({
  label,
  shape = 'square',
  options,
  value,
  onChange,
}: CategoryRowProps<T>) {
  return (
    <div>
      {label && <SectionLabel tone="muted">{label}</SectionLabel>}
      <div
        className={
          (label ? 'mt-3 ' : '') +
          'flex gap-3 overflow-x-auto pb-1 ' +
          (shape === 'circle' ? 'justify-start' : 'snap-x snap-mandatory')
        }
      >
        {options.map(opt => (
          <div key={opt.id} className={shape === 'square' ? 'snap-start shrink-0' : 'shrink-0'}>
            <CategoryTile
              shape={shape}
              label={opt.label}
              icon={opt.icon}
              selected={value === opt.id}
              onClick={() => onChange(opt.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
