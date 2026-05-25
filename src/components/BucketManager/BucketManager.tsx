import { useEffect, useMemo, useState } from 'react';
import { bucketSaved, hasDuplicateBucketName, sumTargets } from '../../lib/buckets';
import { isLowConfidenceCategory } from '../../lib/bucketCategories';
import { type ArchiveErrorHint, useArchiveBucket } from '../../hooks/useArchiveBucket';
import type { Bucket, BucketCategory, BucketTransfer, SavingsLog } from '../../types';
import { BucketCategoryIcon } from '../BucketCategoryIcon/BucketCategoryIcon';
import { BucketCategoryReviewModal } from '../BucketCategoryReviewModal/BucketCategoryReviewModal';
import { BucketTransferSheet, type TransferBucketOption } from '../BucketTransferSheet/BucketTransferSheet';
import { Button } from '../Button/Button';
import { FormField } from '../FormField/FormField';
import { IconCheck, IconEdit, IconPiggyBank, IconTrash, IconX } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
import { RemoveBucketModal, type RemoveBucketDestination } from '../RemoveBucketModal/RemoveBucketModal';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { TextInput } from '../TextInput/TextInput';
import { useI18n } from '../../i18n/useI18n';

interface BucketManagerProps {
  buckets: Bucket[];
  logs: SavingsLog[];
  /** Caller's own bucket transfers, for transfer-aware balance display. */
  transfers?: BucketTransfer[];
  goalTarget?: number | null;
  statusMessage?: string | null;
  onUpdate: (bucket: Bucket, next: { name: string; target_amount: number }) => Promise<{ error?: string; code?: string; duplicateName?: string }>;
  onReviewCategories?: (updates: { id: string; category: BucketCategory }[]) => Promise<{ error?: string }>;
  onTransferSheetOpenChange?: (open: boolean) => void;
  /**
   * Called after a bucket is archived (with or without a balance
   * transfer) so the parent can refresh server-side state the local
   * `useBuckets` cache cannot observe directly.
   */
  onRemoved?: () => void | Promise<void>;
}

function mapArchiveHintToErrorKey(
  hint: ArchiveErrorHint,
): keyof ReturnType<typeof useI18n>['copy']['bucketRemove']['errors'] {
  switch (hint) {
    case 'archive_unauthenticated': return 'unauthenticated';
    case 'archive_invalid_request': return 'invalid_request';
    case 'archive_bucket_missing': return 'bucket_missing';
    case 'archive_partner_bucket': return 'partner_bucket';
    case 'archive_not_room_member': return 'not_room_member';
    case 'archive_nonzero_balance': return 'nonzero_balance';
    case 'archive_last_active': return 'last_active';
    case 'archive_same_bucket': return 'same_bucket';
    case 'archive_source_missing': return 'source_missing';
    case 'archive_destination_missing': return 'destination_missing';
    case 'archive_partner_source': return 'partner_source';
    case 'archive_partner_destination': return 'partner_destination';
    case 'archive_source_archived': return 'source_archived';
    case 'archive_destination_archived': return 'destination_archived';
    case 'archive_cross_room': return 'cross_room';
    case 'archive_protected_fields': return 'database_migration';
    case 'archive_unknown':
    default:
      return 'unknown';
  }
}

function formatArchiveErrorMessage(
  baseMessage: string,
  error: { hint: ArchiveErrorHint; code?: string; message: string; detail?: string },
): string {
  if (!import.meta.env.DEV) return baseMessage;

  const debug = [
    error.hint,
    error.code,
    error.detail,
    error.message,
  ].filter(Boolean).join(' | ');

  return debug ? `${baseMessage} (${debug})` : baseMessage;
}

