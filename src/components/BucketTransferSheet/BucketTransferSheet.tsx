import { type ChangeEvent, type ReactNode, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useAnimation } from 'framer-motion';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import {
  type TransferErrorHint,
  useTransferBucketMoney,
} from '../../hooks/useTransferBucketMoney';
import { useI18n } from '../../i18n/useI18n';
import { FADE_TRANSITION, MICRO_BOUNCE_TRANSITION, SPRING } from '../../lib/motion';
import type { TransferBucketMoneyResult } from '../../types';
import { Button } from '../Button/Button';
import { FormField } from '../FormField/FormField';
import { IconArrowRight, IconPiggyBank } from '../Icon/Icon';
import { IconBubble } from '../IconBubble/IconBubble';
import Pressable from '../Pressable/Pressable';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { TextInput } from '../TextInput/TextInput';

export interface TransferBucketOption {
  id: string;
  name: string;
  saved: number;
  target: number;
  icon: ReactNode;
}

interface BucketTransferSheetProps {
  open: boolean;
  onClose: () => void;
  /** Own, active buckets eligible as source or destination. Caller filters out archived + partner-owned. */
  buckets: TransferBucketOption[];
  initialSourceId?: string | null;
  initialDestinationId?: string | null;
  /** Fires once the RPC reports success (including the idempotency-reused case). */
  onSuccess?: (result: TransferBucketMoneyResult) => void;
}

type Step = 'edit' | 'review' | 'success';

const contentVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: SPRING.content },
};

type TransferErrorCopy = {
  same_bucket: string;
  invalid_amount: string;
  insufficient_balance: string;
  source_archived: string;
  destination_archived: string;
  partner_source: string;
  partner_destination: string;
  cross_room: string;
  not_room_member: string;
  source_missing: string;
  destination_missing: string;
  unauthenticated: string;
  invalid_request: string;
  unknown: string;
};

function mapHintToErrorKey(hint: TransferErrorHint): keyof TransferErrorCopy {
  switch (hint) {
    case 'transfer_same_bucket': return 'same_bucket';
    case 'transfer_invalid_amount': return 'invalid_amount';
    case 'transfer_insufficient_balance': return 'insufficient_balance';
    case 'transfer_source_archived': return 'source_archived';
    case 'transfer_destination_archived': return 'destination_archived';
    case 'transfer_partner_source': return 'partner_source';
    case 'transfer_partner_destination': return 'partner_destination';
    case 'transfer_cross_room': return 'cross_room';
    case 'transfer_not_room_member': return 'not_room_member';
    case 'transfer_source_missing': return 'source_missing';
    case 'transfer_destination_missing': return 'destination_missing';
    case 'transfer_unauthenticated': return 'unauthenticated';
    case 'transfer_invalid_request': return 'invalid_request';
    case 'transfer_unknown':
    default:
      return 'unknown';
  }
}

/**
 * Top-level transfer sheet. Mounts the inner body inside AnimatePresence
 * so closing then reopening the sheet starts from a clean state without
 * needing a reset-from-effect pattern (which trips the
 * `react-hooks/set-state-in-effect` rule).
 */
