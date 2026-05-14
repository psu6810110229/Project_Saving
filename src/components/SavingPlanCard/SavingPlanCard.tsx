import { IconBubble } from '../IconBubble/IconBubble';
import { IconEdit, IconTrendingUp, IconVault } from '../Icon/Icon';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { formatCurrency } from '../../lib/format';
import { formatSignedCurrency } from '../../lib/reconcile';
import {
  MONEY_STATE_LABEL,
  shortDateLabel,
  type HabitStatus,
  type MoneyStatus,
} from '../../lib/savingPlan';
import type { SavingPlanRuleType } from '../../types';

interface VerifiedBalanceSlot {
  amount: number;
  /** "today" / "1d ago" / "3d ago" / "never". */
  sinceLabel: string;
  /** Whether the latest checkpoint difference was zero. */
  matched: boolean;
  /** Signed difference from the latest checkpoint (0 when matched). */
  diff: number;
  onCheck: () => void;
}

interface SavingPlanCardProps {
  /** Active rule type; `null` when the user has no plan yet. */
  ruleType: SavingPlanRuleType | null;
  /** When `null`, render the "set up plan" empty state. */
  money: MoneyStatus | null;
  habit: HabitStatus;
  onConfigure: () => void;
  /** Today's deposits by the current user (sum of `savings_logs` whose Bangkok day = today). */
  savedToday?: number;
  /** Optional Verified Balance subsection merged into the same island. */
  verifiedBalance?: VerifiedBalanceSlot | null;
}

/**
 * Primary Dashboard insight island. Two clearly separate zones —
 * Money status (plan vs deposits) and Habit status (cadence) — and
 * an optional Verified Balance row at the bottom that lives inside
 * the same island so it reads as part of one financial picture
 * instead of a competing card.
 *
 * Money progress is computed from deposit logs, not Verified Balance.
 */
export function SavingPlanCard({
  ruleType,
  money,
  habit,
  onConfigure,
  savedToday = 0,
  verifiedBalance,
}: SavingPlanCardProps) {
  if (!money || !ruleType) {
    return (
      <section className="rounded-3xl bg-brand-50 p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <IconBubble tone="peach" size="md">
            <IconTrendingUp size={20} />
          </IconBubble>
          <div className="min-w-0 flex-1">
            <SectionLabel tone="muted">Saving Plan</SectionLabel>
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

  // Burnt-orange / neutral palette — green is reserved for partner
  // identity in charts, not used for status here.
  const moneyHeadlineColor =
    money.state === 'ahead'
      ? 'text-brand-800'
      : money.state === 'behind'
        ? 'text-danger'
        : 'text-ink';

  const moneyHeadline =
    money.state === 'ahead'
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

  return (
    <section className="rounded-3xl bg-brand-50 p-5 shadow-soft">
      {/* Header: neutral eyebrow + icon-only Change plan in top-right */}
      <div className="flex items-start justify-between gap-3">
        <SectionLabel tone="muted">Saving Plan</SectionLabel>
        <button
          type="button"
          onClick={onConfigure}
          aria-label="Change plan"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500 text-ink-inverse shadow-haloOrange active:scale-[0.96] transition-transform"
        >
          <IconEdit size={16} />
        </button>
      </div>

      <p className={`mt-3 font-mono text-2xl font-bold ${moneyHeadlineColor}`}>
        {moneyHeadline}
      </p>
      {money.state === 'ahead' && money.coveredUntilDate && (
        <p className="mt-1 font-mono text-base font-bold text-ink-muted">
          Covered until <span className="text-ink">{shortDateLabel(money.coveredUntilDate)}</span>
        </p>
      )}

      {/* Money + Habit insight boxes — larger, fewer labels. */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-surface p-4 shadow-soft">
          <SectionLabel tone="muted">Money</SectionLabel>
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <p className="font-mono text-[11px] text-ink-muted">Today's plan</p>
              <p className="mt-0.5 font-mono text-base font-bold text-ink">
                {formatCurrency(Math.round(money.expectedToday))}
              </p>
            </div>
            <div>
              <p className="font-mono text-[11px] text-ink-muted">Saved today</p>
              <p className="mt-0.5 font-mono text-base font-bold text-ink">
                {formatCurrency(Math.round(savedToday))}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-surface p-4 shadow-soft">
          <SectionLabel tone="muted">Habit</SectionLabel>
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <p className="font-mono text-[11px] text-ink-muted">Last deposit</p>
              <p className="mt-0.5 font-mono text-base font-bold text-ink">
                {habitHeadline}
              </p>
            </div>
            {habit.streak > 0 && (
              <div>
                <p className="font-mono text-[11px] text-ink-muted">Streak</p>
                <p className="mt-0.5 font-mono text-base font-bold text-ink">
                  {habit.streak} day{habit.streak === 1 ? '' : 's'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Verified Balance — secondary, lives inside the same island. */}
      {verifiedBalance && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-surface/80 px-3 py-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-800">
            <IconVault size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink-muted">
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
          <button
            type="button"
            onClick={verifiedBalance.onCheck}
            className="shrink-0 rounded-pill bg-surfaceAlt px-3 py-1.5 font-mono text-xs font-bold text-brand-800 active:scale-[0.98] transition-transform"
          >
            Check
          </button>
        </div>
      )}
    </section>
  );
}
