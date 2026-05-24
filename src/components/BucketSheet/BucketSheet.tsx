import { type ChangeEvent, type ReactNode, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useAnimation } from 'framer-motion';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { BucketHeader } from '../BucketHeader/BucketHeader';
import { Button } from '../Button/Button';
import { ComparisonTrendChart } from '../ComparisonTrendChart/ComparisonTrendChart';
import { ConfirmModal } from '../ConfirmModal/ConfirmModal';
import { FormField } from '../FormField/FormField';
import { IconCheck, IconPiggyBank, IconTrash } from '../Icon/Icon';
import { ProjectedProgressCard } from '../ProjectedProgressCard/ProjectedProgressCard';
import { QuickAddRow } from '../QuickAddRow/QuickAddRow';
import { TextInput } from '../TextInput/TextInput';
import { useI18n } from '../../i18n/useI18n';
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
  quickAmounts,
  onConfirm,
  onDelete,
  isComplete,
  extraAmount,
  nextBucketName,
  onRequestTransferExtra,
  onDoneLockOverride,
  trendPreview,
}: BucketSheetProps) {
  const { copy, formatMoney } = useI18n();
  const defaultPill = quickAmounts[1] ?? quickAmounts[0] ?? 100;
  const [selectedPill, setSelectedPill] = useState<number | null>(defaultPill);
  const [customValue, setCustomValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmingAmount, setConfirmingAmount] = useState<number | null>(null);
  const [showRing, setShowRing] = useState(false);
  const [doneLockOverridden, setDoneLockOverridden] = useState(false);
  const innerControls = useAnimation();
  const bucketAlreadyComplete = target > 0 && saved >= target;
  const showDoneLock = isComplete && !doneLockOverridden;

  useBodyScrollLock(open);

  const customAmount = Number(customValue);
  const resolvedAmount =
    customValue.trim() !== '' && customAmount > 0 ? customAmount : (selectedPill ?? 0);

  function handlePillSelect(amount: number) {
    setSelectedPill(amount);
    if (customValue.trim() !== '') setCustomValue('');
  }

  function handleCustomChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setCustomValue(next);
    if (next.trim() !== '' && selectedPill !== null) setSelectedPill(null);
  }

  function handleClose() {
    onClose();
    setTimeout(() => {
      setCustomValue('');
      setSelectedPill(defaultPill);
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
            className="fixed inset-0 z-40 bg-ink/25 backdrop-blur-[3px]"
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
            onDragEnd={(_, info) => {
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
                  animate="visible"
                  className="flex flex-col gap-5"
                >
                  {/* Bucket header */}
                  <motion.div variants={itemVariants}>
                    <BucketHeader icon={icon} name={name} saved={saved} target={target} />
                  </motion.div>

                  {showDoneLock ? (
                    <>
                      <motion.div variants={itemVariants} className="flex flex-col items-center gap-2 py-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                          <IconCheck size={20} className="text-green-700" />
                        </div>
                        <p className="text-center font-mono text-sm font-bold text-ink">
                          {copy.addMoney.doneLock.title}
                        </p>
                        <p className="text-center font-mono text-xs text-ink-muted">
                          {copy.addMoney.doneLock.body(name)}
                        </p>
                        {nextBucketName && (
                          <p className="text-center font-mono text-xs text-accent-700">
                            {copy.addMoney.doneLock.nextBucket(nextBucketName)}
                          </p>
                        )}
                      </motion.div>

                      <motion.div variants={itemVariants} className="grid gap-2">
                        {extraAmount != null && extraAmount > 0 && onRequestTransferExtra && (
                          <Button
                            variant="action"
                            size="md"
                            onClick={() => {
                              handleClose();
                              onRequestTransferExtra(bucketId);
                            }}
                          >
                            {copy.addMoney.doneLock.moveExtra} ({formatMoney(extraAmount)})
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="md"
                          onClick={() => {
                            setDoneLockOverridden(true);
                            onDoneLockOverride?.(bucketId);
                          }}
                        >
                          {copy.addMoney.doneLock.addAnyway}
                        </Button>
                      </motion.div>
                    </>
                  ) : (
                    <>
                      {/* Quick add */}
                      <motion.div variants={itemVariants}>
                        <QuickAddRow
                          label={copy.addMoney.depositAmountLabel}
                          amounts={quickAmounts}
                          selected={selectedPill}
                          onSelect={handlePillSelect}
                        />
                      </motion.div>

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

                      {/* Projected progress */}
                      <motion.div variants={itemVariants}>
                        <ProjectedProgressCard
                          bucketName={name}
                          saved={saved}
                          target={target}
                          pendingDeposit={resolvedAmount}
                        />
                      </motion.div>

                      {trendPreview && (
                        <motion.div variants={itemVariants}>
                          <ComparisonTrendChart
                            mineLabel={trendPreview.mineLabel}
                            theirLabel={trendPreview.theirLabel}
                            mineSeries={trendPreview.mineSeries(resolvedAmount)}
                            theirSeries={trendPreview.theirSeries}
                          />
                        </motion.div>
                      )}

                      {/* Actions */}
                      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-2">
                        <Button variant="ghost" size="md" onClick={handleClose}>
                          {copy.common.cancel}
                        </Button>
                        <Button
                          variant="action"
                          size="md"
                          disabled={saving || resolvedAmount <= 0}
                          onClick={requestConfirm}
                        >
                          {saving ? copy.savingPlan.savingButton : copy.common.confirm}
                        </Button>
                      </motion.div>

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
