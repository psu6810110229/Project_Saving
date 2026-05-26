import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button/Button';
import { IconArrowLeft, IconCheck, IconVault } from '../components/Icon/Icon';
import { IconButton } from '../components/IconButton/IconButton';
import { OutcomeModal } from '../components/OutcomeModal/OutcomeModal';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { Spinner } from '../components/Spinner/Spinner';
import { TextInput } from '../components/TextInput/TextInput';
import { useLoadingGate } from '../hooks/useLoadingGate';
import { useSharedData } from '../hooks/useSharedData';
import { useI18n } from '../i18n/useI18n';
import { formatCurrency } from '../lib/format';
import { haptic } from '../lib/haptics';
import { formatDirectionalAdjustment, formatSignedCurrency, RECONCILE_REASONS } from '../lib/reconcile';
import type { BalanceAdjustmentReason } from '../types';

type Step = 'enter' | 'difference';

export function CheckBalance() {
  const navigate = useNavigate();
  const { appBalance, createCheckpoint, loading: reconcileLoading } = useSharedData().reconcile;
  const { copy } = useI18n();
  const r = copy.reconcile;

  const [step, setStep] = useState<Step>('enter');
  const [actualValue, setActualValue] = useState('');
  const [reason, setReason] = useState<BalanceAdjustmentReason | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<null | { matched: boolean; diff: number }>(null);
  const clientRequestIdRef = useRef<string | null>(null);

  // Verified Balance the user is checking against. Comes from the
  // hardened `current_reconciled_balance` RPC so it stays consistent
  // with what `create_balance_checkpoint` computes server-side, and
  // it is not capped by any client-side log list.
  const dataLoading = reconcileLoading || appBalance === null;
  const { shouldShowLoader: shouldShowSkeleton } = useLoadingGate({
    loading: dataLoading,
    showAfterMs: 120,
    minimumVisibleMs: 400,
  });
  if (reconcileLoading || appBalance === null) {
    if (shouldShowSkeleton) return <CheckBalanceSkeleton loadingLabel={r.loadingAriaLabel} />;
    return null;
  }
  const displayedAppBalance = appBalance;

  const actualNumber = Number(actualValue);
  const actualValid = actualValue.trim().length > 0 && Number.isFinite(actualNumber) && actualNumber >= 0;
  const difference = actualValid ? Math.round((actualNumber - displayedAppBalance) * 100) / 100 : 0;

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
  }

  return (
    <div className="flex flex-col gap-5 pt-8">
      {/* Back button stays at the top; the rest of the page is lowered. */}
      <div>
        <IconButton ariaLabel={r.goBackAriaLabel} size="md" onClick={() => navigate(-1)}>
          <IconArrowLeft size={20} />
        </IconButton>
      </div>

      {/* Lowered content. */}
      <div className="mt-10 flex flex-col gap-5">
        <header className="min-w-0">
          <p className="font-mono text-lg font-bold uppercase tracking-[0.18em] text-brand-800">
            {r.pageEyebrow}
          </p>
          <h1 className="mt-2 truncate font-mono text-3xl font-bold text-ink">{r.pageTitle}</h1>
        </header>

        <section className="rounded-xl bg-surface p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-lg font-bold uppercase tracking-[0.18em] text-brand-800">
              {r.verifiedBalanceLabel}
            </p>
            <span className="font-mono text-2xl font-bold text-ink">{formatCurrency(displayedAppBalance)}</span>
          </div>
        </section>

        {step === 'enter' && (
          <section className="rounded-xl bg-surface p-5 shadow-soft">
            <label className="block">
              <span className="block font-mono text-lg font-bold uppercase tracking-[0.18em] text-brand-800">
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
              <span className="mt-3 block font-mono text-sm text-ink-muted">
                {r.actualHelper}
              </span>
            </label>
            {error && <p className="mt-3 rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{error}</p>}
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="action" fullWidth onClick={handleConfirmMatch} disabled={submitting || !actualValid}>
                {submitting ? r.savingButton : r.saveCheckButton}
              </Button>
              <Button variant="ghost" fullWidth size="md" onClick={() => navigate(-1)}>
                {r.cancelButton}
              </Button>
            </div>
          </section>
        )}

        {step === 'difference' && (
          <section className="rounded-xl bg-surface p-5 shadow-soft">
            <SectionLabel tone="brand">{r.differenceLabel}</SectionLabel>
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-surfaceAlt p-3">
              <SummaryStat label={r.statActual} value={formatCurrency(actualNumber)} />
              <SummaryStat label={r.statVerified} value={formatCurrency(displayedAppBalance)} />
              <SummaryStat
                label={difference > 0 ? r.statAdjustedUp : r.statAdjustedDown}
                value={formatSignedCurrency(difference)}
                emphasized
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
      </div>

      <OutcomeModal
        open={Boolean(outcome)}
        outcome="success"
        icon={outcome?.matched ? <IconCheck size={28} /> : <IconVault size={28} />}
        title={outcome?.matched ? r.outcomeMatchedTitle : r.outcomeAdjustmentTitle}
        body={outcome?.matched
          ? r.outcomeMatchedBody
          : r.outcomeDifferenceBody(formatDirectionalAdjustment(outcome?.diff ?? 0, r.statAdjustedUp, r.statAdjustedDown))}
      >
        <Button variant="action" fullWidth onClick={() => navigate('/dashboard')}>{r.outcomeDone}</Button>
      </OutcomeModal>
    </div>
  );
}

function SummaryStat({ label, value, emphasized }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <SectionLabel tone="muted">{label}</SectionLabel>
      <span className={`font-mono font-bold ${emphasized ? 'text-brand-800 text-base' : 'text-ink text-sm'}`}>
        {value}
      </span>
    </div>
  );
}

function CheckBalanceSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="flex flex-col gap-5 pt-8" aria-label={loadingLabel}>
      {/* Back button placeholder */}
      <div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
      {/* Lowered header area */}
      <div className="mt-10 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-32 rounded-pill" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Spinner size="sm" tone="neutral" />
      </div>
      {/* Verified balance card */}
      <section className="rounded-xl bg-surface p-5 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-28 rounded-pill" />
          <Skeleton className="h-7 w-24" />
        </div>
      </section>
      {/* Input card */}
      <section className="rounded-xl bg-surface p-5 shadow-soft">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-36 rounded-pill" />
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-3 w-full rounded-pill" />
          <Skeleton className="mt-1 h-12 rounded-pill" />
        </div>
      </section>
    </div>
  );
}
