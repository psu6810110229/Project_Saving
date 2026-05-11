import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import type { BucketCategory } from '../../types';
import { Button } from '../Button/Button';
import { CategoryRow } from '../CategoryRow/CategoryRow';
import { FormField } from '../FormField/FormField';
import { IconEdit, IconPiggyBank } from '../Icon/Icon';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { TextInput } from '../TextInput/TextInput';

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
  onCategoryChange,
  onNameChange,
  onTargetChange,
  onSubmit,
}: CreateBucketFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="rounded-3xl bg-surface shadow-soft p-5 flex flex-col gap-4" onSubmit={handleSubmit}>
      <div>
        <SectionLabel tone="brand">Create Bucket</SectionLabel>
        <h2 className="mt-1 font-mono text-2xl font-bold text-ink">Split the Trip</h2>
      </div>
      <CategoryRow label="Bucket Category" shape="circle" options={options} value={category} onChange={onCategoryChange} />
      <FormField label="Bucket Name">
        <TextInput value={name} placeholder="Flights" leadingIcon={<IconEdit size={16} />} onChange={(event: ChangeEvent<HTMLInputElement>) => onNameChange(event.target.value)} />
      </FormField>
      <FormField label="Target Amount">
        <TextInput value={target} inputMode="numeric" placeholder="30000" leadingIcon={<IconPiggyBank size={16} />} onChange={(event: ChangeEvent<HTMLInputElement>) => onTargetChange(event.target.value)} />
      </FormField>
      <Button variant="action" fullWidth type="submit">Create Bucket</Button>
    </form>
  );
}
