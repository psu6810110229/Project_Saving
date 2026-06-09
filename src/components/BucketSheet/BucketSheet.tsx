import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useAnimation } from 'framer-motion';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { BucketHeader } from '../BucketHeader/BucketHeader';
import { Button, MODAL_ACTION_ROW_REVERSE_CLASS, MODAL_SECONDARY_BUTTON_CLASS } from '../Button/Button';
import { CompleteBucketLock } from '../CompleteBucketLock/CompleteBucketLock';
import { ComparisonTrendChart } from '../ComparisonTrendChart/ComparisonTrendChart';
import { ConfirmModal } from '../ConfirmModal/ConfirmModal';
import { FormField } from '../FormField/FormField';
import { IconPauseCircle, IconPiggyBank, IconPlayCircle, IconTrash } from '../Icon/Icon';
import { TextInput } from '../TextInput/TextInput';
import { useI18n } from '../../i18n/useI18n';
import { setPrimaryMotionState, useOpenClosePrimaryMotion } from '../../lib/animationBudget';
import { FADE_TRANSITION, MICRO_BOUNCE_TRANSITION, SPRING } from '../../lib/motion';

const contentVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.12 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: SPRING.content },
};

interface BucketSheetProps {
  open: boolean;
  onClose: () => void;
  bucketId: string;
  icon: ReactNode;
  name: string;
  saved: number;
  target: number;
  quickAmounts: number[];
  onConfirm: (amount: number) => Promise<{ error?: string }>;
  onDelete?: () => void;
  isComplete?: boolean;
  extraAmount?: number;
  nextBucketName?: string | null;
  onRequestTransferExtra?: (sourceBucketId: string) => void;
  onDoneLockOverride?: (bucketId: string) => void;
  smartDefaultAmount?: number | null;
  isPaused?: boolean;
  pausedSinceLabel?: string | null;
  canPausePlan?: boolean;
  canResumePlan?: boolean;
  onRequestPausePlan?: (bucketId: string) => void;
  onRequestResumePlan?: (bucketId: string) => void;
  trendPreview?: {
    mineLabel: string;
    theirLabel: string;
    mineSeries: (pending: number) => number[];
    theirSeries: number[];
  };
}

