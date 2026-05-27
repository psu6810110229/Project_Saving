import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Bucket, BucketCreateRuleData, BucketTransfer, DailySummaryItem, SavingsLog } from '../../types';
import type { MigrationState } from '../../hooks/useMigrationState';
import { Modal } from '../Modal/Modal';
import { Button } from '../Button/Button';
import { IconArrowRight, IconCalendar, IconCheckCircle } from '../Icon/Icon';
import { MigrationBucketStep } from './MigrationBucketStep';
import { MigrationSummary } from './MigrationSummary';

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
  onLater,
  onBucketSubmit,
  onComplete,
}: MigrationWizardProps) {
  const [completeError, setCompleteError] = useState<string | null>(null);
  const pendingBuckets = buckets.filter(bucket =>
    !bucket.deadline && !state.completedBucketIds.includes(bucket.id)
  );
  const totalBuckets = buckets.length;
  const currentBucket = pendingBuckets[0] ?? null;
  const showIntro = state.step === 0 && state.completedBucketIds.length === 0 && pendingBuckets.length > 0;
  const showSummary = !showIntro && !currentBucket;

  async function handleComplete() {
    setCompleteError(null);
    const result = await onComplete();
    if (result.error) setCompleteError(result.error);
  }

  return (
    <Modal open={open} title="Goal setup" onClose={onLater}>
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
                Each goal now gets its own deadline
              </h3>
              <p className="mt-2 font-mono text-sm leading-relaxed text-ink-muted">
                We will pre-fill smart dates and saving rules for your existing buckets. Most people can just tap Next.
              </p>
            </div>
            <div className="rounded-xl bg-well p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-green-700">
                  <IconCheckCircle size={20} />
                </span>
                <p className="font-mono text-xs leading-relaxed text-ink-muted">
                  Your current savings and streak stay intact. The old Saving Plan is archived after setup.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" size="md" onClick={onLater}>Later</Button>
              <Button variant="action" size="md" trailingIcon={<IconArrowRight size={16} />} onClick={onStart}>
                Let's go
              </Button>
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
              bucketNumber={state.completedBucketIds.length + 1}
              totalBuckets={totalBuckets}
              roomEndDate={roomEndDate}
              logs={logs}
              transfers={transfers}
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
