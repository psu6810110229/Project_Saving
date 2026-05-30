import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Bucket, BucketCreateRuleData, BucketTransfer, DailySummaryItem, SavingsLog } from '../../types';
import type { MigrationState } from '../../hooks/useMigrationState';
import { Modal } from '../Modal/Modal';
import { Button, MODAL_ACTION_ROW_CLASS, MODAL_SECONDARY_BUTTON_CLASS } from '../Button/Button';
import { IconArrowRight, IconCalendar, IconCheckCircle } from '../Icon/Icon';
import { MigrationBucketStep } from './MigrationBucketStep';
import { MigrationSummary } from './MigrationSummary';
import { useI18n } from '../../i18n/useI18n';

interface MigrationWizardProps {
  open: boolean;
  state: MigrationState;
  buckets: Bucket[];
  logs: SavingsLog[];
  transfers?: BucketTransfer[];
  roomEndDate: string | null;
  summaryItems: DailySummaryItem[];
  streak: number;
  streakUnit?: string;
  onStart: () => void;
  onBack: () => void;
  onLater: () => void;
  onBucketSubmit: (bucket: Bucket, ruleData: BucketCreateRuleData) => Promise<{ error?: string }>;
  onComplete: () => Promise<{ error?: string }>;
}

export function MigrationWizard({
  open,
  state,
  buckets,
  logs,
  transfers,
  roomEndDate,
  summaryItems,
  streak,
  streakUnit,
  onStart,
  onBack,
  onLater,
  onBucketSubmit,
  onComplete,
}: MigrationWizardProps) {
  const { copy } = useI18n();
  const m = copy.migrationWizard;
  const [completeError, setCompleteError] = useState<string | null>(null);
  const totalBuckets = buckets.length;
  const showIntro = state.step <= 0 && totalBuckets > 0;
  const showSummary = totalBuckets === 0 || state.step > totalBuckets;
  const currentIndex = Math.max(0, Math.min(state.step - 1, totalBuckets - 1));
  const currentBucket = !showIntro && !showSummary ? buckets[currentIndex] ?? null : null;

  async function handleComplete() {
    setCompleteError(null);
    const result = await onComplete();
    if (result.error) setCompleteError(result.error);
  }

  return (
    <Modal open={open} title={m.modalTitle} onClose={onLater}>
      <AnimatePresence mode="wait" initial={false}>
        {showIntro && (
          <motion.div
            key="migration-intro"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22 }}
            className="flex flex-col gap-4"
          >
            <div className="rounded-xl bg-surface p-5 shadow-soft">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <IconCalendar size={24} />
              </span>
              <h3 className="font-mono text-2xl font-bold leading-tight text-ink">
                {m.introTitle}
              </h3>
              <p className="mt-2 font-mono text-sm leading-relaxed text-ink-muted">
                {m.introBody}
              </p>
            </div>
            <div className="rounded-xl bg-well p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-green-700">
                  <IconCheckCircle size={20} />
                </span>
                <p className="font-mono text-xs leading-relaxed text-ink-muted">
                  {m.introPreserveNote}
                </p>
              </div>
            </div>
            <div className={MODAL_ACTION_ROW_CLASS}>
              <Button variant="action" size="md" trailingIcon={<IconArrowRight size={16} />} onClick={onStart}>
                {m.startButton}
              </Button>
              <Button variant="ghost" size="md" className={MODAL_SECONDARY_BUTTON_CLASS} onClick={onLater}>{m.laterButton}</Button>
            </div>
          </motion.div>
        )}

        {!showIntro && currentBucket && (
          <motion.div
            key={currentBucket.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22 }}
          >
            <MigrationBucketStep
              bucket={currentBucket}
              bucketNumber={currentIndex + 1}
              totalBuckets={totalBuckets}
              roomEndDate={roomEndDate}
              logs={logs}
              transfers={transfers}
              onBack={onBack}
              onSubmit={onBucketSubmit}
            />
          </motion.div>
        )}

        {showSummary && (
          <motion.div
            key="migration-summary"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22 }}
            className="flex flex-col gap-3"
          >
            {completeError && (
              <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{completeError}</p>
            )}
            <MigrationSummary
              items={summaryItems}
              streak={streak}
              streakUnit={streakUnit}
              onComplete={handleComplete}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