export function BucketSheet({
  open,
  onClose,
  bucketId,
  icon,
  name,
  saved,
  target,
  onConfirm,
  onDelete,
  isComplete,
  extraAmount,
  nextBucketName,
  onRequestTransferExtra,
  onDoneLockOverride,
  smartDefaultAmount,
  isPaused = false,
  pausedSinceLabel = null,
  canPausePlan = false,
  canResumePlan = false,
  onRequestPausePlan,
  onRequestResumePlan,
  trendPreview,
}: BucketSheetProps) {
  const { copy, formatMoney } = useI18n();
  const [selectedPill, setSelectedPill] = useState<number | null>(null);
  const [customValue, setCustomValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmingAmount, setConfirmingAmount] = useState<number | null>(null);
  const [showRing, setShowRing] = useState(false);
  const [doneLockOverridden, setDoneLockOverridden] = useState(false);
  const innerControls = useAnimation();
  const bucketAlreadyComplete = target > 0 && saved >= target;
  const showDoneLock = isComplete && !doneLockOverridden;
  const sheetContentReady = useOpenClosePrimaryMotion(open, 240, 350);

  useBodyScrollLock(open);

  useEffect(() => () => {
    setPrimaryMotionState('dragging', false);
  }, []);

  const prevBucketRef = useRef<string | null>(null);
  useEffect(() => {
    let timeoutId: number | null = null;
    if (open && bucketId && bucketId !== prevBucketRef.current) {
      prevBucketRef.current = bucketId;
      if (smartDefaultAmount != null && smartDefaultAmount > 0) {
        timeoutId = window.setTimeout(() => {
          setCustomValue(String(smartDefaultAmount));
          setSelectedPill(null);
        }, 0);
      }
    }
    if (!open) prevBucketRef.current = null;
    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [open, bucketId, smartDefaultAmount]);

  const customAmount = Number(customValue);
  const resolvedAmount =
    customValue.trim() !== '' && customAmount > 0 ? customAmount : (selectedPill ?? 0);
  const trendPreviewMineSeries = useMemo(
    () => trendPreview?.mineSeries(resolvedAmount),
    [resolvedAmount, trendPreview],
  );

  function handleCustomChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setCustomValue(next);
    if (next.trim() !== '' && selectedPill !== null) setSelectedPill(null);
  }

  function handleClose() {
    onClose();
    setTimeout(() => {
      setCustomValue('');
      setSelectedPill(null);
      setConfirmingAmount(null);
      setShowRing(false);
      setDoneLockOverridden(false);
      innerControls.set({ y: 0 });
    }, 350);
  }

  function requestConfirm() {
    if (resolvedAmount <= 0) return;
    setConfirmingAmount(resolvedAmount);
  }

  async function handleConfirm() {
    const amount = confirmingAmount ?? resolvedAmount;
    if (amount <= 0) return;
    setSaving(true);
    const result = await onConfirm(amount);
    setSaving(false);
    if (!result.error) {
      setConfirmingAmount(null);
      // Success ring pulse, then micro-bounce close
      setShowRing(true);
      await new Promise((r) => setTimeout(r, 480));
      await innerControls.start({
        y: 12,
        transition: MICRO_BOUNCE_TRANSITION,
      });
      handleClose();
    }
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bucket-sheet-backdrop"
            className="fixed inset-0 z-40 bg-ink/28"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={FADE_TRANSITION}
            onClick={handleClose}
          />

          {/* Sheet */}
          <motion.div
            key="bucket-sheet"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md touch-none"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SPRING.sheet}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.45 }}
            onDragStart={() => setPrimaryMotionState('dragging', true)}
            onDragEnd={(_, info) => {
              setPrimaryMotionState('dragging', false);
              if (info.offset.y > 90 || info.velocity.y > 550) handleClose();
            }}
          >
            {/* Inner wrapper — bounces on confirm */}
            <motion.div
              animate={innerControls}
              className={`rounded-t-3xl bg-bg shadow-neuRaised overflow-hidden${showRing ? ' animate-success-ring' : ''}`}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-pill bg-well" />
              </div>

              {/* Scrollable content */}
              <div className="touch-pan-y overflow-y-auto overscroll-contain max-h-[85dvh] px-5 pb-8 pt-2">
                <motion.div
                  variants={contentVariants}
                  initial="hidden"
                  animate={sheetContentReady ? 'visible' : 'hidden'}
                  className="flex flex-col gap-5"
                >
                  {/* Bucket header */}
                  <motion.div variants={itemVariants}>
                    <BucketHeader icon={icon} name={name} saved={saved} target={target} pendingDeposit={showDoneLock ? 0 : resolvedAmount} />
                  </motion.div>

                  {isPaused && (
                    <motion.div variants={itemVariants} className="rounded-xl border border-dashed border-accent-slate/35 bg-accent-slate/10 p-4">
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface text-accent-slate shadow-soft">
                          <IconPauseCircle size={18} />
                        </span>
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-bold text-ink">
                            {copy.bucketPause.bannerTitle}
                            {pausedSinceLabel ? <span className="font-normal text-ink-muted"> - {pausedSinceLabel}</span> : null}
                          </p>
                          <p className="mt-1 font-mono text-xs leading-5 text-ink-muted">
                            {copy.bucketPause.bannerBody}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {showDoneLock ? (
                    <>
                      <motion.div variants={itemVariants}>
                        <CompleteBucketLock
                          title={copy.addMoney.doneLock.title}
                          body={copy.addMoney.doneLock.body(name, nextBucketName)}
                          nextLine={nextBucketName ? copy.addMoney.doneLock.nextBucket(nextBucketName) : null}
                          backLabel={copy.common.back}
                          addAnywayLabel={copy.addMoney.doneLock.addAnyway}
                          onBack={handleClose}
                          onAddAnyway={() => {
                            setDoneLockOverridden(true);
                            onDoneLockOverride?.(bucketId);
                          }}
                          primaryAction={
                            extraAmount != null && extraAmount > 0 && onRequestTransferExtra
                              ? {
                                  label: `${copy.addMoney.doneLock.moveExtra} (${formatMoney(extraAmount)})`,
                                  onClick: () => {
                                    handleClose();
                                    onRequestTransferExtra(bucketId);
                                  },
                                }
                              : undefined
                          }
                        />
                      </motion.div>
                    </>
                  ) : (
                    <>
                      {/* Custom amount */}
                      <motion.div variants={itemVariants}>
                        <FormField label={copy.addMoney.customAmountLabel}>
                          <TextInput
                            value={customValue}
                            inputMode="numeric"
                            placeholder="1200"
                            leadingIcon={<IconPiggyBank size={16} />}
                            onChange={handleCustomChange}
                          />
                        </FormField>
                      </motion.div>

                      {trendPreview && trendPreviewMineSeries && sheetContentReady && (
                        <motion.div variants={itemVariants}>
                          <ComparisonTrendChart
                            mineLabel={trendPreview.mineLabel}
                            theirLabel={trendPreview.theirLabel}
                            mineSeries={trendPreviewMineSeries}
                            theirSeries={trendPreview.theirSeries}
                          />
                        </motion.div>
                      )}

                      {/* Actions */}
                      <motion.div variants={itemVariants} className={MODAL_ACTION_ROW_REVERSE_CLASS}>
                        <Button
                          variant="action"
                          size="md"
                          disabled={saving || resolvedAmount <= 0}
                          onClick={requestConfirm}
                        >
                          {saving ? copy.savingPlan.savingButton : copy.common.confirm}
                        </Button>
                        <Button variant="ghost" size="md" className={MODAL_SECONDARY_BUTTON_CLASS} onClick={handleClose}>
                          {copy.common.cancel}
                        </Button>
                      </motion.div>

                      {(canPausePlan || canResumePlan) && (
                        <motion.div variants={itemVariants} className="flex justify-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="px-3 text-accent-slate hover:bg-accent-slate/10 hover:text-accent-slate"
                            leadingIcon={canResumePlan ? <IconPlayCircle size={15} /> : <IconPauseCircle size={15} />}
                            onClick={() => {
                              handleClose();
                              if (canResumePlan) onRequestResumePlan?.(bucketId);
                              else onRequestPausePlan?.(bucketId);
                            }}
                          >
                            {canResumePlan ? copy.bucketPause.resumeAction : copy.bucketPause.pauseAction}
                          </Button>
                        </motion.div>
                      )}

                      {/* Delete */}
                      {onDelete && (
                        <motion.div variants={itemVariants} className="flex justify-center">
                          <button
                            type="button"
                            onClick={onDelete}
                            className="inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 font-mono text-xs font-bold text-danger hover:bg-danger-soft active:scale-[0.98] transition-all"
                          >
                            <IconTrash size={14} />
                            {copy.bucket.deleteConfirmLabel}
                          </button>
                        </motion.div>
                      )}
                    </>
                  )}
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
          <ConfirmModal
            open={confirmingAmount !== null}
            title={
              bucketAlreadyComplete
                ? copy.addMoney.completeBucketConfirmTitle(name)
                : copy.addMoney.confirmBannerTitle(formatMoney(confirmingAmount ?? resolvedAmount), name)
            }
            body={
              bucketAlreadyComplete
                ? copy.addMoney.completeBucketConfirmBody(name)
                : isPaused
                  ? copy.addMoney.pausedDepositSuccess
                  : copy.addMoney.confirmBannerBodyNoSlip
            }
            confirmLabel={
              saving
                ? copy.savingPlan.savingButton
                : bucketAlreadyComplete
                  ? copy.addMoney.completeBucketConfirmLabel
                  : copy.addMoney.confirmDepositButton
            }
            onCancel={() => {
              if (!saving) setConfirmingAmount(null);
            }}
            onConfirm={handleConfirm}
          />
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
