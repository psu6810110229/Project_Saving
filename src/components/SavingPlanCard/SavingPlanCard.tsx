import { useRef, useState } from 'react';
import { IconBubble } from '../IconBubble/IconBubble';
import { IconChevronDown, IconEdit, IconTrendingUp, IconVault } from '../Icon/Icon';
import { TextInput } from '../TextInput/TextInput';
import { Button } from '../Button/Button';
import { formatCurrency } from '../../lib/format';
import { formatSignedCurrency, RECONCILE_REASONS } from '../../lib/reconcile';
import {
  MONEY_STATE_LABEL,
  shortDateLabel,
  type HabitStatus,
  type MoneyStatus,
} from '../../lib/savingPlan';
import type { BalanceAdjustmentReason, SavingPlanRuleType } from '../../types';

interface VerifiedBalanceSlot {
  amount: number;
  sinceLabel: string;
  matched: boolean;
  diff: number;
  onSubmit: (actualAmount: number, reason?: BalanceAdjustmentReason) => Promise<{ error?: string; differenceAmount?: number }>;
}

interface SavingPlanCardProps {
  ruleType: SavingPlanRuleType | null;
  money: MoneyStatus | null;
  habit: HabitStatus;
  onConfigure: () => void;
  verifiedBalance?: VerifiedBalanceSlot | null;
  isPaused?: boolean;
  pausedSince?: string | null;
  planSummary?: string | null;
}

function fireForStreak(streak: number): string {
  if (streak >= 8) return '🔥🔥🔥';
  if (streak >= 6) return '🔥🔥';
  if (streak >= 2) return '🔥';
  return '';
}

