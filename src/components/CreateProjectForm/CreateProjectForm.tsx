import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import type { ProjectCategory } from '../../types';
import { Button } from '../Button/Button';
import { CategoryRow } from '../CategoryRow/CategoryRow';
import { FormField } from '../FormField/FormField';
import { IconCalendar, IconEdit, IconPiggyBank } from '../Icon/Icon';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { TextInput } from '../TextInput/TextInput';
import { useI18n } from '../../i18n/useI18n';
import { ROOM_NAME_MAX_LENGTH } from '../../lib/roomName';

interface ProjectCategoryOption {
  id: ProjectCategory;
  label: string;
  icon: ReactNode;
}

interface CreateProjectFormProps {
  category: ProjectCategory | null;
  options: ProjectCategoryOption[];
  name: string;
  target: string;
  endDate: string;
  onCategoryChange: (next: ProjectCategory) => void;
  onNameChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onSubmit: () => void;
}

export function CreateProjectForm(props: CreateProjectFormProps) {
  const { copy } = useI18n();
  const c = copy.createProject;
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    props.onSubmit();
  };

  return (
    <form className="rounded-xl bg-surface shadow-soft p-5 flex flex-col gap-4" onSubmit={handleSubmit}>
      <div>
        <SectionLabel tone="brand">{c.sectionLabel}</SectionLabel>
        <h2 className="mt-1 font-mono text-2xl font-bold text-ink">{c.title}</h2>
      </div>
      <CategoryRow label={c.typeLabel} shape="square" options={props.options} value={props.category} onChange={props.onCategoryChange} />
      <FormField label={c.nameLabel}>
        <TextInput value={props.name} maxLength={ROOM_NAME_MAX_LENGTH} placeholder="Japan 2027" leadingIcon={<IconEdit size={16} />} onChange={(event: ChangeEvent<HTMLInputElement>) => props.onNameChange(event.target.value)} />
      </FormField>
      <FormField label={c.targetLabel}>
        <TextInput value={props.target} inputMode="numeric" placeholder="100000" leadingIcon={<IconPiggyBank size={16} />} onChange={(event: ChangeEvent<HTMLInputElement>) => props.onTargetChange(event.target.value)} />
      </FormField>
      <FormField label={c.endDateLabel}>
        <TextInput value={props.endDate} type="date" leadingIcon={<IconCalendar size={16} />} onChange={(event: ChangeEvent<HTMLInputElement>) => props.onEndDateChange(event.target.value)} />
      </FormField>
      <Button variant="primary" fullWidth type="submit">{c.submitButton}</Button>
    </form>
  );
}
