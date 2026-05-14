import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button/Button';
import { FormField } from '../components/FormField/FormField';
import { IconCheck, IconVault } from '../components/Icon/Icon';
import { OutcomeModal } from '../components/OutcomeModal/OutcomeModal';
import { PageHeader } from '../components/PageHeader/PageHeader';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { TextInput } from '../components/TextInput/TextInput';
import { useReconcile } from '../hooks/useReconcile';
import { useRoom } from '../hooks/useRoom';
import { formatCurrency } from '../lib/format';
import { haptic } from '../lib/haptics';
import { formatSignedCurrency, RECONCILE_REASONS } from '../lib/reconcile';
import type { BalanceAdjustmentReason } from '../types';

type Step = 'enter' | 'difference';

export function CheckBalance() {
  const navigate = useNavigate();
  const { activeRoomId } = useRoom();
  const { appBalance, createCheckpoint, loading: reconcileLoading } = useReconcile(activeRoomId);

  const [step, setStep] = useState<Step>('enter');
  const [actualValue, setActualValue] = useState('');
  const [reason, setReason] = useState<BalanceAdjustmentReason | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<null | { matched: boolean; diff: number }>(null);
  const clientRequestIdRef = useRef<string | null>(null);

  // App balance the user is verifying against. Comes from the
  // hardened `current_reconciled_balance` RPC so it stays consistent
  // with what `create_balance_checkpoint` computes server-side, and
  // it is not capped by any client-side log list.
  if (reconcileLoading || appBalance === null) return <CheckBalanceSkeleton />;
  const displayedAppBalance = appBalance;

  const actualNumber = Number(actualValue);
  const actualValid = actualValue.trim().length > 0 && Number.isFinite(actualNumber) && actualNumber >= 0;
  const difference = actualValid ? Math.round((actualNumber - displayedAppBalance) * 100) / 100 : 0;

  async function handleConfirmMatch() {
    if (!actualValid) {
      setError('Enter your actual balance to continue.');
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
      setError('Pick the reason for the difference.');
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
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Reconcile"
        title="Check Balance"
        subtitle="Confirm your real savings match the app."
        showBack
      />

      <section className="rounded-3xl bg-surface p-5 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel tone="brand">App Balance</SectionLabel>
          <span className="font-mono text-2xl font-bold text-ink">{formatCurrency(displayedAppBalance)}</span>
        </div>
        <p className="mt-2 font-mono text-xs text-ink-muted">
          What the app currently records for you in this project.
        </p>
      </section>

      {step === 'enter' && (
        <section className="rounded-3xl bg-surface p-5 shadow-soft">
          <FormField label="Actual Balance" helper="How much real money do you have set aside for this project right now?">
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
          </FormField>
          {error && <p className="mt-3 rounded-2xl bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{error}</p>}
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="action" fullWidth onClick={handleConfirmMatch} disabled={submitting || !actualValid}>
              {submitting ? 'Saving…' : 'Save Check'}
            </Button>
            <Button variant="ghost" fullWidth size="md" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </section>
      )}

      {step === 'difference' && (
        <section className="rounded-3xl bg-surface p-5 shadow-soft">
          <SectionLabel tone="brand">Difference</SectionLabel>
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-surfaceAlt p-3">
            <SummaryStat label="Actual" value={formatCurrency(actualNumber)} />
            <SummaryStat label="App" value={formatCurrency(displayedAppBalance)} />
            <SummaryStat label="Difference" value={formatSignedCurrency(difference)} emphasized />
          </div>
          <p className="mt-4 font-mono text-sm font-bold text-ink">
            What caused this difference?
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {RECONCILE_REASONS.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setReason(option.id);
                  setError(null);
                }}
                className={
                  'w-full rounded-2xl px-4 py-3 text-left font-mono text-sm transition-colors ' +
                  (reason === option.id
                    ? 'bg-brand-800 text-ink-inverse'
                    : 'bg-surfaceAlt text-ink hover:bg-brand-50')
                }
              >
                <span className="block font-bold">{option.label}</span>
                {option.description && (
                  <span className={
                    'mt-1 block text-xs ' +
                    (reason === option.id ? 'text-ink-inverse/80' : 'text-ink-muted')
                  }>
                    {option.description}
                  </span>
                )}
              </button>
            ))}
          </div>
          {error && <p className="mt-3 rounded-2xl bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{error}</p>}
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="action" fullWidth onClick={handleConfirmDifference} disabled={submitting || !reason}>
              {submitting ? 'Saving…' : 'Save Check & Adjustment'}
            </Button>
            <Button variant="ghost" fullWidth size="md" onClick={() => setStep('enter')}>
              Back
            </Button>
          </div>
        </section>
      )}

      <OutcomeModal
        open={Boolean(outcome)}
        outcome="success"
        icon={outcome?.matched ? <IconCheck size={28} /> : <IconVault size={28} />}
        title={outcome?.matched ? 'Balance checked' : 'Adjustment saved'}
        body={outcome?.matched
          ? 'Your actual balance matches the app.'
          : `Recorded difference ${formatSignedCurrency(outcome?.diff ?? 0)}.`}
      >
        <Button variant="action" fullWidth onClick={() => navigate('/dashboard')}>Done</Button>
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

function CheckBalanceSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-label="Loading check balance">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24" />
      <Skeleton className="h-40" />
    </div>
  );
}
