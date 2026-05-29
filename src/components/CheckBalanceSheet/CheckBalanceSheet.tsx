import { useRef, useState } from 'react';
import { Button } from '../Button/Button';
import { IconBubble } from '../IconBubble/IconBubble';
import { IconCheck, IconVault } from '../Icon/Icon';
import { Modal } from '../Modal/Modal';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { Spinner } from '../Spinner/Spinner';
import { TextInput } from '../TextInput/TextInput';
import { useSharedData } from '../../hooks/useSharedData';
import { useI18n } from '../../i18n/useI18n';
import { formatCurrency } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { formatDirectionalAdjustment, formatSignedCurrency, RECONCILE_REASONS } from '../../lib/reconcile';
import type { BalanceAdjustmentReason } from '../../types';

interface CheckBalanceSheetProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'enter' | 'difference' | 'done';

/**
 * Check Balance flow as an in-place popup (replaces the old dedicated
 * `/check-balance` page). Self-contained: reads the Verified Balance and
 * writes checkpoints through the shared reconcile data layer, which
 * refetches on success so the Dashboard row updates automatically.
 */
export function CheckBalanceSheet({ open, onClose }: CheckBalanceSheetProps) {
  const { appBalance, createCheckpoint } = useSharedData().reconcile;
  const { copy } = useI18n();
  const r = copy.reconcile;

  const [step, setStep] = useState<Step>('enter');
  const [actualValue, setActualValue] = useState('');
  const [reason, setReason] = useState<BalanceAdjustmentReason | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<null | { matched: boolean; diff: number }>(null);
  const clientRequestIdRef = useRef<string | null>(null);

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
    }, 350);
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
                <p className="font-mono text-sm font-bold uppercase tracking-wider text-brand-800">
                  {r.verifiedBalanceLabel}
                </p>
                <span className="font-mono text-xl font-bold text-ink">{formatCurrency(displayedAppBalance)}</span>
              </div>
            </section>
          )}

          {step === 'enter' && (
            <section className="rounded-xl bg-surface p-4 shadow-soft">
              <label className="block">
                <span className="block font-mono text-sm font-bold uppercase tracking-wider text-brand-800">
                  {r.actualBalanceLabel}
                </span>
                <div className="mt-3">
                  <TextInput
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="0"
                    value={actualValue}
                    leadingIcon={<span className="font-mono font-bold">฿</span>}
                    onChange={event => {
                      setActualValue(event.target.value.replace(/[^0-9]/g, ''));
                      setError(null);
                    }}
                  />
                </div>
                <span className="mt-3 block font-mono text-sm text-ink-muted">{r.actualHelper}</span>
              </label>
              {error && <p className="mt-3 rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{error}</p>}
              <div className="mt-4 flex flex-col gap-2">
                <Button variant="action" fullWidth onClick={handleConfirmMatch} disabled={submitting || !actualValid}>
                  {submitting ? r.savingButton : r.saveCheckButton}
                </Button>
                <Button variant="ghost" fullWidth size="md" onClick={handleClose}>
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
                      'w-full rounded-lg px-4 py-3 text-left font-mono text-sm font-bold transition-colors ' +
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
              <div className="mt-4 flex flex-col gap-2">
                <Button variant="action" fullWidth onClick={handleConfirmDifference} disabled={submitting || !reason}>
                  {submitting ? r.savingButton : r.saveAdjustmentButton}
                </Button>
                <Button variant="ghost" fullWidth size="md" onClick={() => setStep('enter')}>
                  {r.backButton}
                </Button>
              </div>
            </section>
          )}

          {step === 'done' && outcome && (
            <section className="flex flex-col items-center gap-4 rounded-xl bg-surface p-5 text-center shadow-soft">
              <IconBubble tone={outcome.matched ? 'solid' : 'peach'} size="md">
                {outcome.matched ? <IconCheck size={22} /> : <IconVault size={22} />}
              </IconBubble>
              <div className="flex flex-col gap-1">
                <p className="font-mono text-lg font-bold text-ink">
                  {outcome.matched ? r.outcomeMatchedTitle : r.outcomeAdjustmentTitle}
                </p>
                <p className="font-mono text-sm leading-6 text-ink-muted">
                  {outcome.matched
                    ? r.outcomeMatchedBody
                    : r.outcomeDifferenceBody(formatDirectionalAdjustment(outcome.diff, r.statAdjustedUp, r.statAdjustedDown))}
                </p>
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
      <span className={`max-w-full truncate font-mono font-bold leading-none tabular-nums ${valueColor} ${emphasized ? 'text-base' : 'text-sm'}`}>
        {value}
      </span>
    </div>
  );
}
