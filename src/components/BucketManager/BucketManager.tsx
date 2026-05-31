import { useEffect, useMemo, useState } from 'react';
import { bucketSaved, sumTargets } from '../../lib/buckets';
import { isLowConfidenceCategory } from '../../lib/bucketCategories';
import { type ArchiveErrorHint, useArchiveBucket } from '../../hooks/useArchiveBucket';
import type { Bucket, BucketCategory, BucketTransfer, SavingsLog, SavingRuleType } from '../../types';
import { BucketCategoryIcon } from '../BucketCategoryIcon/BucketCategoryIcon';
import { BucketCategoryReviewModal } from '../BucketCategoryReviewModal/BucketCategoryReviewModal';
import { BucketEditForm, type BucketEditFormResult, type BucketEditValues } from '../BucketEditForm/BucketEditForm';
import { BucketTransferSheet, type TransferBucketOption } from '../BucketTransferSheet/BucketTransferSheet';
import { CATEGORY_ACCENT, DEFAULT_ACCENT } from '../../lib/bucketAccent';
import { Button } from '../Button/Button';
import { IconEdit, IconTrash } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { RemoveBucketModal, type RemoveBucketDestination } from '../RemoveBucketModal/RemoveBucketModal';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { useI18n } from '../../i18n/useI18n';

interface BucketManagerProps {
  buckets: Bucket[];
  logs: SavingsLog[];
  /** Caller's own bucket transfers, for transfer-aware balance display. */
  transfers?: BucketTransfer[];
  /** Bucket to flash an edge highlight on when the manager opens (e.g. tapped via the edit-mode pencil). */
  highlightBucketId?: string | null;
  goalTarget?: number | null;
  statusMessage?: string | null;
  onUpdate: (bucket: Bucket, next: { name: string; target_amount: number; deadline?: string | null; saving_rule_type?: SavingRuleType | null; saving_rule_amount?: number | null; saving_rule_start_amount?: number | null; saving_rule_increment?: number | null; saving_rule_cap?: number | null; saving_rule_day_count?: number | null; saving_rule_start_date?: string | null; reminder_day?: number | null }) => Promise<{ error?: string; code?: string; duplicateName?: string; deadlineExtensionWarning?: boolean }>;
  /** Room end date used to pre-fill a sensible default deadline when a bucket has none. */
  roomEndDate?: string | null;
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
  highlightBucketId,
  goalTarget,
  roomEndDate,
  statusMessage,
  onUpdate,
  onReviewCategories,
  onTransferSheetOpenChange,
  onRemoved,
}: BucketManagerProps) {
  const { copy } = useI18n();
  const { archive, pending: removePending } = useArchiveBucket();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<Bucket | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [transferSheetSourceId, setTransferSheetSourceId] = useState<string | null>(null);
  const [balanceOverrides, setBalanceOverrides] = useState<Record<string, number>>({});
  const [localMessage, setLocalMessage] = useState<string | null>(null);
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
    setLocalMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setLocalMessage(null);
  }

  function handleEdited(result: { deadlineExtensionWarning?: boolean }) {
    setLocalMessage(result.deadlineExtensionWarning
      ? copy.bucket.deadlineExtensionPrompt
      : copy.bucket.updatedSuccess);
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
      {typeof goalTarget === 'number' && (
        <TargetCapacitySummary
          goalTarget={goalTarget}
          allocated={totalBucketTargets}
        />
      )}
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
        roomEndDate={roomEndDate}
        highlightBucketId={highlightBucketId}
        editingId={editingId}
        onStartEdit={startEdit}
        onCancelEdit={cancelEdit}
        onSave={onUpdate}
        onSaved={handleEdited}
        onAskRemove={openRemove}
      />
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
  const pct = goalTarget > 0 ? (allocated / goalTarget) * 100 : 0;

  return (
    <div className="rounded-xl bg-brand-50 px-4 py-3">
      <div className="flex items-baseline justify-between gap-2 font-mono">
        <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted">
          {copy.bucket.mainGoalLabel}
        </span>
        <span className="text-sm font-bold tabular-nums text-ink">{formatMoney(goalTarget)}</span>
      </div>
      <div className="mt-2">
        <ProgressBar value={pct} tone="primary" size="sm" />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 font-mono text-[11px]">
        <span className="text-ink-muted">
          {copy.bucket.allocatedLabel} <span className="font-bold tabular-nums text-ink">{formatMoney(allocated)}</span>
        </span>
        <span className="text-ink-muted">
          {copy.bucket.remainingLabel} <span className="font-bold tabular-nums text-ink">{formatMoney(remaining)}</span>
        </span>
      </div>
    </div>
  );
}

