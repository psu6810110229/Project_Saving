import { memo, useMemo, type CSSProperties, type ReactNode } from 'react';
import {
  IconCamera,
  IconCheckCircle,
  IconEdit,
  IconFire,
  IconLayers,
  IconUser,
} from '../Icon/Icon';
import { formatCurrency } from '../../lib/format';
import { useAnimatedNumbers } from '../../hooks/useAnimatedNumber';
import type { DailySummaryItem, ProjectCategory } from '../../types';

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
  bucketCount?: number;
  streak: number;
  streakUnit?: 'day' | 'week' | 'month';
  lastCheckedAt?: string | null;
  onEdit?: () => void;
  editAriaLabel?: string;
  onChangeCover?: () => void;
  changeCoverAriaLabel?: string;
  changingCover?: boolean;
}

type HeroStyle = CSSProperties & {
  '--hero-card-cover'?: string;
};

interface InlineInfoProps {
  icon: ReactNode;
  label: string;
  value: string;
}

interface MetricProps extends InlineInfoProps {
  helper: string;
}

function cssUrl(value: string): string {
  return `url("${value.replace(/"/g, '%22')}")`;
}

function parseLocalDate(date?: string | null): Date | null {
  if (!date) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) return null;
  const parsed = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addMonthsClamped(date: Date, months: number): Date {
  const monthIndex = date.getMonth() + months;
  const year = date.getFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(date.getDate(), lastDay));
}

function monthsUntilDate(due: Date, today: Date): number {
  const monthDiff = (due.getFullYear() - today.getFullYear()) * 12 + (due.getMonth() - today.getMonth());
  const needsExtraMonth = due.getDate() > today.getDate() ? 1 : 0;
  return Math.max(1, monthDiff + needsExtraMonth);
}

function formatTimeLeft(date?: string | null): string | null {
  const due = parseLocalDate(date);
  if (!due) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msPerDay = 24 * 60 * 60 * 1000;
  if (due <= today) return 'วันนี้';

  const oneMonthFromToday = addMonthsClamped(today, 1);
  if (due < oneMonthFromToday) {
    return `${Math.ceil((due.getTime() - today.getTime()) / msPerDay)} วัน`;
  }

  const months = monthsUntilDate(due, today);
  if (months < 12) return `${months} เดือน`;

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths > 0
    ? `${years} ปี ${remainingMonths} เดือน`
    : `${years} ปี`;
}

function formatLastChecked(iso?: string | null): string {
  if (!iso) return 'วันนี้';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'วันนี้';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const checked = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAgo = Math.floor((today.getTime() - checked.getTime()) / (24 * 60 * 60 * 1000));

  if (daysAgo <= 0) return 'วันนี้';
  if (daysAgo === 1) return 'เมื่อวาน';
  if (daysAgo <= 30) return `${daysAgo} วันก่อน`;
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(date);
}

function formatBucketCount(count: number): string {
  return `${Math.max(0, count)} เป้าหมาย`;
}

function formatStreak(streak: number, unit: HeroCardProps['streakUnit']): string {
  const value = Math.max(0, Math.round(streak));
  const resolved = unit ?? 'day';
  if (resolved === 'week') return `${value} สัปดาห์`;
  if (resolved === 'month') return `${value} เดือน`;
  return `${value} วัน`;
}

function MetricItem({ icon, label, value, helper }: MetricProps) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 px-1">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[#FFE2B8]/48 bg-[#FFE2B8]/10 text-[#FFE2B8] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-mono text-[0.46rem] font-bold uppercase leading-none tracking-[0.05em] text-[#FFE2B8]/76">
          {label}
        </span>
        <span className="mt-1 block truncate font-mono-th text-[0.62rem] font-bold leading-none tracking-[0.03em] text-white/95">
          {value}
        </span>
        <span className="mt-0.5 block truncate font-mono-th text-[0.42rem] font-medium leading-[0.62rem] tracking-[0.03em] text-white/56">
          {helper}
        </span>
      </span>
    </div>
  );
}

