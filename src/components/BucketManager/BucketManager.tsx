import { useState, type ReactNode } from 'react';
import { bucketSaved, sumTargets } from '../../lib/buckets';
import { formatCurrency } from '../../lib/format';
import type { Bucket, BucketCategory, SavingsLog } from '../../types';
import { Button } from '../Button/Button';
import { ConfirmModal } from '../ConfirmModal/ConfirmModal';
import { CreateBucketForm } from '../CreateBucketForm/CreateBucketForm';
import { FormField } from '../FormField/FormField';
import { IconCheck, IconEdit, IconPiggyBank, IconTrash, IconX } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { TextInput } from '../TextInput/TextInput';

interface BucketCategoryOption {
  id: BucketCategory;
  label: string;
  icon: ReactNode;
}

interface BucketManagerProps {
  buckets: Bucket[];
  logs: SavingsLog[];
  category: BucketCategory | null;
  options: BucketCategoryOption[];
  name: string;
  target: string;
  goalTarget?: number | null;
  statusMessage?: string | null;
  onCategoryChange: (next: BucketCategory) => void;
  onNameChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onCreate: () => void;
  onUpdate: (bucket: Bucket, next: { name: string; target_amount: number }) => Promise<{ error?: string }>;
  onDelete: (bucket: Bucket) => Promise<{ error?: string }>;
}

export function BucketManager({
  buckets,
  logs,
  category,
  options,
  name,
  target,
  goalTarget,
  statusMessage,
  onCategoryChange,
  onNameChange,
  onTargetChange,
  onCreate,
  onUpdate,
  onDelete,
}: BucketManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftTarget, setDraftTarget] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Bucket | null>(null);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const totalBucketTargets = sumTargets(buckets);
  const remainingCapacity = typeof goalTarget === 'number'
    ? Math.max(0, goalTarget - totalBucketTargets)
    : null;
  const createTargetAmount = Number(target);
  const createTargetOverCapacity = typeof remainingCapacity === 'number'
    && Number.isFinite(createTargetAmount)
    && createTargetAmount > remainingCapacity;

  function startEdit(bucket: Bucket) {
    setEditingId(bucket.id);
    setDraftName(bucket.name);
    setDraftTarget(String(bucket.target_amount));
    setLocalMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftName('');
    setDraftTarget('');
    setLocalMessage(null);
  }

  async function saveEdit(bucket: Bucket) {
    const targetAmount = Number(draftTarget);
    if (!draftName.trim()) {
      setLocalMessage('Add a bucket name before saving.');
      return;
    }
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setLocalMessage('Enter a target amount greater than 0.');
      return;
    }
    if (typeof goalTarget === 'number') {
      const capacityForEdit = goalTarget - (totalBucketTargets - bucket.target_amount);
      if (targetAmount > capacityForEdit) {
        setLocalMessage(`Bucket target exceeds remaining capacity. You have ${formatCurrency(Math.max(0, capacityForEdit))} available for this bucket.`);
        return;
      }
    }

    setSaving(true);
    const result = await onUpdate(bucket, {
      name: draftName.trim(),
      target_amount: targetAmount,
    });
    setSaving(false);

    if (result.error) {
      setLocalMessage(result.error);
      return;
    }

    setLocalMessage('Bucket updated.');
    setEditingId(null);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;

    if (bucketSaved(pendingDelete.id, logs) !== 0) {
      setLocalMessage('This bucket has deposit history. Move or correct those logs before deleting it.');
      setPendingDelete(null);
      return;
    }

    setSaving(true);
    const result = await onDelete(pendingDelete);
    setSaving(false);
    setPendingDelete(null);

    if (result.error) {
      setLocalMessage(result.error);
      return;
    }

    setLocalMessage('Bucket deleted.');
  }

  function handleCreate() {
    if (createTargetOverCapacity) {
      setLocalMessage(`Bucket target exceeds remaining capacity. You have ${formatCurrency(remainingCapacity ?? 0)} remaining for bucket targets.`);
      return;
    }
    onCreate();
  }

  const blockedDelete = pendingDelete ? bucketSaved(pendingDelete.id, logs) !== 0 : false;

  return (
    <div className="flex flex-col gap-4">
      {(statusMessage || localMessage) && (
        <p className="rounded-2xl bg-brand-50 px-4 py-3 font-mono text-xs text-brand-800">
          {localMessage ?? statusMessage}
        </p>
      )}
      <BucketSummary
        buckets={buckets}
        logs={logs}
        goalTarget={goalTarget}
        totalBucketTargets={totalBucketTargets}
        editingId={editingId}
        draftName={draftName}
        draftTarget={draftTarget}
        saving={saving}
        onDraftNameChange={setDraftName}
        onDraftTargetChange={value => setDraftTarget(value.replace(/[^0-9]/g, ''))}
        onStartEdit={startEdit}
        onCancelEdit={cancelEdit}
        onSaveEdit={saveEdit}
        onAskDelete={(bucket) => {
          setLocalMessage(null);
          setPendingDelete(bucket);
        }}
      />
      {typeof goalTarget === 'number' && (
        <TargetCapacitySummary
          goalTarget={goalTarget}
          allocated={totalBucketTargets}
        />
      )}
      <CreateBucketForm
        category={category}
        options={options}
        name={name}
        target={target}
        targetHelper={typeof remainingCapacity === 'number'
          ? `${formatCurrency(remainingCapacity)} remaining for bucket targets`
          : undefined}
        targetError={createTargetOverCapacity
          ? `This exceeds the remaining bucket target capacity by ${formatCurrency(createTargetAmount - (remainingCapacity ?? 0))}.`
          : undefined}
        onCategoryChange={onCategoryChange}
        onNameChange={onNameChange}
        onTargetChange={onTargetChange}
        onSubmit={handleCreate}
      />
      <ConfirmModal
        open={Boolean(pendingDelete)}
        title={blockedDelete ? 'Bucket has history' : 'Delete bucket?'}
        body={
          pendingDelete
            ? blockedDelete
              ? `${pendingDelete.name} has saved activity attached to it, so it cannot be deleted yet.`
              : `Delete ${pendingDelete.name}? This only removes the bucket setup and cannot be undone.`
            : ''
        }
        confirmLabel={blockedDelete ? 'Got it' : 'Delete'}
        danger={!blockedDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={blockedDelete ? () => setPendingDelete(null) : confirmDelete}
      />
    </div>
  );
}

