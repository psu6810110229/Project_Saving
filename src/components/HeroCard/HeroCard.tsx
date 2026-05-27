import { memo, useMemo, type CSSProperties } from 'react';
import { BucketCategoryIcon } from '../BucketCategoryIcon/BucketCategoryIcon';
import { IconCheckCircle, IconFire } from '../Icon/Icon';
import { formatCurrency } from '../../lib/format';
import { useAnimatedNumbers } from '../../hooks/useAnimatedNumber';
import type { BucketCategory, DailySummaryItem, ProjectCategory } from '../../types';

interface HeroCardProps {
  displayName: string;
  saved: number;
  target: number;
  roomName?: string | null;
  roomCategory?: ProjectCategory | null;
  coverImageUrl?: string | null;
  validThru?: string | null;
  dailySummaryItem?: DailySummaryItem | null;
  hasBuckets: boolean;
  streak: number;
  streakUnit?: 'day' | 'week' | 'month';
}

type HeroStyle = CSSProperties & {
  '--hero-card-cover'?: string;
};

function formatValidThru(date?: string | null): string | null {
  if (!date) return null;
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);
  if (!m) return null;
  return `${m[2]}/${m[1].slice(2)}`;
}

function cssUrl(value: string): string {
  return `url("${value.replace(/"/g, '%22')}")`;
}

function compactRoomLabel(roomName?: string | null): string {
  const raw = roomName?.trim();
  if (!raw) return 'GO-OUT';
  return raw
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 12)
    .toUpperCase() || 'GO-OUT';
}

function streakUnitLabel(unit: HeroCardProps['streakUnit'], streak: number): string {
  const resolved = unit ?? 'day';
  const plural = streak === 1 ? '' : 's';
  if (resolved === 'week') return `week${plural}`;
  if (resolved === 'month') return `month${plural}`;
  return `day${plural}`;
}

function dailySummaryLabel(item: DailySummaryItem | null | undefined, hasBuckets: boolean): string {
  if (!item) return hasBuckets ? 'Today: All caught up!' : 'Set up your goals';
  const amount = item.amountDue == null
    ? null
    : formatCurrency(Math.round(item.amountDue));
  if (amount) return `Today: ${amount} -> ${item.bucketName}`;
  return `Today: ${item.bucketName}`;
}

export const HeroCard = memo(function HeroCard({
  displayName,
  saved,
  target,
  roomName,
  roomCategory,
  coverImageUrl,
  validThru,
  dailySummaryItem,
  hasBuckets,
  streak,
  streakUnit,
}: HeroCardProps) {
  const pct = target > 0 ? (saved / target) * 100 : 0;
  const [animSaved, animTarget, animPct] = useAnimatedNumbers([saved, target, pct]);
  const pctRounded = Math.round(animPct);
  const clamped = Math.max(0, Math.min(100, animPct));
  const validThruLabel = formatValidThru(validThru);
  const cardStyle = useMemo<HeroStyle>(() => (
    coverImageUrl ? { '--hero-card-cover': cssUrl(coverImageUrl) } : {}
  ), [coverImageUrl]);
  const focusCategory: BucketCategory | undefined = dailySummaryItem?.category;
  const dailyLabel = dailySummaryLabel(dailySummaryItem, hasBuckets);


  return (
    <div className="vault-card-frame">
      <section
        className="hero-credit-card flex min-h-[25rem] flex-col rounded-2xl px-4 py-4 text-white min-[390px]:min-h-[26rem] min-[390px]:px-5"
        data-category={roomCategory ?? 'travel'}
        data-has-cover={coverImageUrl ? 'true' : 'false'}
        style={cardStyle}
      >
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-sans text-sm font-semibold leading-tight text-white/82 drop-shadow-[0_1px_8px_rgba(95,36,23,0.36)]">
              Hi, {displayName}
            </p>
          </div>
          <span
            className="shrink-0 font-mono text-sm font-bold tabular-nums text-white/90 drop-shadow-[0_1px_8px_rgba(95,36,23,0.4)]"
            aria-label={`${pctRounded}%`}
          >
            {pctRounded}%
          </span>
        </div>

        <div className="relative z-10 mt-9 text-center min-[390px]:mt-10">
          <p className="font-mono text-[2.35rem] font-bold leading-none tabular-nums drop-shadow-[0_1px_12px_rgba(95,36,23,0.55)] min-[390px]:text-[2.8rem]">
            {formatCurrency(Math.round(animSaved))}
          </p>
          <p className="mt-2 font-mono text-sm font-semibold tabular-nums text-white/78 drop-shadow-[0_1px_8px_rgba(95,36,23,0.35)]">
            / {formatCurrency(Math.round(animTarget))}
          </p>
        </div>

        <div className="relative z-10 mt-5">
          <div className="h-2 w-full overflow-hidden rounded-pill bg-white/[0.32] shadow-[inset_0_1px_2px_rgba(92,40,7,0.36)]">
            <div
              className="h-full rounded-pill bg-white shadow-[0_0_16px_rgba(255,255,255,0.62)] transition-[width] duration-500"
              style={{ width: `${clamped}%` }}
            />
          </div>
        </div>

        <div className="relative z-10 mt-5 flex flex-col gap-2">
          <div className="flex min-h-10 items-center gap-2 rounded-xl bg-white/10 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/14 text-white">
              {focusCategory ? <BucketCategoryIcon category={focusCategory} size={16} /> : <IconCheckCircle size={16} />}
            </span>
            <p className="min-w-0 flex-1 truncate font-sans text-sm font-semibold text-white/90">
              {dailyLabel}
            </p>
          </div>
          <div className="flex min-h-10 items-center gap-2 rounded-xl bg-white/10 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/14 text-white">
              <IconFire size={16} />
            </span>
            <p className="min-w-0 flex-1 truncate font-sans text-sm font-semibold text-white/90">
              {streak > 0 ? `${streak}-${streakUnitLabel(streakUnit, streak)} streak` : 'Start your streak today'}
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-auto flex items-end justify-between gap-4 pt-5">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase leading-none tracking-[0.18em] text-white/55">
              Valid thru
            </p>
            <p className="mt-2 font-mono text-xs font-semibold leading-none tabular-nums text-white/85">
              {validThruLabel ?? '--/--'}
            </p>
          </div>
          <p className="max-w-[45%] truncate text-right font-mono text-xs font-semibold uppercase leading-none tracking-wide text-white/85">
            {compactRoomLabel(roomName)}
          </p>
        </div>
      </section>
    </div>
  );
});
