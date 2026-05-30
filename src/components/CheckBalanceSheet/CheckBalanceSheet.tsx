import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useRef, useState } from 'react';
import { Button, MODAL_ACTION_ROW_REVERSE_CLASS, MODAL_SECONDARY_BUTTON_CLASS } from '../Button/Button';
import { IconBubble } from '../IconBubble/IconBubble';
import { IconCheck, IconChevronDown, IconVault } from '../Icon/Icon';
import { Modal } from '../Modal/Modal';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { Spinner } from '../Spinner/Spinner';
import { TextInput } from '../TextInput/TextInput';
import { useSharedData } from '../../hooks/useSharedData';
import { useI18n } from '../../i18n/useI18n';
import { formatCurrency } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { bucketSaved } from '../../lib/buckets';
import {
  formatDirectionalAdjustment,
  formatSignedCurrency,
  RECONCILE_REASONS,
  shortfallSpillPlan,
  smartShortfallBucketId,
  type ShortfallBucket,
} from '../../lib/reconcile';
import type { BalanceAdjustmentReason } from '../../types';

interface CheckBalanceSheetProps {
  open: boolean;
  onClose: () => void;
  /**
   * `'sync'` opens straight on the shortfall write-down panel (the card
   * nudge entry), using the already-stored overAllocated — no new
   * checkpoint needed. Defaults to the full Check Balance flow.
   */
  initialMode?: 'check' | 'sync';
}

type Step = 'enter' | 'difference' | 'done';

/**
 * Check Balance flow as an in-place popup (replaces the old dedicated
 * `/check-balance` page). Self-contained: reads the Verified Balance and
 * writes checkpoints through the shared reconcile data layer, which
 * refetches on success so the Dashboard row updates automatically.
 */