function TargetCapacitySummary({ goalTarget, allocated }: { goalTarget: number; allocated: number }) {
  const remaining = Math.max(0, goalTarget - allocated);

  return (
    <div className="rounded-2xl bg-brand-50 px-4 py-3 font-mono text-xs text-ink-muted">
      <p className="font-bold text-ink">Main goal target: {formatCurrency(goalTarget)}</p>
      <p className="mt-1">{formatCurrency(allocated)} allocated of {formatCurrency(goalTarget)}</p>
      <p className="mt-1">{formatCurrency(remaining)} remaining for bucket targets</p>
    </div>
  );
}

function BucketSummary({
  buckets,
  logs,
  goalTarget,
  totalBucketTargets,
  editingId,
  draftName,
  draftTarget,
  saving,
  onDraftNameChange,
  onDraftTargetChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onAskDelete,
}: {
  buckets: Bucket[];
  logs: SavingsLog[];
  goalTarget?: number | null;
  totalBucketTargets: number;
  editingId: string | null;
  draftName: string;
  draftTarget: string;
  saving: boolean;
  onDraftNameChange: (value: string) => void;
  onDraftTargetChange: (value: string) => void;
  onStartEdit: (bucket: Bucket) => void;
  onCancelEdit: () => void;
  onSaveEdit: (bucket: Bucket) => void;
  onAskDelete: (bucket: Bucket) => void;
}) {
  if (buckets.length === 0) {
    return <p className="font-mono text-xs text-ink-muted">No buckets yet. Create one below.</p>;
  }

  return (
    <div className="rounded-3xl bg-surface p-4 shadow-soft">
      <SectionLabel tone="brand">Current Buckets</SectionLabel>
      <div className="mt-3 flex flex-col gap-3">
        {buckets.map(bucket => {
          const saved = bucketSaved(bucket.id, logs);
          const remaining = Math.max(0, bucket.target_amount - saved);
          const editing = editingId === bucket.id;
          const capacityForEdit = typeof goalTarget === 'number'
            ? goalTarget - (totalBucketTargets - bucket.target_amount)
            : null;
          const draftTargetAmount = Number(draftTarget);
          const editTargetError = editing
            && typeof capacityForEdit === 'number'
            && Number.isFinite(draftTargetAmount)
            && draftTargetAmount > capacityForEdit
              ? `This exceeds the remaining bucket target capacity by ${formatCurrency(draftTargetAmount - capacityForEdit)}.`
              : undefined;

          return (
            <div key={bucket.id} className="rounded-2xl bg-brand-50 px-4 py-3">
              {editing ? (
                <div className="flex flex-col gap-3">
                  <FormField label="Bucket Name">
                    <TextInput
                      value={draftName}
                      leadingIcon={<IconEdit size={16} />}
                      onChange={event => onDraftNameChange(event.target.value)}
                    />
                  </FormField>
                  <FormField
                    label="Target Amount"
                    helper={typeof capacityForEdit === 'number' ? `${formatCurrency(Math.max(0, capacityForEdit))} available for this bucket` : undefined}
                    error={editTargetError}
                  >
                    <TextInput
                      value={draftTarget}
                      inputMode="numeric"
                      leadingIcon={<IconPiggyBank size={16} />}
                      onChange={event => onDraftTargetChange(event.target.value)}
                    />
                  </FormField>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="md"
                      leadingIcon={<IconX size={16} />}
                      onClick={onCancelEdit}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      leadingIcon={<IconCheck size={16} />}
                      onClick={() => onSaveEdit(bucket)}
                      disabled={saving}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-sm font-bold text-ink">{bucket.name}</span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-ink-muted">
                      {formatCurrency(saved)} saved / {formatCurrency(bucket.target_amount)} target
                    </p>
                    <p className="mt-1 font-mono text-xs text-ink-muted">
                      {formatCurrency(remaining)} remaining
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <IconButton
                      type="button"
                      size="sm"
                      ariaLabel={`Edit ${bucket.name}`}
                      onClick={() => onStartEdit(bucket)}
                    >
                      <IconEdit size={16} />
                    </IconButton>
                    <IconButton
                      type="button"
                      size="sm"
                      ariaLabel={`Delete ${bucket.name}`}
                      className="bg-danger-soft text-danger hover:bg-danger-soft/80"
                      onClick={() => onAskDelete(bucket)}
                    >
                      <IconTrash size={16} />
                    </IconButton>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
