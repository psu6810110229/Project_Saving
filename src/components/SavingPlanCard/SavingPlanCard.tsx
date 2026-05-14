import { IconBubble } from '../IconBubble/IconBubble';
import { IconArrowRight, IconEdit, IconTrendingUp, IconVault } from '../Icon/Icon';
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
  ruleType: SavingPlanRuleType | null;
  money: MoneyStatus | null;
  habit: HabitStatus;
  onConfigure: () => void;
  /** Today's deposits by the current user (sum of `savings_logs` whose Bangkok day = today). */
  savedToday?: number;
  verifiedBalance?: VerifiedBalanceSlot | null;
}

/** Fire glyphs for a streak: ≥2d → 1, ≥6d → 2, ≥8d → 3. */
function fireForStreak(streak: number): string {
  if (streak >= 8) return '🔥🔥🔥';
  if (streak >= 6) return '🔥🔥';
  if (streak >= 2) return '🔥';
  return '';
}

interface StatusText {
  text: string;
  /** Tailwind text-color class including opacity, e.g. `text-accent-gold/70`. */
  color: string;
}

function todayPlanStatus(planAmount: number, savedToday: number): StatusText | null {
  if (!Number.isFinite(planAmount) || planAmount <= 0) return null;
  if (savedToday >= planAmount) {
    return { text: 'Done', color: 'text-accent-leaf/80' };
  }
  if (savedToday > 0) {
    const remaining = planAmount - savedToday;
    return { text: `ขาดอีก ${formatCurrency(Math.round(remaining))}`, color: 'text-accent-gold/80' };
  }
  return { text: `ขาดอีก ${formatCurrency(Math.round(planAmount))}`, color: 'text-danger/70' };
}

function lastDepositStatus(habit: HabitStatus): StatusText | null {
  if (habit.lastDepositDateKey === null) {
    return { text: 'Start', color: 'text-accent-gold/80' };
  }
  if (habit.hasDepositedToday) {
    return { text: 'On track', color: 'text-accent-leaf/80' };
  }
  if (habit.daysSinceLastDeposit === 1) {
    return { text: 'Catch up', color: 'text-accent-gold/80' };
  }
  return { text: 'Behind', color: 'text-danger/70' };
}

/**
 * Primary Dashboard insight island. Two clearly separate zones —
 * Money status (plan vs deposits) and Habit status (cadence) — and
 * an optional Verified Balance row at the bottom that lives inside
 * the same island so it reads as part of one financial picture
 * instead of a competing card.
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

  const planAmountRounded = Math.round(money.expectedToday);
  const savedTodayRounded = Math.round(savedToday);
  const planStatus = todayPlanStatus(planAmountRounded, savedTodayRounded);
  const depositStatus = lastDepositStatus(habit);
  const streakFire = fireForStreak(habit.streak);

  return (
    <section className="rounded-3xl bg-brand-50 p-5 shadow-soft">
      {/* Eyebrow (now bigger, neutral muted color). */}
      <p className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-ink-muted">
        Saving Plan
      </p>

      {/* Headline + edit button on the same row. */}
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
      {money.state === 'ahead' && money.coveredUntilDate && (
        <p className="mt-1 font-mono text-base font-bold text-ink-muted">
          Covered until <span className="text-ink">{shortDateLabel(money.coveredUntilDate)}</span>
        </p>
      )}

      {/* Money + Habit boxes — larger muted labels, value text stays bold/ink. */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-surface p-4 shadow-soft">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-ink-muted">
            Money
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-sm text-ink-muted">Today's plan</p>
                <p className="mt-0.5 font-mono text-base font-bold text-ink">
                  {formatCurrency(planAmountRounded)}
                </p>
              </div>
              {planStatus && (
                <span
                  className={`shrink-0 font-mono text-xs font-bold ${planStatus.color}`}
                >
                  {planStatus.text}
                </span>
              )}
            </div>
            <div>
              <p className="font-mono text-sm text-ink-muted">Saved today</p>
              <p className="mt-0.5 font-mono text-base font-bold text-ink">
                {formatCurrency(savedTodayRounded)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-surface p-4 shadow-soft">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-ink-muted">
            Habit
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-sm text-ink-muted">Last deposit</p>
                <p className="mt-0.5 font-mono text-base font-bold text-ink">
                  {habitHeadline}
                </p>
              </div>
              {depositStatus && (
                <span
                  className={`shrink-0 font-mono text-xs font-bold ${depositStatus.color}`}
                >
                  {depositStatus.text}
                </span>
              )}
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

      {/* Verified Balance — larger muted label, value size unchanged. */}
      {verifiedBalance && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-surface/80 px-3 py-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-800">
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
          <button
            type="button"
            onClick={verifiedBalance.onCheck}
            aria-label="Check balance"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-800 shadow-soft hover:bg-brand-200 active:scale-[0.95] transition-all"
          >
            <IconArrowRight size={22} />
          </button>
        </div>
      )}
    </section>
  );
}