function BucketSummary({
  buckets,
  logs,
  transfers,
  goalTarget,
  roomEndDate,
  highlightBucketId,
  editingId,
  onStartEdit,
  onCancelEdit,
  onSave,
  onSaved,
  onAskRemove,
}: {
  buckets: Bucket[];
  logs: SavingsLog[];
  transfers?: BucketTransfer[];
  goalTarget?: number | null;
  roomEndDate?: string | null;
  highlightBucketId?: string | null;
  editingId: string | null;
  onStartEdit: (bucket: Bucket) => void;
  onCancelEdit: () => void;
  onSave: (bucket: Bucket, next: BucketEditValues) => Promise<BucketEditFormResult>;
  onSaved: (result: BucketEditFormResult) => void;
  onAskRemove: (bucket: Bucket) => void;
}) {
  const { copy } = useI18n();

  if (buckets.length === 0) {
    return <p className="font-mono text-xs text-ink-muted">{copy.bucket.noBucketsYet}</p>;
  }

  const editingBucket = editingId ? buckets.find(b => b.id === editingId) ?? null : null;

  return (
    <div className="rounded-xl bg-surface p-4 shadow-soft">
      <SectionLabel tone="brand">{copy.bucket.currentBuckets}</SectionLabel>
      {editingBucket ? (
        <div className="mt-3 rounded-lg bg-brand-50 px-4 py-3">
          <BucketEditForm
            bucket={editingBucket}
            buckets={buckets}
            logs={logs}
            transfers={transfers}
            goalTarget={goalTarget}
            roomEndDate={roomEndDate}
            onCancel={onCancelEdit}
            onSave={onSave}
            onSaved={onSaved}
          />
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {buckets.map(bucket => (
            <ManageBucketCard
              key={bucket.id}
              bucket={bucket}
              saved={bucketSaved(bucket.id, logs, transfers)}
              highlighted={bucket.id === highlightBucketId}
              onEdit={() => onStartEdit(bucket)}
              onAskRemove={() => onAskRemove(bucket)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ManageBucketCard({
  bucket,
  saved,
  highlighted,
  onEdit,
  onAskRemove,
}: {
  bucket: Bucket;
  saved: number;
  highlighted: boolean;
  onEdit: () => void;
  onAskRemove: () => void;
}) {
  const { copy, formatMoney } = useI18n();
  const accent = (bucket.category && CATEGORY_ACCENT[bucket.category]) || DEFAULT_ACCENT;
  const pct = bucket.target_amount > 0 ? (saved / bucket.target_amount) * 100 : 0;

  return (
    <div
      className={
        'flex flex-col rounded-2xl border-[1.5px] bg-surface p-3 shadow-soft'
        + (highlighted ? ' bucket-highlight-focus' : '')
      }
      style={{ borderColor: accent.border }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full [&_svg]:h-[18px] [&_svg]:w-[18px]"
          style={{ background: accent.tint, color: accent.accent }}
        >
          <BucketCategoryIcon category={bucket.category} size={18} />
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold leading-tight text-ink">
          {bucket.name}
        </span>
      </div>

      <p className="mt-2 flex min-w-0 items-baseline gap-1 font-mono leading-none">
        <span className="shrink-0 whitespace-nowrap text-sm font-bold" style={{ color: accent.accent }}>
          {formatMoney(saved)}
        </span>
        <span className="truncate text-[11px] text-ink-dim">
          / {formatMoney(bucket.target_amount)}
        </span>
      </p>

      <div className="mt-2 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <ProgressBar value={pct} tone="theme" themeHex={accent.accent} size="sm" className="bg-well" />
        </div>
        <span className="shrink-0 font-mono text-[11px] font-bold" style={{ color: accent.accent }}>
          {Math.round(pct)}%
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <IconButton
          type="button"
          variant="solid"
          size="sm"
          ariaLabel={copy.bucket.deleteAriaLabel(bucket.name)}
          className="bg-danger/90 text-danger hover:bg-danger/35"
          onClick={onAskRemove}
        >
          <IconTrash size={15} />
        </IconButton>
        <IconButton
          type="button"
          variant="solid"
          size="sm"
          ariaLabel={copy.bucket.editAriaLabel(bucket.name)}
          onClick={onEdit}
        >
          <IconEdit size={15} />
        </IconButton>
      </div>
    </div>
  );
}
