import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import type { BucketCategory } from '../../types';
import { Button } from '../Button/Button';
import { CategoryRow } from '../CategoryRow/CategoryRow';
import { FormField } from '../FormField/FormField';
import { IconEdit, IconPiggyBank } from '../Icon/Icon';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { TextInput } from '../TextInput/TextInput';
import { useI18n } from '../../i18n/useI18n';

interface BucketCategoryOption {
  id: BucketCategory;
  label: string;
  icon: ReactNode;
}

interface CreateBucketFormProps {
  category: BucketCategory | null;
  options: BucketCategoryOption[];
  name: string;
  target: string;
  targetHelper?: string;
  targetError?: string;
  onCategoryChange: (next: BucketCategory) => void;
  onNameChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onSubmit: () => void;
}

export function CreateBucketForm({
  category,
  options,
  name,
  target,
  targetHelper,
  targetError,
  onCategoryChange,
  onNameChange,
  onTargetChange,
  onSubmit,
}: CreateBucketFormProps) {
  const { copy } = useI18n();
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="rounded-xl bg-surface shadow-soft p-5 flex flex-col gap-4" onSubmit={handleSubmit}>
      <div>
        <SectionLabel tone="brand">{copy.bucket.createSectionLabel}</SectionLabel>
        <h2 className="mt-1 font-mono text-2xl font-bold text-ink">{copy.bucket.createTitle}</h2>
      </div>
      <CategoryRow label={copy.bucket.categoryLabel} shape="circle" options={options} value={category} onChange={onCategoryChange} />
      <FormField label={copy.bucket.nameLabel}>
        <TextInput value={name} placeholder={copy.bucket.namePlaceholder} leadingIcon={<IconEdit size={16} />} onChange={(event: ChangeEvent<HTMLInputElement>) => onNameChange(event.target.value)} />
      </FormField>
      <FormField label={copy.bucket.targetLabel} helper={targetHelper} error={targetError}>
        <TextInput value={target} inputMode="numeric" placeholder="30000" leadingIcon={<IconPiggyBank size={16} />} onChange={(event: ChangeEvent<HTMLInputElement>) => onTargetChange(event.target.value)} />
      </FormField>
      <Button variant="action" fullWidth type="submit">{copy.bucket.createButton}</Button>
    </form>
  );
}