export function BucketTransferSheet({
  open,
  onClose,
  buckets,
  initialSourceId,
  initialDestinationId,
  onSuccess,
}: BucketTransferSheetProps) {
  useBodyScrollLock(open);

  return createPortal(
    <AnimatePresence>
      {open && (
        <BucketTransferSheetInner
          key="bucket-transfer-sheet-body"
          buckets={buckets}
          initialSourceId={initialSourceId}
          initialDestinationId={initialDestinationId}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}
    </AnimatePresence>,
    document.body,
  );
}

interface InnerProps {
  buckets: TransferBucketOption[];
  initialSourceId?: string | null;
  initialDestinationId?: string | null;
  onClose: () => void;
  onSuccess?: (result: TransferBucketMoneyResult) => void;
}

function pickInitialSelections(
  buckets: TransferBucketOption[],
  initialSourceId?: string | null,
  initialDestinationId?: string | null,
): { sourceId: string | null; destinationId: string | null } {
  const firstBucket = buckets[0]?.id ?? null;

  const sourceId =
    initialSourceId && buckets.some(b => b.id === initialSourceId)
      ? initialSourceId
      : firstBucket;

  const destinationId =
    initialDestinationId
    && initialDestinationId !== sourceId
    && buckets.some(b => b.id === initialDestinationId)
      ? initialDestinationId
      : buckets.find(b => b.id !== sourceId)?.id ?? null;

  return { sourceId, destinationId };
}

function BucketTransferSheetInner({
  buckets,
  initialSourceId,
  initialDestinationId,
  onClose,
  onSuccess,
}: InnerProps) {
  const { copy, formatMoney } = useI18n();
  const { transfer, pending } = useTransferBucketMoney();
  const innerControls = useAnimation();

  const [{ sourceId: initialSource, destinationId: initialDestination }] = useState(
    () => pickInitialSelections(buckets, initialSourceId, initialDestinationId),
  );
  const [step, setStep] = useState<Step>('edit');
  const [sourceId, setSourceId] = useState<string | null>(initialSource);
  const [destinationId, setDestinationId] = useState<string | null>(initialDestination);
  const [amountValue, setAmountValue] = useState('');
  const [noteValue, setNoteValue] = useState('');
  const [errorKey, setErrorKey] = useState<keyof TransferErrorCopy | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<TransferBucketMoneyResult | null>(null);
  const [showRing, setShowRing] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);

  const source = useMemo(() => buckets.find(b => b.id === sourceId) ?? null, [buckets, sourceId]);
  const destination = useMemo(
    () => buckets.find(b => b.id === destinationId) ?? null,
    [buckets, destinationId],
  );

  const amountNumber = Number(amountValue);
  const amountIsValid = Number.isFinite(amountNumber) && amountNumber > 0;
  const sameBucket = sourceId !== null && sourceId === destinationId;
  const insufficientLocal = source ? amountNumber > source.saved : false;

  const canReview = !sameBucket
    && Boolean(source)
    && Boolean(destination)
    && amountIsValid
    && !insufficientLocal;

  function clearInlineError() {
    if (errorKey) {
      setErrorKey(null);
      setErrorDetail(null);
    }
  }

  function handleClose() {
    if (pending) return;
    onClose();
  }

  function handleAmountChange(event: ChangeEvent<HTMLInputElement>) {
    // Allow only digits + a single decimal point (RPC validates to 2dp).
    const raw = event.target.value.replace(/[^0-9.]/g, '');
    const parts = raw.split('.');
    const next = parts.length > 1
      ? `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`
      : raw;
    setAmountValue(next);
    clearInlineError();
  }

  function handleUseMax() {
    if (!source) return;
    if (source.saved <= 0) return;
    setAmountValue(String(source.saved));
    clearInlineError();
  }

  function handleSwap() {
    if (!source || !destination) return;
    setSourceId(destination.id);
    setDestinationId(source.id);
    clearInlineError();
  }

  function handleSelectSource(id: string) {
    setSourceId(id);
    if (id === destinationId) {
      const next = buckets.find(b => b.id !== id)?.id ?? null;
      setDestinationId(next);
    }
    clearInlineError();
  }

  function handleSelectDestination(id: string) {
    setDestinationId(id);
    if (id === sourceId) {
      const next = buckets.find(b => b.id !== id)?.id ?? null;
      setSourceId(next);
    }
    clearInlineError();
  }

  function handleReview() {
    if (!canReview) return;
    setStep('review');
  }

  async function handleMove() {
    if (!source || !destination || !amountIsValid || sameBucket) return;
    // Reuse the same request id when the user retries after a network
    // failure so the RPC idempotency dedup kicks in instead of charging
    // the source bucket twice for the same intent.
    const id = requestId ?? crypto.randomUUID();
    if (!requestId) setRequestId(id);

    const result = await transfer({
      sourceBucketId: source.id,
      destinationBucketId: destination.id,
      amount: amountNumber,
      note: noteValue.trim() ? noteValue.trim() : null,
      clientRequestId: id,
    });

    if (result.error) {
      setErrorKey(mapHintToErrorKey(result.error.hint));
      setErrorDetail(result.error.detail ?? null);
      // Keep form values + step so the user can fix and retry.
      return;
    }

    if (result.data) {
      setSuccessResult(result.data);
      setStep('success');
      setShowRing(true);
      // Brief success pulse, then close. Matches BucketSheet's tactile feel.
      await new Promise((r) => setTimeout(r, 520));
      await innerControls.start({ y: 8, transition: MICRO_BOUNCE_TRANSITION });
      onSuccess?.(result.data);
      onClose();
    }
  }

  const buckCopy = copy.bucketTransfer;
  const errorMessage = errorKey ? buckCopy.errors[errorKey] : null;
  const tooFewBuckets = buckets.length < 2;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="bucket-transfer-backdrop"
        className="fixed inset-0 z-40 bg-ink/25 backdrop-blur-[3px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={FADE_TRANSITION}
        onClick={handleClose}
      />

      {/* Sheet */}
      <motion.div
        key="bucket-transfer-sheet"
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md touch-none"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SPRING.sheet}
        drag={pending ? false : 'y'}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.45 }}
        onDragEnd={(_, info) => {
          if (pending) return;
          if (info.offset.y > 90 || info.velocity.y > 550) handleClose();
        }}
      >
        <motion.div
          animate={innerControls}
          className={`rounded-t-3xl bg-bg shadow-neuRaised overflow-hidden${showRing ? ' animate-success-ring' : ''}`}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-pill bg-well" />
          </div>

          <div className="touch-pan-y overflow-y-auto overscroll-contain max-h-[85dvh] px-5 pb-8 pt-2">
            {tooFewBuckets ? (
              <div className="flex flex-col gap-4 py-4">
                <SectionLabel tone="muted">{buckCopy.sheetTitle}</SectionLabel>
                <h2 className="font-mono text-lg font-bold leading-tight text-ink">
                  {buckCopy.emptyTitle}
                </h2>
                <p className="font-mono text-sm leading-6 text-ink-muted">
                  {buckCopy.emptyBody}
                </p>
                <Button variant="primary" size="md" onClick={handleClose}>
                  {buckCopy.emptyCloseButton}
                </Button>
              </div>
            ) : (
              <motion.div
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                className="flex flex-col gap-5"
              >
                {step === 'edit' && source && destination && (
                  <>
                    <motion.div variants={itemVariants}>
                      <SectionLabel tone="muted">{buckCopy.sheetTitle}</SectionLabel>
                      <p className="mt-1 font-mono text-xs text-ink-muted">
                        {buckCopy.sheetSubtitle}
                      </p>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <SectionLabel tone="brand">{buckCopy.fromLabel}</SectionLabel>
                      <BucketPickerRow
                        buckets={buckets}
                        selectedId={source.id}
                        disabledId={destination.id}
                        onSelect={handleSelectSource}
                        savedChipBuilder={buckCopy.bucketChipSaved}
                        formatMoney={formatMoney}
                      />
                      <p className="mt-2 font-mono text-xs text-ink-muted">
                        {buckCopy.availableInBucket(formatMoney(source.saved))}
                      </p>
                    </motion.div>

                    <motion.div variants={itemVariants} className="flex justify-center">
                      <button
                        type="button"
                        onClick={handleSwap}
                        disabled={buckets.length < 2}
                        className="inline-flex items-center gap-2 rounded-pill bg-brand-50 px-3 py-1.5 font-mono text-xs font-bold text-brand-800 hover:bg-brand-100 active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        <IconArrowRight size={14} />
                        {buckCopy.swapButton}
                      </button>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <SectionLabel tone="brand">{buckCopy.toLabel}</SectionLabel>
                      <BucketPickerRow
                        buckets={buckets}
                        selectedId={destination.id}
                        disabledId={source.id}
                        onSelect={handleSelectDestination}
                        savedChipBuilder={buckCopy.bucketChipSaved}
                        formatMoney={formatMoney}
                      />
                    </motion.div>

                    {sameBucket && (
                      <motion.p
                        variants={itemVariants}
                        className="rounded-lg bg-danger-soft px-3 py-2 font-mono text-xs text-danger"
                      >
                        {buckCopy.sameBucketHelper}
                      </motion.p>
                    )}

                    <motion.div variants={itemVariants}>
                      <div className="flex items-end justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <FormField
                            label={buckCopy.amountLabel}
                            helper={buckCopy.availableInBucket(formatMoney(source.saved))}
                            error={insufficientLocal ? buckCopy.errors.insufficient_balance : undefined}
                          >
                            <TextInput
                              value={amountValue}
                              inputMode="decimal"
                              placeholder={buckCopy.amountPlaceholder}
                              leadingIcon={<IconPiggyBank size={16} />}
                              onChange={handleAmountChange}
                              error={insufficientLocal}
                            />
                          </FormField>
                        </div>
                        <button
                          type="button"
                          onClick={handleUseMax}
                          disabled={source.saved <= 0}
                          className="mb-1 shrink-0 rounded-pill bg-brand-50 px-3 py-2 font-mono text-xs font-bold text-brand-800 hover:bg-brand-100 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                          {buckCopy.useMaxButton}
                        </button>
                      </div>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <FormField label={buckCopy.noteLabel} helper={buckCopy.notePrivateHelper}>
                        <TextInput
                          value={noteValue}
                          placeholder={buckCopy.notePlaceholder}
                          onChange={(event) => setNoteValue(event.target.value)}
                          maxLength={200}
                        />
                      </FormField>
                    </motion.div>

                    {errorMessage && (
                      <motion.p
                        variants={itemVariants}
                        className="rounded-lg bg-danger-soft px-3 py-2 font-mono text-xs text-danger"
                      >
                        {errorMessage}
                        {errorDetail ? ` (${errorDetail})` : ''}
                      </motion.p>
                    )}

                    <motion.div variants={itemVariants} className="grid grid-cols-2 gap-2">
                      <Button variant="ghost" size="md" onClick={handleClose}>
                        {buckCopy.cancelButton}
                      </Button>
                      <Button
                        variant="action"
                        size="md"
                        disabled={!canReview}
                        onClick={handleReview}
                      >
                        {buckCopy.reviewButton}
                      </Button>
                    </motion.div>
                  </>
                )}

                {step === 'review' && source && destination && (
                  <>
                    <motion.div variants={itemVariants}>
                      <SectionLabel tone="muted">{buckCopy.reviewEyebrow}</SectionLabel>
                      <h2 className="mt-1 font-mono text-2xl font-bold leading-tight text-ink">
                        {buckCopy.reviewHeading(formatMoney(amountNumber))}
                      </h2>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <div className="rounded-xl bg-surface p-4 shadow-soft">
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                          <ReviewBucketCard
                            column={buckCopy.sourceColumnLabel}
                            bucket={source}
                            formatMoney={formatMoney}
                          />
                          <IconArrowRight size={20} className="text-brand-500 shrink-0" />
                          <ReviewBucketCard
                            column={buckCopy.destinationColumnLabel}
                            bucket={destination}
                            formatMoney={formatMoney}
                          />
                        </div>
                        <div className="mt-4 rounded-lg bg-brand-50 px-3 py-2">
                          <SectionLabel tone="muted">{buckCopy.reviewNoteLabel}</SectionLabel>
                          <p className="mt-1 font-mono text-xs text-ink-muted">
                            {noteValue.trim() ? noteValue.trim() : buckCopy.reviewNoneLabel}
                          </p>
                        </div>
                      </div>
                    </motion.div>

                    {errorMessage && (
                      <motion.p
                        variants={itemVariants}
                        className="rounded-lg bg-danger-soft px-3 py-2 font-mono text-xs text-danger"
                      >
                        {errorMessage}
                        {errorDetail ? ` (${errorDetail})` : ''}
                      </motion.p>
                    )}

                    <motion.div variants={itemVariants} className="grid grid-cols-2 gap-2">
                      <Button
                        variant="ghost"
                        size="md"
                        disabled={pending}
                        onClick={() => setStep('edit')}
                      >
                        {buckCopy.changeDetailsButton}
                      </Button>
                      <Button
                        variant="action"
                        size="md"
                        disabled={pending}
                        onClick={handleMove}
                      >
                        {pending
                          ? buckCopy.movingButton
                          : errorKey
                            ? buckCopy.tryAgainButton
                            : buckCopy.moveAmountButton(formatMoney(amountNumber))}
                      </Button>
                    </motion.div>
                  </>
                )}

                {step === 'success' && successResult && source && destination && (
                  <motion.div variants={itemVariants} className="flex flex-col items-center gap-3 py-6">
                    <IconBubble tone="solid" size="xl">
                      <IconPiggyBank size={24} />
                    </IconBubble>
                    <h2 className="font-mono text-lg font-bold leading-tight text-ink">
                      {buckCopy.successTitle}
                    </h2>
                    <p className="text-center font-mono text-sm text-ink-muted">
                      {buckCopy.successBody(
                        formatMoney(successResult.amount),
                        source.name,
                        destination.name,
                      )}
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}

interface BucketPickerRowProps {
  buckets: TransferBucketOption[];
  selectedId: string;
  disabledId: string;
  onSelect: (id: string) => void;
  savedChipBuilder: (amount: string) => string;
  formatMoney: (amount: number) => string;
}

function BucketPickerRow({
  buckets,
  selectedId,
  disabledId,
  onSelect,
  savedChipBuilder,
  formatMoney,
}: BucketPickerRowProps) {
  return (
    <div className="mt-2 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
      {buckets.map((bucket) => {
        const selected = bucket.id === selectedId;
        const disabled = bucket.id === disabledId;
        return (
          <Pressable
            key={bucket.id}
            onClick={() => {
              if (disabled) return;
              onSelect(bucket.id);
            }}
            className={
              'flex shrink-0 snap-start flex-col items-start gap-1 rounded-2xl border px-3 py-2.5 text-left transition-all min-w-[150px] '
              + (selected
                ? 'border-brand-500 bg-brand-50 shadow-soft'
                : disabled
                  ? 'border-brand-100 bg-surfaceAlt opacity-50 cursor-not-allowed'
                  : 'border-brand-100 bg-surface hover:border-brand-300')
            }
          >
            <div className="flex w-full items-center gap-2">
              <IconBubble tone={selected ? 'solid' : 'peach'} size="sm">
                {bucket.icon}
              </IconBubble>
              <span className="truncate font-mono text-sm font-bold text-ink">{bucket.name}</span>
            </div>
            <span className="font-mono text-[11px] text-ink-muted">
              {savedChipBuilder(formatMoney(bucket.saved))}
            </span>
          </Pressable>
        );
      })}
    </div>
  );
}

interface ReviewBucketCardProps {
  column: string;
  bucket: TransferBucketOption;
  formatMoney: (amount: number) => string;
}

function ReviewBucketCard({ column, bucket, formatMoney }: ReviewBucketCardProps) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 text-center">
      <SectionLabel tone="muted">{column}</SectionLabel>
      <IconBubble tone="peach" size="md">{bucket.icon}</IconBubble>
      <p className="w-full truncate font-mono text-sm font-bold text-ink" title={bucket.name}>
        {bucket.name}
      </p>
      <p className="font-mono text-[11px] text-ink-muted">{formatMoney(bucket.saved)}</p>
    </div>
  );
}