export function BucketManager({
  buckets,
  logs,
  transfers,
  goalTarget,
  statusMessage,
  onUpdate,
  onReviewCategories,
  onTransferSheetOpenChange,
  onRemoved,
}: BucketManagerProps) {
  const { copy, formatMoney } = useI18n();
  const { archive, pending: removePending } = useArchiveBucket();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftTarget, setDraftTarget] = useState('');
  const [pendingRemove, setPendingRemove] = useState<Bucket | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [transferSheetSourceId, setTransferSheetSourceId] = useState<string | null>(null);
  const [balanceOverrides, setBalanceOverrides] = useState<Record<string, number>>({});
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const totalBucketTargets = sumTargets(buckets);

  const pendingRemoveSaved = pendingRemove
    ? balanceOverrides[pendingRemove.id] ?? bucketSaved(pendingRemove.id, logs, transfers)
    : 0;
  const removeDestinations: RemoveBucketDestination[] = useMemo(() => {
    if (!pendingRemove) return [];
    return buckets
      .filter(b => b.id !== pendingRemove.id)
      .map(b => ({
        id: b.id,
        name: b.name,
        saved: balanceOverrides[b.id] ?? bucketSaved(b.id, logs, transfers),
      }));
  }, [balanceOverrides, buckets, logs, transfers, pendingRemove]);

  // Mirror the dashboard's transfer-sheet shape so the "Transfer Balance
  // First" fallback opens the same sheet UI users see elsewhere.
  const transferSheetOptions: TransferBucketOption[] = useMemo(
    () => buckets.map(b => ({
      id: b.id,
      name: b.name,
      saved: balanceOverrides[b.id] ?? bucketSaved(b.id, logs, transfers),
      target: b.target_amount,
      icon: <BucketCategoryIcon category={b.category} size={20} />,
    })),
    [balanceOverrides, buckets, logs, transfers],
  );

  useEffect(() => {
    onTransferSheetOpenChange?.(transferSheetSourceId !== null);
  }, [onTransferSheetOpenChange, transferSheetSourceId]);

  useEffect(() => () => {
    onTransferSheetOpenChange?.(false);
  }, [onTransferSheetOpenChange]);

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
      setLocalMessage(copy.bucket.validationNameBeforeSaving);
      return;
    }
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setLocalMessage(copy.bucket.validationTargetAboveZero);
      return;
    }
    if (hasDuplicateBucketName(buckets, draftName, bucket.id)) {
      setLocalMessage(copy.bucket.duplicateName(draftName.trim()));
      return;
    }
    if (typeof goalTarget === 'number') {
      const capacityForEdit = goalTarget - (totalBucketTargets - bucket.target_amount);
      if (targetAmount > capacityForEdit) {
        setLocalMessage(copy.bucket.capacityErrorForEdit(formatMoney(Math.max(0, capacityForEdit))));
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
      setLocalMessage(result.code === 'duplicate_name'
        ? copy.bucket.duplicateName(result.duplicateName ?? draftName.trim())
        : result.error);
      return;
    }

    setLocalMessage(copy.bucket.updatedSuccess);
    setEditingId(null);
  }

  function openRemove(bucket: Bucket) {
    setLocalMessage(null);
    setRemoveError(null);
    setPendingRemove(bucket);
  }

  function closeRemove() {
    if (removePending) return;
    setPendingRemove(null);
    setRemoveError(null);
  }

  async function handleArchive() {
    if (!pendingRemove) return;
    setRemoveError(null);
    const result = await archive({ bucketId: pendingRemove.id });
    if (result.error) {
      if (result.error.hint === 'archive_nonzero_balance' && result.error.balance != null) {
        const sourceId = pendingRemove.id;
        setBalanceOverrides(prev => ({ ...prev, [sourceId]: result.error?.balance ?? prev[sourceId] ?? 0 }));
        if (buckets.some(b => b.id !== sourceId)) {
          setPendingRemove(null);
          setTransferSheetSourceId(sourceId);
          return;
        }
      }
      const baseMessage = copy.bucketRemove.errors[mapArchiveHintToErrorKey(result.error.hint)];
      setRemoveError(formatArchiveErrorMessage(baseMessage, result.error));
      return;
    }
    const removedName = pendingRemove.name;
    setPendingRemove(null);
    setLocalMessage(copy.bucketRemove.successRemoved(removedName));
    if (onRemoved) await onRemoved();
  }

  function handleTransferFirst() {
    if (!pendingRemove) return;
    const sourceId = pendingRemove.id;
    setPendingRemove(null);
    setRemoveError(null);
    setTransferSheetSourceId(sourceId);
  }

  const hasReviewable = onReviewCategories && buckets.some(isLowConfidenceCategory);

  async function handleReviewSave(updates: { id: string; category: BucketCategory }[]) {
    if (!onReviewCategories) return { error: 'No handler' };
    const result = await onReviewCategories(updates);
    if (!result.error) {
      setLocalMessage(copy.bucket.categoryReview.reviewedSuccess);
    }
    return result;
  }

  return (
    <div className="flex flex-col gap-4">
      {(statusMessage || localMessage) && (
        <p className="rounded-lg bg-brand-50 px-4 py-3 font-mono text-xs text-brand-800">
          {localMessage ?? statusMessage}
        </p>
      )}
      {hasReviewable && (
        <div className="flex items-center justify-between rounded-lg bg-brand-50 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs font-bold text-ink">
              {copy.bucket.categoryReview.title}
            </p>
            <p className="mt-0.5 font-mono text-xs text-ink-muted">
              {copy.bucket.categoryReview.body}
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setReviewOpen(true)}
          >
            {copy.bucket.categoryReview.cta}
          </Button>
        </div>
      )}
      <BucketSummary
        buckets={buckets}
        logs={logs}
        transfers={transfers}
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
        onAskRemove={openRemove}
      />
      {typeof goalTarget === 'number' && (
        <TargetCapacitySummary
          goalTarget={goalTarget}
          allocated={totalBucketTargets}
        />
      )}
      <RemoveBucketModal
        open={pendingRemove !== null}
        bucketName={pendingRemove?.name ?? null}
        savedAmount={pendingRemoveSaved}
        destinations={removeDestinations}
        pending={removePending}
        errorMessage={removeError}
        onClose={closeRemove}
        onArchive={handleArchive}
        onTransferFirst={handleTransferFirst}
      />
      <BucketTransferSheet
        open={transferSheetSourceId !== null}
        buckets={transferSheetOptions}
        initialSourceId={transferSheetSourceId}
        onClose={() => setTransferSheetSourceId(null)}
        onSuccess={async () => {
          setTransferSheetSourceId(null);
          if (onRemoved) await onRemoved();
        }}
      />
      {onReviewCategories && (
        <BucketCategoryReviewModal
          open={reviewOpen}
          buckets={buckets}
          onClose={() => setReviewOpen(false)}
          onSave={handleReviewSave}
        />
      )}
    </div>
  );
}

