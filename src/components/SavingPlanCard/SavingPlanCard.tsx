import { Chip } from '../Chip/Chip';
import { IconBubble } from '../IconBubble/IconBubble';
import { IconTrendingUp } from '../Icon/Icon';
import { formatCurrency } from '../../lib/format';
import {
  HABIT_STATE_LABEL,
  MONEY_STATE_LABEL,
  shortDateLabel,
  type HabitState,
  type HabitStatus,
  type MoneyStatus,
} from '../../lib/savingPlan';
import type { SavingPlanRuleType } from '../../types';

interface SavingPlanCardProps {
  /** Active rule type; `null` when the user has no plan yet. */
  ruleType: SavingPlanRuleType | null;
  /** When `null`, render the "set up plan" empty state. */
  money: MoneyStatus | null;
  habit: HabitStatus;
  onConfigure: () => void;
}

const HABIT_TONE: Record<HabitState, 'leaf' | 'peach' | 'white' | 'danger'> = {
  active: 'leaf',
  at_risk: 'peach',
  stale: 'danger',
  no_deposits_yet: 'white',
};

/**
 * Hero insight card with two clearly separate zones — Money status
 * (plan vs Recorded Deposits) and Habit status (deposit cadence).
 * The two are never collapsed into one score.
 *
 * Money progress uses Recorded Deposits, not Verified Balance.
 */
export function SavingPlanCard({ ruleType, money, habit, onConfigure }: SavingPlanCardProps) {
  if (!money || !ruleType) {
    return (
      <section className="rounded-3xl bg-brand-50 p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <IconBubble tone="peach" size="md">
            <IconTrendingUp size={20} />
          </IconBubble>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-brand-800">
              Saving Plan
            </p>
            <p className="mt-1 truncate font-mono text-sm font-bold text-ink">No plan yet</p>
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

  const moneyTone = money.state === 'ahead'
    ? 'leaf'
    : money.state === 'behind'
      ? 'danger'
      : 'peach';

  const moneyHeadline = money.state === 'ahead'
    ? `Ahead by ${formatCurrency(Math.round(money.delta))}`
    : money.state === 'behind'
      ? `Behind by ${formatCurrency(Math.round(-money.delta))}`
      : MONEY_STATE_LABEL[money.state];

  const habitHeadline = habit.lastDepositDateKey === null
    ? 'No deposits yet'
    : habit.hasDepositedToday
      ? 'Today'
      : habit.daysSinceLastDeposit === 1
        ? '1d ago'
        : `${habit.daysSinceLastDeposit}d ago`;

  return (
    <section className="rounded-3xl bg-brand-50 p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-brand-800">
          Saving Plan
        </p>
        <Chip tone={moneyTone}>{MONEY_STATE_LABEL[money.state]}</Chip>
      </div>

      <p className={
        'mt-2 font-mono text-xl font-bold ' +
        (money.state === 'ahead'
          ? 'text-accent-leaf'
          : money.state === 'behind'
            ? 'text-danger'
            : 'text-ink')
      }>
        {moneyHeadline}
      </p>
      {money.state === 'ahead' && money.coveredUntilDate && (
        <p className="mt-1 font-mono text-xs text-ink-muted">
          Covered until {shortDateLabel(money.coveredUntilDate)}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-surface p-3 shadow-soft">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            Money
          </p>
          <div className="mt-2 flex flex-col gap-1 font-mono text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-ink-muted">Expected today</span>
              <span className="text-ink">{formatCurrency(Math.round(money.expectedToday))}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-ink-muted">Recorded</span>
              <span className="text-ink">{formatCurrency(Math.round(money.recordedDeposits))}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-surface p-3 shadow-soft">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            Habit
          </p>
          <div className="mt-2 flex flex-col gap-2 font-mono text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-ink-muted">Last deposit</span>
              <span className="text-ink">{habitHeadline}</span>
            </div>
            <Chip tone={HABIT_TONE[habit.state]} className="self-start">
              {HABIT_STATE_LABEL[habit.state]}
            </Chip>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] text-ink-muted">Based on recorded deposits.</p>
        <button
          type="button"
          onClick={onConfigure}
          className="shrink-0 rounded-pill bg-brand-500 px-4 py-2 font-mono text-xs font-bold text-ink-inverse shadow-haloOrange active:scale-[0.98] transition-transform"
        >
          Change plan
        </button>
      </div>
    </section>
  );
}
