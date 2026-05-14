import { IconBubble } from '../IconBubble/IconBubble';
import { IconTrendingUp } from '../Icon/Icon';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { formatCurrency } from '../../lib/format';
import {
  HABIT_STATE_LABEL,
  MONEY_STATE_LABEL,
  RULE_TYPE_LABEL,
  shortDateLabel,
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

/**
 * Compact Dashboard card with two clearly separate zones:
 * Money status (plan vs Recorded Deposits) and Habit status
 * (deposit cadence). The two are never collapsed into one score.
 *
 * Money progress uses Recorded Deposits, not Verified Balance.
 */
export function SavingPlanCard({ ruleType, money, habit, onConfigure }: SavingPlanCardProps) {
  if (!money || !ruleType) {
    return (
      <section className="rounded-3xl bg-surface p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <IconBubble tone="peach" size="md">
            <IconTrendingUp size={20} />
          </IconBubble>
          <div className="min-w-0 flex-1">
            <SectionLabel tone="brand">Saving Plan</SectionLabel>
            <p className="mt-1 truncate font-mono text-sm font-bold text-ink">No plan yet</p>
            <p className="mt-0.5 truncate font-mono text-xs text-ink-muted">
              Pick a cadence to see Ahead / Behind and habit insight.
            </p>
          </div>
          <button
            type="button"
            onClick={onConfigure}
            className="shrink-0 rounded-pill bg-brand-800 px-4 py-2 font-mono text-xs font-bold text-ink-inverse shadow-soft active:scale-[0.98] transition-transform"
          >
            Set up plan
          </button>
        </div>
      </section>
    );
  }

  const moneyTone = money.state === 'ahead'
    ? 'text-accent-leaf'
    : money.state === 'behind'
      ? 'text-danger'
      : 'text-ink';

  const moneyHeadline = money.state === 'ahead'
    ? `Ahead by ${formatCurrency(Math.round(money.delta))}`
    : money.state === 'behind'
      ? `Behind by ${formatCurrency(Math.round(-money.delta))}`
      : MONEY_STATE_LABEL[money.state];

  const habitHeadline = habit.lastDepositDateKey === null
    ? HABIT_STATE_LABEL[habit.state]
    : habit.hasDepositedToday
      ? 'Deposited today'
      : habit.daysSinceLastDeposit === 1
        ? 'No deposit for 1 day'
        : `No deposit for ${habit.daysSinceLastDeposit} days`;

  return (
    <section className="rounded-3xl bg-surface p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <IconBubble tone="peach" size="md">
          <IconTrendingUp size={20} />
        </IconBubble>
        <div className="min-w-0 flex-1">
          <SectionLabel tone="brand">Saving Plan</SectionLabel>
          <p className="mt-1 truncate font-mono text-sm font-bold text-ink">
            {RULE_TYPE_LABEL[ruleType]}
          </p>
        </div>
        <button
          type="button"
          onClick={onConfigure}
          className="shrink-0 rounded-pill bg-surfaceAlt px-3 py-2 font-mono text-xs font-bold text-ink active:scale-[0.98] transition-transform"
        >
          Change plan
        </button>
      </div>

      <div className="mt-3 rounded-2xl bg-surfaceAlt p-3">
        <SectionLabel tone="muted">Money status</SectionLabel>
        <p className={`mt-1 font-mono text-sm font-bold ${moneyTone}`}>{moneyHeadline}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px] text-ink-muted">
          <div>Expected Today<br />
            <span className="text-ink">{formatCurrency(Math.round(money.expectedToday))}</span>
          </div>
          <div>Expected so far<br />
            <span className="text-ink">{formatCurrency(Math.round(money.expectedCumulative))}</span>
          </div>
          <div>Recorded Deposits<br />
            <span className="text-ink">{formatCurrency(Math.round(money.recordedDeposits))}</span>
          </div>
          <div>Remaining<br />
            <span className="text-ink">{formatCurrency(Math.round(money.remaining))}</span>
          </div>
        </div>
        {money.state === 'ahead' && money.coveredUntilDate && (
          <p className="mt-2 font-mono text-[11px] text-ink-muted">
            Covered until {shortDateLabel(money.coveredUntilDate)} ({money.coveredDays} saving day{money.coveredDays === 1 ? '' : 's'}).
          </p>
        )}
      </div>

      <div className="mt-2 rounded-2xl bg-surfaceAlt p-3">
        <SectionLabel tone="muted">Habit status</SectionLabel>
        <p className="mt-1 font-mono text-sm font-bold text-ink">{habitHeadline}</p>
        <p className="mt-1 font-mono text-[11px] text-ink-muted">
          {HABIT_STATE_LABEL[habit.state]}
          {habit.streak > 0 ? ` · ${habit.streak}-day streak` : ''}
        </p>
      </div>

      <p className="mt-2 font-mono text-[11px] text-ink-muted">
        Based on Recorded Deposits. Verified Balance stays separate.
      </p>
    </section>
  );
}
