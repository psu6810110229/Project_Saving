import type { ReactNode } from 'react';
import { CategoryRow } from '../CategoryRow/CategoryRow';
import { FormField } from '../FormField/FormField';
import { IconEdit } from '../Icon/Icon';
import { TextInput } from '../TextInput/TextInput';
import { useI18n } from '../../i18n/useI18n';
import { ROOM_NAME_MAX_LENGTH } from '../../lib/roomName';
import type { ProjectCategory } from '../../types';

interface CategoryOption {
  id: ProjectCategory;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
}

interface StepBasicsProps {
  name: string;
  category: ProjectCategory;
  options: CategoryOption[];
  onNameChange: (value: string) => void;
  onCategoryChange: (value: ProjectCategory) => void;
}

export function StepBasics({
  name,
  category,
  options,
  onNameChange,
  onCategoryChange,
}: StepBasicsProps) {
  const { copy } = useI18n();
  const c = copy.createRoomWizard;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-mono text-2xl font-bold text-ink">{c.stepBasicsTitle}</h2>
        <p className="mt-1 font-mono text-sm text-ink-muted">{c.stepBasicsSubtitle}</p>
      </div>

      <FormField label={c.nameLabel}>
        <TextInput
          value={name}
          maxLength={ROOM_NAME_MAX_LENGTH}
          placeholder={c.namePlaceholder}
          leadingIcon={<IconEdit size={16} />}
          onChange={e => onNameChange(e.target.value)}
        />
      </FormField>

      <div>
        <CategoryRow
          label={c.categoryLabel}
          shape="square"
          options={options}
          value={category}
          onChange={onCategoryChange}
          maxVisible={options.length}
        />
        <p className="mt-2 font-mono text-xs text-ink-dim">{c.categoryHint}</p>
      </div>
    </div>
  );
}