function TargetCapacitySummary({ goalTarget, allocated }: { goalTarget: number; allocated: number }) {
  const { copy, formatMoney } = useI18n();
  const remaining = Math.max(0, goalTarget - allocated);

  return (
    <div className="rounded-lg bg-brand-50 px-4 py-3 font-mono text-xs text-ink-muted">
      <p className="font-bold text-ink">{copy.bucket.mainGoalTarget(formatMoney(goalTarget))}</p>
      <p className="mt-1">{copy.bucket.allocatedOf(formatMoney(allocated), formatMoney(goalTarget))}</p>
      <p className="mt-1">{copy.bucket.remainingForBuckets(formatMoney(remaining))}</p>
    </div>
  );
}

function BucketSummary({
  buckets,
  logs,
  transfers,
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
  onAskRemove,
}: {
  buckets: Bucket[];
  logs: SavingsLog[];
  transfers?: BucketTransfer[];
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
  onAskRemove: (bucket: Bucket) => void;
}) {
  const { copy, formatMoney } = useI18n();

  if (buckets.length === 0) {
    return <p className="font-mono text-xs text-ink-muted">{copy.bucket.noBucketsYet}</p>;
  }

  return (
    <div className="rounded-xl bg-surface p-4 shadow-soft">
      <SectionLabel tone="brand">{copy.bucket.currentBuckets}</SectionLabel>
      <div className="mt-3 flex flex-col gap-3">
        {buckets.map(bucket => {
          const saved = bucketSaved(bucket.id, logs, transfers);
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
              ? copy.bucket.capacityExceededBy(formatMoney(draftTargetAmount - capacityForEdit))
              : undefined;

          return (
            <div key={bucket.id} className="rounded-lg bg-brand-50 px-4 py-3">
              {editing ? (
                <div className="flex flex-col gap-3">
                  <FormField label={copy.bucket.editNameLabel}>
                    <TextInput
                      value={draftName}
                      leadingIcon={<IconEdit size={16} />}
                      onChange={event => onDraftNameChange(event.target.value)}
                    />
                  </FormField>
                  <FormField
                    label={copy.bucket.editTargetLabel}
                    helper={typeof capacityForEdit === 'number' ? copy.bucket.capacityAvailable(formatMoney(Math.max(0, capacityForEdit))) : undefined}
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
                      {copy.bucket.editCancel}
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      leadingIcon={<IconCheck size={16} />}
                      onClick={() => onSaveEdit(bucket)}
                      disabled={saving}
                    >
                      {copy.bucket.editSave}
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
                      {copy.bucket.savedOf(formatMoney(saved), formatMoney(bucket.target_amount))}
                    </p>
                    <p className="mt-1 font-mono text-xs text-ink-muted">
                      {copy.bucket.remaining(formatMoney(remaining))}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <IconButton
                      type="button"
                      size="sm"
                      ariaLabel={copy.bucket.editAriaLabel(bucket.name)}
                      onClick={() => onStartEdit(bucket)}
                    >
                      <IconEdit size={16} />
                    </IconButton>
                    <IconButton
                      type="button"
                      size="sm"
                      ariaLabel={copy.bucket.deleteAriaLabel(bucket.name)}
                      className="bg-danger-soft text-danger hover:bg-danger-soft/80"
                      onClick={() => onAskRemove(bucket)}
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
