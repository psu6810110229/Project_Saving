import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useAnimation } from 'framer-motion';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import {
  type TransferErrorHint,
  useTransferBucketMoney,
} from '../../hooks/useTransferBucketMoney';
import { useI18n } from '../../i18n/useI18n';
import { useAmbientMotionReady, useOpenClosePrimaryMotion } from '../../lib/animationBudget';
import { FADE_TRANSITION, MICRO_BOUNCE_TRANSITION, SPRING } from '../../lib/motion';
import type { TransferBucketMoneyResult } from '../../types';
import { Button, MODAL_ACTION_ROW_REVERSE_CLASS, MODAL_SECONDARY_BUTTON_CLASS } from '../Button/Button';
import { FormField } from '../FormField/FormField';
import { IconArrowRight, IconCheckCircle, IconPiggyBank, IconSwap } from '../Icon/Icon';
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
  initialAmount?: number | null;
  suggestionReason?: string | null;
  onSuggestionShown?: () => void;
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
  initialAmount,
  suggestionReason,
  onSuggestionShown,
  onSuccess,
}: BucketTransferSheetProps) {
  useBodyScrollLock(open);
  const sheetContentReady = useOpenClosePrimaryMotion(open, 240, 350);

  return createPortal(
    <AnimatePresence>
      {open && (
        <BucketTransferSheetInner
          key="bucket-transfer-sheet-body"
          buckets={buckets}
          initialSourceId={initialSourceId}
          initialDestinationId={initialDestinationId}
          initialAmount={initialAmount}
          suggestionReason={suggestionReason}
          onSuggestionShown={onSuggestionShown}
          onClose={onClose}
          onSuccess={onSuccess}
          contentReady={sheetContentReady}
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
  initialAmount?: number | null;
  suggestionReason?: string | null;
  onSuggestionShown?: () => void;
  onClose: () => void;
  onSuccess?: (result: TransferBucketMoneyResult) => void;
  contentReady: boolean;
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

function formatAmountInputValue(amount: number): string {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

function BucketTransferSheetInner({
  buckets,
  initialSourceId,
  initialDestinationId,
  initialAmount,
  suggestionReason,
  onSuggestionShown,
  onClose,
  onSuccess,
  contentReady,
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
  const [amountValue, setAmountValue] = useState(
    () => initialAmount != null && Number.isFinite(initialAmount) && initialAmount > 0
      ? String(initialAmount)
      : '',
  );

  const suggestionFiredRef = useRef(false);
  useEffect(() => {
    if (suggestionFiredRef.current) return;
    if (suggestionReason || (initialAmount != null && initialAmount > 0)) {
      suggestionFiredRef.current = true;
      onSuggestionShown?.();
    }
  }, [suggestionReason, initialAmount, onSuggestionShown]);
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

  function handleMoveAllAmount() {
    if (!source || source.saved <= 0) return;
    setAmountValue(formatAmountInputValue(source.saved));
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
      onSuccess?.(result.data);
      // Keep the success state visible long enough to read before closing.
      await new Promise((r) => setTimeout(r, 1800));
      await innerControls.start({ y: 8, transition: MICRO_BOUNCE_TRANSITION });
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
        className="fixed inset-0 z-40 bg-ink/28"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={FADE_TRANSITION}
        onClick={handleClose}
      />

      {/* Sheet */}
      <motion.div
        key="bucket-transfer-sheet"
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SPRING.sheet}
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
                animate={contentReady ? 'visible' : 'hidden'}
                className="flex flex-col gap-4"
              >
                {step === 'edit' && source && destination && (
                  <>
                    <motion.div variants={itemVariants}>
                      <h2 className="font-mono text-2xl font-bold leading-tight text-ink">
                        {buckCopy.sheetTitle}
                      </h2>
                      {suggestionReason && (
                        <p className="mt-1 font-mono text-xs text-ink-muted">{suggestionReason}</p>
                      )}
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <h3 className="font-mono text-sm font-bold leading-tight text-brand-800">
                        {buckCopy.fromLabel}
                      </h3>
                      <BucketPickerRow
                        buckets={buckets}
                        selectedId={source.id}
                        disabledId={destination.id}
                        onSelect={handleSelectSource}
                        savedChipBuilder={buckCopy.bucketChipSaved}
                        formatMoney={formatMoney}
                      />
                    </motion.div>

                    <motion.div variants={itemVariants} className="flex justify-center">
                      <button
                        type="button"
                        onClick={handleSwap}
                        disabled={buckets.length < 2}
                        className="inline-flex items-center gap-2 rounded-pill bg-brand-50 px-3 py-1.5 font-mono text-xs font-bold text-brand-800 hover:bg-brand-100 active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        <IconSwap size={14} />
                        {buckCopy.swapButton}
                      </button>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <h3 className="font-mono text-sm font-bold leading-tight text-brand-800">
                        {buckCopy.toLabel}
                      </h3>
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
                      <FormField
                        label={buckCopy.amountLabel}
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
                      <div className="mt-2 flex justify-start">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="border border-brand-100/70 bg-brand-50/80 px-3 py-2 text-brand-800 shadow-soft hover:bg-brand-100/60 hover:text-brand-900"
                          disabled={source.saved <= 0}
                          onClick={handleMoveAllAmount}
                        >
                          {buckCopy.moveAllButton(formatMoney(source.saved))}
                        </Button>
                      </div>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <FormField label={buckCopy.noteLabel}>
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

                    <motion.div variants={itemVariants} className={MODAL_ACTION_ROW_REVERSE_CLASS}>
                      <Button
                        variant="action"
                        size="md"
                        disabled={!canReview}
                        onClick={handleReview}
                      >
                        {buckCopy.reviewButton}
                      </Button>
                      <Button variant="ghost" size="md" className={MODAL_SECONDARY_BUTTON_CLASS} onClick={handleClose}>
                        {buckCopy.cancelButton}
                      </Button>
                    </motion.div>
                  </>
                )}

                {step === 'review' && source && destination && (
                  <>
                    <motion.div variants={itemVariants}>
                      <h2 className="font-mono text-xl font-bold leading-tight text-ink">
                        {buckCopy.reviewHeading(source.name, destination.name)}
                      </h2>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <div className="rounded-xl bg-surface p-4 shadow-soft">
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                          <ReviewBucketCard
                            bucket={source}
                            formatMoney={formatMoney}
                          />
                          <TransferFlowArrow />
                          <ReviewBucketCard
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

                    <motion.div variants={itemVariants} className={MODAL_ACTION_ROW_REVERSE_CLASS}>
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
                      <Button
                        variant="ghost"
                        size="md"
                        className={MODAL_SECONDARY_BUTTON_CLASS}
                        disabled={pending}
                        onClick={() => setStep('edit')}
                      >
                        {buckCopy.changeDetailsButton}
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
  const { copy } = useI18n();
  const visibleBuckets = buckets.filter(bucket => bucket.id !== disabledId);

  return (
    <div className="mt-2 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
      {visibleBuckets.map((bucket) => {
        const selected = bucket.id === selectedId;
        const isComplete = bucket.target > 0 && bucket.saved >= bucket.target;
        return (
          <Pressable
            key={bucket.id}
            onClick={() => onSelect(bucket.id)}
            className={
              'flex shrink-0 snap-start flex-col items-start gap-1 rounded-2xl border px-3 py-2.5 text-left transition-all min-w-[150px] '
              + (selected
                ? 'border-brand-500 bg-brand-50 shadow-soft'
                : 'border-brand-100 bg-surface hover:border-brand-300')
            }
          >
            <div className="flex w-full items-center gap-2">
              <IconBubble tone={selected ? 'solid' : 'peach'} size="sm">
                {bucket.icon}
              </IconBubble>
              <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold text-ink">{bucket.name}</span>
              {isComplete && (
                <span className="shrink-0 text-accent-teal" title={copy.bucketIntent.status.done}>
                  <IconCheckCircle size={16} strokeWidth={2.25} />
                </span>
              )}
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
  bucket: TransferBucketOption;
  formatMoney: (amount: number) => string;
}

function TransferFlowArrow() {
  const ambientReady = useAmbientMotionReady();

  return (
    <div className="flex h-12 w-16 shrink-0 items-center justify-center text-brand-700">
      <motion.div
        className="flex items-center"
        animate={ambientReady ? { x: [0, 5, 0], opacity: [0.72, 1, 0.72] } : { x: 0, opacity: 0.72 }}
        transition={ambientReady ? { duration: 1.7, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
      >
        <IconArrowRight size={30} strokeWidth={2.35} />
      </motion.div>
    </div>
  );
}

function ReviewBucketCard({ bucket, formatMoney }: ReviewBucketCardProps) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 text-center">
      <IconBubble tone="peach" size="md">{bucket.icon}</IconBubble>
      <p className="w-full truncate font-mono text-sm font-bold text-ink" title={bucket.name}>
        {bucket.name}
      </p>
      <p className="font-mono text-[11px] text-ink-muted">{formatMoney(bucket.saved)}</p>
    </div>
  );
}
