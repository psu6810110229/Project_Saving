import { memo } from 'react';
import { IconEdit } from '../Icon/Icon';
import { formatCurrency } from '../../lib/format';
import { useI18n } from '../../i18n/useI18n';
import { useAnimatedNumbers } from '../../hooks/useAnimatedNumber';

interface TotalVaultCardProps {
  saved: number;
  target: number;
  onEdit?: () => void;
  editAriaLabel?: string;
  cardholderNames?: string[];
  validThru?: string | null;
  deadlineDate?: string | null;
}



type VaultTimeLeft =
  | { kind: 'days'; days: number }
  | { kind: 'months'; months: number }
  | { kind: 'yearsMonths'; years: number; months: number };

function parseLocalDate(date?: string | null): Date | null {
  if (!date) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function monthsUntilDate(due: Date, today: Date): number {
  const monthDiff = (due.getFullYear() - today.getFullYear()) * 12 + (due.getMonth() - today.getMonth());
  const needsExtraMonth = due.getDate() > today.getDate() ? 1 : 0;
  return Math.max(1, monthDiff + needsExtraMonth);
}

function addMonthsClamped(date: Date, months: number): Date {
  const targetMonthIndex = date.getMonth() + months;
  const targetYear = date.getFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  return new Date(targetYear, targetMonth, Math.min(date.getDate(), lastDayOfTargetMonth));
}

function getVaultTimeLeft(deadline?: string | null): VaultTimeLeft | null {
  const due = parseLocalDate(deadline);
  if (!due) return null;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msPerDay = 24 * 60 * 60 * 1000;
  if (due < startOfToday) return { kind: 'days', days: 0 };

  const oneMonthFromToday = addMonthsClamped(startOfToday, 1);
  if (due < oneMonthFromToday) {
    return { kind: 'days', days: Math.ceil((due.getTime() - startOfToday.getTime()) / msPerDay) };
  }

  const months = monthsUntilDate(due, startOfToday);
  if (months > 12) {
    return { kind: 'yearsMonths', years: Math.floor(months / 12), months: months % 12 };
  }
  return { kind: 'months', months };
}

function formatValidThru(date?: string | null): string | null {
  if (!date) return null;
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);
  if (!m) return null;
  return `${m[2]}/${m[1].slice(2)}`;
}

export const TotalVaultCard = memo(function TotalVaultCard({ saved, target, onEdit, editAriaLabel, cardholderNames, validThru, deadlineDate }: TotalVaultCardProps) {
  const { copy } = useI18n();
  const pct = target > 0 ? (saved / target) * 100 : 0;
  const [animSaved, animTarget, animPct] = useAnimatedNumbers([saved, target, pct]);
  const pctRounded = Math.round(animPct);
  const clamped = Math.max(0, Math.min(100, animPct));
  const remaining = Math.max(target - saved, 0);
  const timeLeft = getVaultTimeLeft(deadlineDate);
  const timeLeftLabel =
    timeLeft === null
      ? copy.dashboard.vaultInsightNoDeadline
      : timeLeft.kind === 'days'
        ? copy.dashboard.vaultInsightDaysLeft(timeLeft.days)
        : timeLeft.kind === 'months'
          ? copy.dashboard.vaultInsightMonthsLeft(timeLeft.months)
          : copy.dashboard.vaultInsightYearsMonthsLeft(timeLeft.years, timeLeft.months);

  const card = (
    <div className="vault-card-frame">
      <section className="vault-credit-card flex flex-col rounded-2xl px-4 py-3 text-white min-[390px]:px-5 min-[390px]:py-4">
        <div className="relative z-10 flex items-center justify-between gap-2">
          <h2 className="block font-mono text-sm font-bold leading-tight text-white drop-shadow-[0_1px_8px_rgba(95,36,23,0.28)]">
            {copy.dashboard.recordedVault}
          </h2>
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-sm font-bold tabular-nums text-white/90 drop-shadow-[0_1px_8px_rgba(95,36,23,0.4)]"
              aria-label={`${pctRounded}%`}
            >
              {pctRounded}%
            </span>
            {onEdit && (
              <button
                type="button"
                aria-label={editAriaLabel ?? 'Edit'}
                onClick={e => { e.stopPropagation(); onEdit?.(); }}
                className="grid h-7 w-7 place-items-center text-white/75 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
              >
                <IconEdit size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="relative z-10 mt-2 flex items-baseline gap-2">
          <span className="font-mono text-3xl font-bold tabular-nums drop-shadow-[0_1px_10px_rgba(95,36,23,0.5)]">{formatCurrency(Math.round(animSaved))}</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-white/80">/ {formatCurrency(Math.round(animTarget))}</span>
        </div>

        <div className="relative z-10 mt-3 h-1.5 w-full overflow-hidden rounded-pill bg-white/[0.35] shadow-[inset_0_1px_2px_rgba(92,40,7,0.35)]">
          <div
            className="h-full rounded-pill bg-white shadow-[0_0_14px_rgba(255,255,255,0.58)] transition-[width] duration-500"
            style={{ width: `${clamped}%` }}
          />
        </div>

        <div className="relative z-10 mt-3 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-white/85">
          <span>{copy.dashboard.vaultInsightGoalGap(formatCurrency(Math.round(remaining)))}</span>
          <span>{timeLeftLabel}</span>
        </div>

        {(cardholderNames?.length || validThru) && (
          <div className="relative z-10 mt-auto flex items-end justify-between gap-4 pt-3 min-[390px]:gap-5 min-[390px]:pt-4">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase leading-none tracking-[0.18em] text-white/55">
                Cardholders
              </p>
              <p className="mt-1.5 truncate font-mono text-[11px] font-semibold uppercase leading-none tracking-wide text-white/85 min-[390px]:mt-2">
                {(() => {
                  const names = cardholderNames ?? [];
                  return names.join(' • ');
                })()}
              </p>
            </div>
            {formatValidThru(validThru) && (
              <div className="shrink-0 text-right">
                <p className="font-mono text-[10px] uppercase leading-none tracking-[0.18em] text-white/55">
                  Valid thru
                </p>
                <p className="mt-1.5 font-mono text-xs font-semibold leading-none tabular-nums text-white/85 min-[390px]:mt-2">
                  {formatValidThru(validThru)}
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );

  return card;
});
