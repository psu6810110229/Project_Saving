import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '../Button/Button';
import { IconCheck } from '../Icon/Icon';
import { HeroCard } from '../HeroCard/HeroCard';
import { FADE_TRANSITION, SPRING } from '../../lib/motion';
import { useI18n } from '../../i18n/useI18n';
import type { DailySummaryItem, ProjectCategory } from '../../types';

interface VaultUpdatePreviewModalProps {
  open: boolean;
  prevSaved: number;
  newSaved: number;
  target: number;
  depositAmount: number;
  bucketName: string;
  reachedBucket: boolean;
  displayName: string;
  roomName?: string | null;
  roomCategory?: ProjectCategory | null;
  coverImageUrl?: string | null;
  validThru?: string | null;
  dailySummaryItem?: DailySummaryItem | null;
  hasBuckets: boolean;
  bucketCount?: number;
  streak: number;
  streakUnit?: 'day' | 'week' | 'month';
  streakTrackable?: boolean;
  lastCheckedAt?: string | null;
  onDone: () => void;
}

export function VaultUpdatePreviewModal({
  open,
  prevSaved,
  newSaved,
  target,
  depositAmount,
  bucketName,
  reachedBucket,
  displayName,
  roomName,
  roomCategory,
  coverImageUrl,
  validThru,
  dailySummaryItem,
  hasBuckets,
  bucketCount,
  streak,
  streakUnit,
  streakTrackable,
  lastCheckedAt,
  onDone,
}: VaultUpdatePreviewModalProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="vault-update-preview"
          className="fixed inset-0 z-50 min-h-[100dvh] bg-bg/95 px-4 py-8 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={FADE_TRANSITION}
          role="dialog"
          aria-modal="true"
        >
          <motion.section
            className="flex w-full max-w-sm flex-col gap-4"
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 14 }}
            transition={SPRING.outcome}
          >
            <PreviewBody
              prevSaved={prevSaved}
              newSaved={newSaved}
              target={target}
              depositAmount={depositAmount}
              bucketName={bucketName}
              reachedBucket={reachedBucket}
              displayName={displayName}
              roomName={roomName}
              roomCategory={roomCategory}
              coverImageUrl={coverImageUrl}
              validThru={validThru}
              dailySummaryItem={dailySummaryItem}
              hasBuckets={hasBuckets}
              bucketCount={bucketCount}
              streak={streak}
              streakUnit={streakUnit}
              streakTrackable={streakTrackable}
              lastCheckedAt={lastCheckedAt}
              onDone={onDone}
            />
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

interface PreviewBodyProps {
  prevSaved: number;
  newSaved: number;
  target: number;
  depositAmount: number;
  bucketName: string;
  reachedBucket: boolean;
  displayName: string;
  roomName?: string | null;
  roomCategory?: ProjectCategory | null;
  coverImageUrl?: string | null;
  validThru?: string | null;
  dailySummaryItem?: DailySummaryItem | null;
  hasBuckets: boolean;
  bucketCount?: number;
  streak: number;
  streakUnit?: 'day' | 'week' | 'month';
  streakTrackable?: boolean;
  lastCheckedAt?: string | null;
  onDone: () => void;
}

const DISMISS_DELAY_MS = 3000;
const TWEEN_START_DELAY_MS = 900;

function PreviewBody({
  prevSaved,
  newSaved,
  target,
  depositAmount,
  bucketName,
  reachedBucket,
  displayName,
  roomName,
  roomCategory,
  coverImageUrl,
  validThru,
  dailySummaryItem,
  hasBuckets,
  bucketCount,
  streak,
  streakUnit,
  streakTrackable,
  lastCheckedAt,
  onDone,
}: PreviewBodyProps) {
  const { copy, formatMoney } = useI18n();
  const [displaySaved, setDisplaySaved] = useState(prevSaved);
  const [canDismiss, setCanDismiss] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(DISMISS_DELAY_MS / 1000));

  useEffect(() => {
    const reducedMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = reducedMotion ? 0 : TWEEN_START_DELAY_MS;
    const id = window.setTimeout(() => setDisplaySaved(newSaved), delay);
    return () => window.clearTimeout(id);
  }, [newSaved]);

  useEffect(() => {
    const enable = window.setTimeout(() => setCanDismiss(true), DISMISS_DELAY_MS);
    const tick = window.setInterval(() => {
      setSecondsLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => {
      window.clearTimeout(enable);
      window.clearInterval(tick);
    };
  }, []);

  const doneLabel = canDismiss
    ? copy.addMoney.outcomeDone
    : `${copy.addMoney.outcomeDone} (${secondsLeft})`;

  return (
    <>
      <p className="text-center font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted">
        {reachedBucket ? copy.addMoney.bucketReachedTitle : copy.addMoney.outcomeTitle}
      </p>
      <HeroCard
        displayName={displayName}
        saved={displaySaved}
        target={target}
        roomName={roomName}
        roomCategory={roomCategory}
        coverImageUrl={coverImageUrl}
        validThru={validThru}
        dailySummaryItem={dailySummaryItem}
        hasBuckets={hasBuckets}
        bucketCount={bucketCount}
        streak={streak}
        streakUnit={streakUnit}
        streakTrackable={streakTrackable}
        lastCheckedAt={lastCheckedAt}
      />
      <div className="flex items-center justify-center gap-2 rounded-xl bg-surface px-4 py-3 shadow-soft">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-teal/15 text-accent-teal">
          <IconCheck size={14} />
        </span>
        <p className="font-mono text-sm font-bold tabular-nums text-ink">
          {bucketName} · +{formatMoney(depositAmount)}
        </p>
      </div>
      <Button
        variant="action"
        fullWidth
        disabled={!canDismiss}
        onClick={onDone}
        aria-live="polite"
      >
        {doneLabel}
      </Button>
    </>
  );
}