export const HeroCard = memo(function HeroCard({
  displayName,
  saved,
  target,
  roomCategory,
  coverImageUrl,
  validThru,
  hasBuckets,
  bucketCount,
  streak,
  streakUnit,
  lastCheckedAt,
  onEdit,
  editAriaLabel,
  onChangeCover,
  changeCoverAriaLabel,
  changingCover = false,
}: HeroCardProps) {
  const pct = target > 0 ? (saved / target) * 100 : 0;
  const [animSaved, animTarget, animPct] = useAnimatedNumbers([saved, target, pct]);
  const pctRounded = Math.round(animPct);
  const clamped = Math.max(0, Math.min(100, animPct));
  const remaining = Math.max(target - saved, 0);
  const timeLeft = formatTimeLeft(validThru);
  const remainingAmount = formatCurrency(Math.round(remaining));
  const latestLabel = formatLastChecked(lastCheckedAt);
  const resolvedBucketCount = bucketCount ?? (hasBuckets ? 1 : 0);
  const cardStyle = useMemo<HeroStyle>(() => (
    coverImageUrl ? { '--hero-card-cover': cssUrl(coverImageUrl) } : {}
  ), [coverImageUrl]);
  const metrics: MetricProps[] = [
    {
      icon: <IconUser size={13} />,
      label: 'OWNER',
      value: displayName,
      helper: 'สู้ๆ นะคนเก่ง :)',
    },
    {
      icon: <IconLayers size={13} />,
      label: 'BUCKETS',
      value: formatBucketCount(resolvedBucketCount),
      helper: 'มีไว้พุ่งชน',
    },
    {
      icon: <IconFire size={13} />,
      label: 'STREAK',
      value: formatStreak(streak, streakUnit),
      helper: 'ติดต่อกัน',
    },
    {
      icon: <IconCheckCircle size={13} />,
      label: 'CHECKED',
      value: latestLabel,
      helper: 'ที่เช็คยอดล่าสุด',
    },
  ];

  return (
    <div className="vault-card-frame">
      <section
        className="hero-credit-card flex w-full flex-col rounded-2xl px-3 py-5 text-white min-[400px]:px-4 min-[480px]:py-5"
        data-has-cover={coverImageUrl ? 'true' : 'false'}
        data-category={roomCategory ?? undefined}
        style={cardStyle}
      >
        <div className="relative z-10 flex items-start justify-between gap-3">
          <h2 className="min-w-0 truncate py-0.5 font-mono-th text-[1rem] font-semibold leading-tight tracking-[0.04em] text-white drop-shadow-[0_2px_10px_rgba(116,50,20,0.34)] min-[480px]:text-[1.42rem]">
            ยอดเก็บของคุณ
          </h2>
          <div className="flex shrink-0 items-center gap-1.5 text-white drop-shadow-[0_2px_10px_rgba(116,50,20,0.32)]">
            <span
              className="font-mono text-[1.0rem] font-semibold leading-none tracking-[0.04em] tabular-nums min-[480px]:text-[1.42rem]"
              aria-label={`${pctRounded}%`}
            >
              {pctRounded}%
            </span>
            {onChangeCover && (
              <button
                type="button"
                aria-label={changeCoverAriaLabel ?? 'Change cover image'}
                title={changeCoverAriaLabel ?? 'Change cover image'}
                disabled={changingCover}
                onClick={e => { e.stopPropagation(); onChangeCover(); }}
                className="-mt-1 grid h-8 w-8 place-items-center rounded-full text-white/82 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-wait disabled:opacity-55 "
              >
                <IconCamera size={21} strokeWidth={1.75} />
              </button>
            )}
            {onEdit ? (
              <button
                type="button"
                aria-label={editAriaLabel ?? 'Edit'}
                onClick={e => { e.stopPropagation(); onEdit(); }}
                className="-mt-1 grid h-8 w-8 place-items-center rounded-full text-white/82 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <IconEdit size={20} strokeWidth={1.7} />
              </button>
            ) : (
              <span className="-mt-1 grid h-8 w-8 place-items-center text-white/84" aria-hidden>
                <IconEdit size={20} strokeWidth={1.7} />
              </span>
            )}
          </div>
        </div>

        <div className="relative z-10 mt-1.5 min-[480px]:mt-2">
          <div className="flex max-w-full items-baseline gap-2 whitespace-nowrap">
            <span className="font-mono text-[1.75rem] font-bold leading-none tracking-[0.06em] tabular-nums text-white drop-shadow-[0_2px_12px_rgba(116,50,20,0.36)] min-[480px]:text-[2.62rem]">
              {formatCurrency(Math.round(animSaved))}
            </span>
            <span className="font-mono text-[1.25rem] font-semibold leading-none tracking-[0.08em] tabular-nums text-white/82 drop-shadow-[0_2px_8px_rgba(116,50,20,0.28)] min-[480px]:text-[1.48rem]">
              <span className="mr-0.5">/</span>{formatCurrency(Math.round(animTarget))}
            </span>
          </div>

          <div
            className="mt-3 h-2 w-[65%] min-w-[12rem] max-w-full overflow-hidden rounded-pill bg-white/[0.3] shadow-[inset_0_1px_2px_rgba(126,55,20,0.22)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(clamped)}
          >
            <div
              className="h-full rounded-pill bg-white shadow-[0_0_14px_rgba(255,246,232,0.54)] transition-[width] duration-500"
              style={{ width: `${clamped}%`, minWidth: clamped > 0 ? '13px' : '0px' }}
            />
          </div>

          <p className="mt-3 truncate font-mono-th text-[0.85rem] font-semibold leading-snug tracking-[0.03em] text-white/84 drop-shadow-[0_1px_7px_rgba(116,50,20,0.32)] min-[480px]:text-[0.95rem]">
            เหลืออีก <span className="font-mono tabular-nums">{remainingAmount}</span>
            {timeLeft ? <> ภายในเวลา {timeLeft}</> : null}
          </p>
        </div>

        <div className="relative z-10 mt-3 grid grid-cols-4 border-t border-white/25 pt-4">
          {metrics.map((metric, index) => (
            <div key={metric.label} className={index === 0 ? 'min-w-0' : 'min-w-0 border-l border-white/50'}>
              <MetricItem {...metric} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
});