export function CheckBalanceSheet({ open, onClose, initialMode = 'check' }: CheckBalanceSheetProps) {
  const data = useSharedData();
  const { appBalance, createCheckpoint, overAllocated, deallocate } = data.reconcile;
  const { buckets } = data.buckets;
  const { logs } = data.logs;
  const { transfers: bucketTransfers } = data.bucketTransfers;
  const { allocations: balanceAllocations, refetch: refetchAllocations } = data.balanceAllocations;
  const { copy } = useI18n();
  const r = copy.reconcile;
  const sync = r.allocate.sync;

  const [step, setStep] = useState<Step>('enter');
  const [actualValue, setActualValue] = useState('');
  const [reason, setReason] = useState<BalanceAdjustmentReason | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<null | { matched: boolean; diff: number }>(null);
  const clientRequestIdRef = useRef<string | null>(null);

  // Shortfall write-down (plan 56 slice 4b): when the verified balance ends
  // up below what the buckets claim, the done panel becomes a sync panel.
  const [syncBucketId, setSyncBucketId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncDone, setSyncDone] = useState(false);
  const [syncSpillCount, setSyncSpillCount] = useState(0);

  // Own active buckets that currently hold money, as write-down candidates.
  const shortfallBuckets = useMemo<ShortfallBucket[]>(() => buckets
    .filter(b => b.archived_at == null)
    .map(b => ({
      id: b.id,
      category: b.category,
      deadline: b.deadline,
      balance: bucketSaved(b.id, logs, bucketTransfers, balanceAllocations),
    }))
    .filter(b => b.balance > 0.005),
    [buckets, logs, bucketTransfers, balanceAllocations]);

  const smartDefaultBucketId = useMemo(
    () => smartShortfallBucketId(shortfallBuckets),
    [shortfallBuckets],
  );
  const focusDefaultBucketId = useMemo(() => {
    for (const bucket of buckets) {
      const shortfallBucket = shortfallBuckets.find(b => b.id === bucket.id);
      if (!shortfallBucket) continue;
      if (bucket.target_amount > 0 && shortfallBucket.balance >= bucket.target_amount) continue;
      return bucket.id;
    }
    return null;
  }, [buckets, shortfallBuckets]);
  const effectiveSyncBucketId = syncBucketId ?? focusDefaultBucketId ?? smartDefaultBucketId;

  // Card-nudge entry: on the closed→open transition in sync mode, jump
  // straight to the shortfall panel using the stored overAllocated (no new
  // checkpoint). Adjusting state during render on a prop change is the
  // recommended React pattern — no effect, no cascading render.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open && initialMode === 'sync') {
      setStep('done');
      setOutcome({ matched: false, diff: 0 });
    }
  }

  const displayedAppBalance = appBalance ?? 0;
  const actualNumber = Number(actualValue);
  const actualValid = actualValue.trim().length > 0 && Number.isFinite(actualNumber) && actualNumber >= 0;
  const difference = actualValid ? Math.round((actualNumber - displayedAppBalance) * 100) / 100 : 0;

  function handleClose() {
    onClose();
    // Reset after the close animation so content doesn't flash mid-transition.
    setTimeout(() => {
      setStep('enter');
      setActualValue('');
      setReason(null);
      setError(null);
      setOutcome(null);
      setSubmitting(false);
      clientRequestIdRef.current = null;
      setSyncBucketId(null);
      setSyncing(false);
      setSyncError(null);
      setSyncDone(false);
      setSyncSpillCount(0);
    }, 350);
  }

  /**
   * Trim the buckets back down to the verified balance via signed
   * write-downs (auto-spill across buckets, starting from the chosen one).
   * Each call uses a fresh request id; the server recomputes the remaining
   * shortfall under lock, so a retry after a partial failure can never
   * over-trim. `savings_logs` / streak are untouched.
   */
  async function handleSync() {
    if (syncing) return;
    const plan = shortfallSpillPlan(shortfallBuckets, overAllocated, effectiveSyncBucketId);
    if (plan.length === 0) return;
    setSyncing(true);
    setSyncError(null);
    for (const trim of plan) {
      const result = await deallocate({
        bucketId: trim.bucketId,
        amount: trim.amount,
        clientRequestId: crypto.randomUUID(),
      });
      if (result.error) {
        setSyncing(false);
        setSyncError(syncErrorCopy(result.errorHint));
        await refetchAllocations();
        return;
      }
    }
    // Re-pull the ledger so bucket balances / progress reflect the trim
    // immediately (the balance card already updated via useReconcile).
    await refetchAllocations();
    setSyncSpillCount(plan.length);
    setSyncing(false);
    setSyncDone(true);
    haptic('success');
  }

  function syncErrorCopy(hint: string | undefined): string {
    switch (hint) {
      case 'deallocation_exceeds_shortfall': return sync.errorExceedsShortfall;
      case 'deallocation_insufficient_bucket': return sync.errorInsufficientBucket;
      default: return sync.errorGeneric;
    }
  }

  async function handleConfirmMatch() {
    if (!actualValid) {
      setError(r.errorEnterActual);
      return;
    }
    if (difference !== 0) {
      setStep('difference');
      return;
    }
    await submit(undefined);
  }

  async function handleConfirmDifference() {
    if (!reason) {
      setError(r.errorPickReason);
      return;
    }
    await submit(reason);
  }

  async function submit(selectedReason: BalanceAdjustmentReason | undefined) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    if (!clientRequestIdRef.current) {
      clientRequestIdRef.current = crypto.randomUUID();
    }
    const result = await createCheckpoint({
      actualAmount: actualNumber,
      reason: selectedReason,
      clientRequestId: clientRequestIdRef.current,
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const matched = (result.differenceAmount ?? difference) === 0;
    haptic(matched ? 'success' : 'milestone');
    setOutcome({ matched, diff: result.differenceAmount ?? difference });
    setStep('done');
  }

  const loading = appBalance === null;

  return (
    <Modal open={open} title={r.pageTitle} onClose={handleClose}>
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner size="sm" tone="neutral" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {step !== 'done' && (
            <section className="rounded-xl bg-surface p-4 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-sm font-semibold uppercase tracking-wider text-brand-800">
                  {r.verifiedBalanceLabel}
                </p>
                <span className="font-mono text-xl font-semibold text-ink">{formatCurrency(displayedAppBalance)}</span>
              </div>
            </section>
          )}

          {step === 'enter' && (
            <section className="rounded-xl bg-surface p-4 shadow-soft">
              <label className="block">
                <span className="block font-mono text-sm font-semibold uppercase tracking-wider text-brand-800">
                  {r.actualBalanceLabel}
                </span>
                <div className="mt-3">
                  <TextInput
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="0"
                    value={actualValue}
                    leadingIcon={<span className="font-mono font-semibold">฿</span>}
                    onChange={event => {
                      setActualValue(event.target.value.replace(/[^0-9]/g, ''));
                      setError(null);
                    }}
                  />
                </div>
                <span className="mt-3 block font-mono text-sm text-ink-muted">{r.actualHelper}</span>
              </label>
              {error && <p className="mt-3 rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{error}</p>}
              <div className={`mt-4 ${MODAL_ACTION_ROW_REVERSE_CLASS}`}>
                <Button variant="action" fullWidth size="md" onClick={handleConfirmMatch} disabled={submitting || !actualValid}>
                  {submitting ? r.savingButton : r.saveCheckButton}
                </Button>
                <Button variant="ghost" fullWidth size="md" className={MODAL_SECONDARY_BUTTON_CLASS} onClick={handleClose}>
                  {r.cancelButton}
                </Button>
              </div>
            </section>
          )}

          {step === 'difference' && (
            <section className="rounded-xl bg-surface p-4 shadow-soft">
              <SectionLabel tone="brand">{r.differenceLabel}</SectionLabel>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 rounded-lg bg-surfaceAlt px-3 py-3">
                <SummaryStat label={r.statActual} value={formatCurrency(actualNumber)} />
                <SummaryStat label={r.inlineStatApp} value={formatCurrency(displayedAppBalance)} />
                <SummaryStat
                  label={difference > 0 ? r.statAdjustedUp : r.statAdjustedDown}
                  value={formatSignedCurrency(difference)}
                  emphasized
                  positive={difference > 0}
                />
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {RECONCILE_REASONS.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setReason(option.id);
                      setError(null);
                    }}
                    className={
                      'w-full rounded-lg px-4 py-3 text-left font-mono text-sm font-semibold transition-colors ' +
                      (reason === option.id
                        ? 'bg-brand-800 text-ink-inverse'
                        : 'bg-surfaceAlt text-ink hover:bg-brand-50')
                    }
                  >
                    {r.reasons[option.id].label}
                  </button>
                ))}
              </div>
              {error && <p className="mt-3 rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{error}</p>}
              <div className={`mt-4 ${MODAL_ACTION_ROW_REVERSE_CLASS}`}>
                <Button variant="action" fullWidth size="md" onClick={handleConfirmDifference} disabled={submitting || !reason}>
                  {submitting ? r.savingButton : r.saveAdjustmentButton}
                </Button>
                <Button variant="ghost" fullWidth size="md" className={MODAL_SECONDARY_BUTTON_CLASS} onClick={() => setStep('enter')}>
                  {r.backButton}
                </Button>
              </div>
            </section>
          )}

          {step === 'done' && outcome && !syncDone && (overAllocated > 0.005 || syncing) && (
            // ── Shortfall sync panel: buckets claim more than the verified
            //    balance. Calm, guided, one tap (smart-default bucket). ──
            <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-soft">
              <div className="flex flex-col items-center gap-3 text-center">
                <IconBubble tone="peach" size="md"><IconVault size={22} /></IconBubble>
                <div className="flex flex-col gap-1">
                  <p className="font-mono-th text-lg font-semibold text-ink">{sync.title}</p>
                  <p className="font-mono-th text-sm leading-6 text-ink-muted">
                    {sync.body(formatCurrency(overAllocated))}
                  </p>
                </div>
              </div>

              {shortfallBuckets.length > 1 && (
                <label className="block">
                  <span className="mb-2 block font-mono-th text-sm font-semibold text-ink">
                    {sync.bucketLabel}
                  </span>
                  <SyncBucketPicker
                    value={effectiveSyncBucketId ?? ''}
                    onChange={value => { setSyncBucketId(value); setSyncError(null); }}
                    disabled={syncing}
                    options={shortfallBuckets.map(b => {
                      const bucket = buckets.find(x => x.id === b.id);
                      return {
                        id: b.id,
                        label: bucket?.name ?? '',
                        detail: formatCurrency(b.balance),
                      };
                    })}
                  />
                </label>
              )}

              {syncError && <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono-th text-xs text-danger">{syncError}</p>}

              <div className={MODAL_ACTION_ROW_REVERSE_CLASS}>
                <Button variant="action" fullWidth size="md" onClick={handleSync} disabled={syncing}>
                  {syncing ? sync.confirmingButton : sync.confirmButton}
                </Button>
                <Button
                  variant="ghost"
                  fullWidth
                  size="md"
                  className={MODAL_SECONDARY_BUTTON_CLASS}
                  onClick={handleClose}
                  disabled={syncing}
                >
                  {sync.skipButton}
                </Button>
              </div>
            </section>
          )}

          {step === 'done' && outcome && (syncDone || (overAllocated <= 0.005 && !syncing)) && (
            <section className="flex flex-col items-center gap-4 rounded-xl bg-surface p-5 text-center shadow-soft">
              <IconBubble tone={outcome.matched || syncDone ? 'solid' : 'peach'} size="md">
                {outcome.matched || syncDone ? <IconCheck size={22} /> : <IconVault size={22} />}
              </IconBubble>
              <div className="flex flex-col gap-1">
                <p className="font-mono-th text-lg font-semibold text-ink">
                  {syncDone ? sync.successTitle : outcome.matched ? r.outcomeMatchedTitle : r.outcomeAdjustmentTitle}
                </p>
                <p className="font-mono-th text-sm leading-6 text-ink-muted">
                  {syncDone
                    ? sync.successBody
                    : outcome.matched
                      ? r.outcomeMatchedBody
                      : r.outcomeDifferenceBody(formatDirectionalAdjustment(outcome.diff, r.statAdjustedUp, r.statAdjustedDown))}
                </p>
                {syncDone && syncSpillCount > 1 && (
                  <p className="font-mono-th text-xs text-ink-dim">{sync.spillNote(syncSpillCount)}</p>
                )}
              </div>
              <Button variant="action" fullWidth onClick={handleClose}>
                {r.outcomeDone}
              </Button>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}

function SummaryStat({ label, value, emphasized, positive }: { label: string; value: string; emphasized?: boolean; positive?: boolean }) {
  const valueColor = emphasized
    ? positive
      ? 'text-accent-leaf'
      : 'text-brand-800'
    : 'text-ink';

  return (
    <div className={`flex min-w-0 flex-col gap-1 ${emphasized ? 'items-end text-right' : 'items-start text-left'}`}>
      <span className="block max-w-full break-words font-mono-th text-[10px] font-semibold leading-4 text-ink-muted">
        {label}
      </span>
      <span className={`max-w-full truncate font-mono font-semibold leading-none tabular-nums ${valueColor} ${emphasized ? 'text-base' : 'text-sm'}`}>
        {value}
      </span>
    </div>
  );
}

function SyncBucketPicker({
  value,
  onChange,
  disabled,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options: Array<{ id: string; label: string; detail: string }>;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.id === value) ?? options[0] ?? null;

  function choose(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(prev => !prev)}
        className="flex w-full items-center justify-between gap-3 rounded-xl bg-surfaceAlt px-3 py-2.5 text-left font-mono-th text-sm font-semibold text-ink shadow-soft ring-1 ring-transparent transition-all hover:bg-brand-50 hover:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0">
          <span className="block truncate">{selected?.label ?? ''}</span>
          <span className="mt-0.5 block font-mono text-xs font-semibold text-ink-muted">{selected?.detail ?? ''}</span>
        </span>
        <motion.span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-bg text-brand-800 shadow-soft"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18 }}
        >
          <IconChevronDown size={16} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && !disabled && (
          <motion.div
            role="listbox"
            className="mt-2 max-h-56 overflow-y-auto rounded-xl bg-bg p-1 shadow-neuRaised ring-1 ring-brand-100"
            initial={{ opacity: 0, y: -6, scale: 0.98, height: 0 }}
            animate={{ opacity: 1, y: 0, scale: 1, height: 'auto' }}
            exit={{ opacity: 0, y: -4, scale: 0.98, height: 0 }}
            transition={{ duration: 0.18 }}
          >
            {options.map(option => {
              const selectedOption = option.id === value;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={selectedOption}
                  onClick={() => choose(option.id)}
                  className={
                    'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors '
                    + (selectedOption ? 'bg-brand-800 text-ink-inverse' : 'text-ink hover:bg-brand-50')
                  }
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono-th text-sm font-semibold">{option.label}</span>
                    <span className={`mt-0.5 block font-mono text-xs font-semibold ${selectedOption ? 'text-ink-inverse/75' : 'text-ink-muted'}`}>
                      {option.detail}
                    </span>
                  </span>
                  {selectedOption && <IconCheck size={16} />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