export function SavingPlanCard({
  ruleType,
  money,
  habit,
  onConfigure,
  verifiedBalance,
  isPaused = false,
  pausedSince = null,
  planSummary = null,
}: SavingPlanCardProps) {
  const [vbExpanded, setVbExpanded] = useState(false);
  const [vbActualValue, setVbActualValue] = useState('');
  const [vbStep, setVbStep] = useState<'enter' | 'reason'>('enter');
  const [vbReason, setVbReason] = useState<BalanceAdjustmentReason | null>(null);
  const [vbSubmitting, setVbSubmitting] = useState(false);
  const [vbError, setVbError] = useState<string | null>(null);
  const [vbDone, setVbDone] = useState<{ matched: boolean } | null>(null);
  const clientIdRef = useRef<string | null>(null);

  function handleVbToggle() {
    if (vbExpanded) {
      setVbActualValue('');
      setVbStep('enter');
      setVbReason(null);
      setVbError(null);
      setVbDone(null);
      clientIdRef.current = null;
    } else {
      clientIdRef.current = crypto.randomUUID();
    }
    setVbExpanded(prev => !prev);
  }

  async function handleVbSubmit() {
    if (!verifiedBalance || vbSubmitting) return;
    const actual = Number(vbActualValue);
    if (!Number.isFinite(actual) || actual < 0 || vbActualValue.trim() === '') {
      setVbError('Enter your actual balance.');
      return;
    }
    const diff = Math.round((actual - verifiedBalance.amount) * 100) / 100;
    if (diff !== 0 && vbStep === 'enter') {
      setVbStep('reason');
      return;
    }
    if (diff !== 0 && !vbReason) {
      setVbError('Pick a reason for the difference.');
      return;
    }
    setVbSubmitting(true);
    setVbError(null);
    const result = await verifiedBalance.onSubmit(actual, vbReason ?? undefined);
    setVbSubmitting(false);
    if (result.error) {
      setVbError(result.error);
      return;
    }
    const matched = (result.differenceAmount ?? diff) === 0;
    setVbDone({ matched });
    setTimeout(() => {
      setVbExpanded(false);
      setVbActualValue('');
      setVbStep('enter');
      setVbReason(null);
      setVbDone(null);
    }, 1800);
  }

  if (!money || !ruleType) {
    return (
      <section className="rounded-xl bg-surface p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <IconBubble tone="peach" size="md">
            <IconTrendingUp size={20} />
          </IconBubble>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-ink-muted">
              Saving Plan
            </p>
            <p className="mt-1 truncate font-mono text-base font-bold text-ink">No plan yet</p>
          </div>
          <button
            type="button"
            onClick={onConfigure}
            className="shrink-0 rounded-pill bg-brand-500 px-4 py-2 font-mono text-xs font-bold text-ink-inverse shadow-haloOrange active:scale-[0.98] transition-transform"
          >
            Set up plan
          </button>
        </div>
      </section>
    );
  }

  const moneyHeadlineColor = isPaused
    ? 'text-ink-muted'
    : money.state === 'ahead'
      ? 'text-brand-800'
      : money.state === 'behind'
        ? 'text-danger'
        : 'text-ink';

  const moneyHeadline = isPaused
    ? 'Plan paused'
    : money.state === 'ahead'
      ? `Ahead by ${formatCurrency(Math.round(money.delta))}`
      : money.state === 'behind'
        ? `Behind by ${formatCurrency(Math.round(-money.delta))}`
        : MONEY_STATE_LABEL[money.state];

  const habitHeadline = habit.lastDepositDateKey === null
    ? 'No deposits yet'
    : habit.hasDepositedToday
      ? 'Today'
      : habit.daysSinceLastDeposit === 1
        ? '1 day ago'
        : `${habit.daysSinceLastDeposit} days ago`;

  const streakFire = fireForStreak(habit.streak);

  const vbActualNumber = Number(vbActualValue);
  const vbDiff = vbActualValue.trim() !== '' && Number.isFinite(vbActualNumber)
    ? Math.round((vbActualNumber - (verifiedBalance?.amount ?? 0)) * 100) / 100
    : null;

  return (
    <section className="rounded-xl bg-surface p-5 shadow-soft">
      <p className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-ink-muted">
        Saving Plan
      </p>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className={`font-mono text-2xl font-bold ${moneyHeadlineColor}`}>
          {moneyHeadline}
        </p>
        <button
          type="button"
          onClick={onConfigure}
          aria-label="Change plan"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-500 text-ink-inverse shadow-haloOrange active:scale-[0.96] transition-transform"
        >
          <IconEdit size={18} />
        </button>
      </div>
      {isPaused ? (
        <div className="mt-1">
          {pausedSince && (
            <p className="font-mono text-base font-bold text-ink-muted">
              Since <span className="text-ink">{shortDateLabel(pausedSince)}</span>
              {planSummary && (
                <span className="ml-2 font-normal text-ink-muted">· {planSummary}</span>
              )}
            </p>
          )}
        </div>
      ) : (
        money.state === 'ahead' && money.coveredUntilDate && (
          <p className="mt-1 font-mono text-base font-bold text-ink-muted">
            Covered until <span className="text-ink">{shortDateLabel(money.coveredUntilDate)}</span>
          </p>
        )
      )}

      <div className="mt-5 grid grid-cols-2 divide-x divide-well">
        <div className="pr-4">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-ink-muted">
            Money
          </p>
          <div className="mt-3">
            <p className="font-mono text-sm text-ink-muted">Today's plan</p>
            <p className="mt-0.5 font-mono text-base font-bold text-ink">
              {formatCurrency(Math.round(money.expectedToday))}
            </p>
          </div>
        </div>

        <div className="pl-4">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-ink-muted">
            Habit
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <p className="font-mono text-sm text-ink-muted">Last deposit</p>
              <p className="mt-0.5 font-mono text-base font-bold text-ink">
                {habitHeadline}
              </p>
            </div>
            {habit.streak > 0 && (
              <div>
                <p className="font-mono text-sm text-ink-muted">Streak</p>
                <p className="mt-0.5 font-mono text-base font-bold text-ink">
                  {habit.streak} day{habit.streak === 1 ? '' : 's'}
                  {streakFire && (
                    <span aria-hidden className="ml-1.5 align-middle">{streakFire}</span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Verified Balance — expandable inline form */}
      {verifiedBalance && (
        <div className="mt-4 border-t border-well pt-4">
          <button
            type="button"
            onClick={handleVbToggle}
            className="flex w-full items-center gap-3 text-left"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-800">
              <IconVault size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-ink-muted">
                Verified balance
              </p>
              <p className="mt-0.5 truncate font-mono text-sm font-bold text-ink">
                {formatCurrency(verifiedBalance.amount)}
                <span className="ml-2 font-normal text-ink-muted">
                  · {verifiedBalance.sinceLabel === 'never'
                    ? 'not checked'
                    : verifiedBalance.matched
                      ? `matched ${verifiedBalance.sinceLabel}`
                      : `${formatSignedCurrency(verifiedBalance.diff)} ${verifiedBalance.sinceLabel}`}
                </span>
              </p>
            </div>
            <IconChevronDown
              size={18}
              className={`shrink-0 text-ink-muted transition-transform duration-300 ${vbExpanded ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Slide-down panel */}
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-out"
            style={{ gridTemplateRows: vbExpanded ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-3 pt-4">
                {vbDone ? (
                  <p className={`font-mono text-sm font-bold ${vbDone.matched ? 'text-accent-leaf' : 'text-brand-800'}`}>
                    {vbDone.matched ? '✓ Balance matched' : '✓ Adjustment saved'}
                  </p>
                ) : vbStep === 'enter' ? (
                  <>
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-brand-50 px-3 py-2">
                      <span className="font-mono text-xs text-ink-muted">App balance</span>
                      <span className="font-mono text-sm font-bold text-ink">{formatCurrency(verifiedBalance.amount)}</span>
                    </div>
                    <TextInput
                      inputMode="numeric"
                      placeholder="0"
                      value={vbActualValue}
                      leadingIcon={<span className="font-mono font-bold text-brand-500">฿</span>}
                      onChange={e => {
                        setVbActualValue(e.target.value.replace(/[^0-9]/g, ''));
                        setVbError(null);
                      }}
                    />
                    {vbDiff !== null && vbDiff !== 0 && (
                      <p className="font-mono text-xs text-ink-muted">
                        Difference: <span className={`font-bold ${vbDiff > 0 ? 'text-accent-leaf' : 'text-danger'}`}>{formatSignedCurrency(vbDiff)}</span>
                      </p>
                    )}
                    {vbError && <p className="font-mono text-xs text-danger">{vbError}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="ghost" size="md" onClick={handleVbToggle}>Cancel</Button>
                      <Button
                        variant="action"
                        size="md"
                        disabled={vbSubmitting || vbActualValue.trim() === ''}
                        onClick={handleVbSubmit}
                      >
                        {vbSubmitting ? 'Saving…' : 'Save Check'}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-brand-50 px-3 py-2 text-center">
                      <div>
                        <p className="font-mono text-[10px] text-ink-muted uppercase tracking-wider">Actual</p>
                        <p className="font-mono text-sm font-bold text-ink">{formatCurrency(Number(vbActualValue))}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] text-ink-muted uppercase tracking-wider">App</p>
                        <p className="font-mono text-sm font-bold text-ink">{formatCurrency(verifiedBalance.amount)}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] text-ink-muted uppercase tracking-wider">Diff</p>
                        <p className={`font-mono text-sm font-bold ${(vbDiff ?? 0) > 0 ? 'text-accent-leaf' : 'text-danger'}`}>
                          {formatSignedCurrency(vbDiff ?? 0)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {RECONCILE_REASONS.map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => { setVbReason(opt.id); setVbError(null); }}
                          className={`w-full rounded-lg px-3 py-2 text-left font-mono text-xs font-bold transition-colors ${vbReason === opt.id ? 'bg-brand-800 text-ink-inverse' : 'bg-brand-50 text-ink hover:bg-brand-100'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {vbError && <p className="font-mono text-xs text-danger">{vbError}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="ghost" size="md" onClick={() => { setVbStep('enter'); setVbReason(null); setVbError(null); }}>Back</Button>
                      <Button
                        variant="action"
                        size="md"
                        disabled={vbSubmitting || !vbReason}
                        onClick={handleVbSubmit}
                      >
                        {vbSubmitting ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
