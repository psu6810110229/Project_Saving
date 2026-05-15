import { useState } from 'react';
import type { ReactNode } from 'react';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { CategoryTile } from '../CategoryTile/CategoryTile';
import { IconMoreVertical } from '../Icon/Icon';
import { Modal } from '../Modal/Modal';
import { useI18n } from '../../i18n/useI18n';

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
  maxVisible?: number;
}

export function CategoryRow<T extends string>({
  label,
  shape = 'square',
  options,
  value,
  onChange,
  maxVisible = 4,
}: CategoryRowProps<T>) {
  const { copy } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);
  const visibleOptions = options.slice(0, maxVisible);
  const hasMore = options.length > maxVisible;

  function handleSelect(next: T) {
    onChange(next);
    setPickerOpen(false);
  }

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
        {visibleOptions.map(opt => (
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
        {hasMore && (
          <div className={shape === 'square' ? 'snap-start shrink-0' : 'shrink-0'}>
            <CategoryTile
              shape={shape}
              label={copy.sharedControls.more}
              icon={<IconMoreVertical size={shape === 'circle' ? 22 : 28} />}
              onClick={() => setPickerOpen(true)}
            />
          </div>
        )}
      </div>
      <Modal open={pickerOpen} title={label ?? copy.sharedControls.chooseCategory} onClose={() => setPickerOpen(false)}>
        <div className="grid grid-cols-2 gap-3">
          {options.map(opt => (
            <CategoryTile
              key={opt.id}
              shape="square"
              label={opt.label}
              icon={opt.icon}
              selected={value === opt.id}
              onClick={() => handleSelect(opt.id)}
            />
          ))}
        </div>
      </Modal>
    </div>
  );
}
