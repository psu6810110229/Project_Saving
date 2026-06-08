import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  IconCamera,
  IconCheckCircle,
  IconEdit,
  IconFire,
  IconLayers,
  IconUser,
} from '../Icon/Icon';
import { formatCurrency } from '../../lib/format';
import { useSecondaryMotionReady } from '../../lib/animationBudget';
import { normalizeHeroCoverUrl } from '../../lib/heroCovers';
import { useAnimatedNumbers } from '../../hooks/useAnimatedNumber';
import type { CoverTint, DailySummaryItem, ProjectCategory } from '../../types';

// How long each hero goal line stays before the ticker swaps to the next.
const HERO_LINE_INTERVAL_MS = 4000;

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
  streakTrackable?: boolean;
  lastCheckedAt?: string | null;
  onEdit?: () => void;
  editAriaLabel?: string;
  onChangeCover?: () => void;
  changeCoverAriaLabel?: string;
  changingCover?: boolean;
  coverTint?: CoverTint | null;
}

type HeroStyle = CSSProperties & {
  '--hero-card-cover'?: string;
  '--hero-scrim-rgb'?: string;
  '--hero-scrim-strength'?: string;
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
  return `${Math.max(0, count)} เป้า`;
}

function formatValidThru(date?: string | null): string | null {
  const due = parseLocalDate(date);
  if (!due) return null;
  const mm = String(due.getMonth() + 1).padStart(2, '0');
  const yy = String(due.getFullYear() % 100).padStart(2, '0');
  return `${mm}/${yy}`;
}

// Period-goal line derived from the focus bucket's saving rule, so the
// wording follows the plan cadence the user is actually on: daily rules read
// "วันนี้ต้องเก็บ", weekly "สัปดาห์นี้ต้องเก็บ", monthly "เดือนนี้ต้องเก็บ".
// Returns null when there is nothing left to save this period (or no rule),
// so the hero line stays static instead of rotating into an empty message.
function formatPeriodGoal(item?: DailySummaryItem | null): string | null {
  if (!item || item.amountDue == null || item.amountDue <= 0) return null;
  const amount = formatCurrency(Math.round(item.amountDue));
  switch (item.ruleType) {
    case 'fixed_daily':
    case 'increasing_daily':
    case 'increasing_daily_capped':
      return `วันนี้ต้องเก็บ ${amount}`;
    case 'fixed_weekly':
      return `สัปดาห์นี้ต้องเก็บ ${amount}`;
    case 'fixed_monthly':
      return `เดือนนี้ต้องเก็บ ${amount}`;
    default:
      return null;
  }
}

function isIncreasingRule(item?: DailySummaryItem | null): boolean {
  return item?.ruleType === 'increasing_daily' || item?.ruleType === 'increasing_daily_capped';
}

function isFlexibleStreak(item?: DailySummaryItem | null, trackable = true): boolean {
  return item?.ruleType === 'flexible' || (!trackable && Boolean(item));
}

function formatStreak(
  streak: number,
  unit: HeroCardProps['streakUnit'],
  item?: DailySummaryItem | null,
  trackable = true,
): string {
  if (isFlexibleStreak(item, trackable)) return 'ยืดหยุ่น';
  const value = Math.max(0, Math.round(streak));
  const resolved = unit ?? 'day';
  if (resolved === 'week') return `${value} สัปดาห์`;
  if (resolved === 'month') return `${value} เดือน`;
  if (isIncreasingRule(item)) return `${value} วันแล้ว`;
  return `${value} วัน`;
}

function streakHelper(
  unit: HeroCardProps['streakUnit'],
  item?: DailySummaryItem | null,
  trackable = true,
): string {
  if (isFlexibleStreak(item, trackable)) return 'ไม่มีสตรีก';
  if (isIncreasingRule(item)) return 'ตามยอดวันนี้';
  if (unit === 'week' || unit === 'month') return 'ตามแผน';
  return 'ติดต่อกัน';
}

function CardChip() {
  return (
    <span
      className="relative grid h-6 w-8 place-items-center overflow-hidden rounded-[5px] bg-gradient-to-b from-[#FCE7A8] via-[#E7BE63] to-[#C2912E] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_1px_2px_rgba(80,40,10,0.45)]"
      aria-hidden
    >
      <span className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-[#9a7320]/65" />
      <span className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-[#9a7320]/65" />
      <span className="absolute left-1/2 top-1/2 h-2.5 w-3 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-[#9a7320]/55" />
    </span>
  );
}

function ContactlessGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden className="text-white/85">
      <path d="M8.5 8a6 6 0 0 1 0 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 5.5a10 10 0 0 1 0 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M15.5 3a14 14 0 0 1 0 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MetricItem({ icon, label, value, helper }: MetricProps) {
  return (
    <div className="flex min-w-0 items-center gap-1 px-0.5">
      <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border border-[#FFE2B8]/48 bg-[#FFE2B8]/10 text-[#FFE2B8] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-mono text-[0.52rem] font-semibold uppercase leading-none tracking-[0.03em] text-[#FFE2B8]/85">
          {label}
        </span>
        <span className="mt-1 block truncate font-mono-th text-[0.68rem] font-medium leading-none tracking-[0.02em] text-white/85">
          {value}
        </span>
        <span className="mt-0.5 block truncate font-mono-th text-[0.5rem] font-medium leading-[0.72rem] tracking-[0.02em] text-white/85">
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
  dailySummaryItem,
  hasBuckets,
  bucketCount,
  streak,
  streakUnit,
  streakTrackable = true,
  lastCheckedAt,
  onEdit,
  editAriaLabel,
  onChangeCover,
  changeCoverAriaLabel,
  changingCover = false,
  coverTint,
}: HeroCardProps) {
  const pct = target > 0 ? (saved / target) * 100 : 0;
  const [animSaved, animTarget, animPct] = useAnimatedNumbers([saved, target, pct]);
  const pctRounded = Math.round(animPct);
  const clamped = Math.max(0, Math.min(100, animPct));
  const remaining = Math.max(target - saved, 0);
  const timeLeft = formatTimeLeft(validThru);
  const remainingAmount = formatCurrency(Math.round(remaining));
  const validThruLabel = formatValidThru(validThru);
  const latestLabel = formatLastChecked(lastCheckedAt);
  const resolvedBucketCount = bucketCount ?? (hasBuckets ? 1 : 0);
  const reduceMotion = useReducedMotion();
  const secondaryMotionReady = useSecondaryMotionReady();
  // The hero "what's left" line rotates between the overall goal and the
  // current saving-plan period goal (today / this week / this month). When
  // there is no active period goal it stays a single static line.
  const goalLines = useMemo<ReactNode[]>(() => {
    const overall: ReactNode = (
      <>
        ต้องเก็บ <span className="font-mono tabular-nums">{remainingAmount}</span>
        {timeLeft ? <> ภายในเวลา {timeLeft}</> : null}
      </>
    );
    const periodGoal = formatPeriodGoal(dailySummaryItem);
    return periodGoal ? [overall, periodGoal] : [overall];
  }, [remainingAmount, timeLeft, dailySummaryItem]);
  const [lineIndex, setLineIndex] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLineIndex(0);
  }, [goalLines.length]);
  useEffect(() => {
    if (!secondaryMotionReady) return;
    if (goalLines.length < 2) return;
    const id = window.setInterval(() => {
      setLineIndex(prev => (prev + 1) % goalLines.length);
    }, HERO_LINE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [goalLines.length, secondaryMotionReady]);
  const activeLineIndex = lineIndex % goalLines.length;
  const normalizedCoverImageUrl = normalizeHeroCoverUrl(coverImageUrl);
  const cardStyle = useMemo<HeroStyle>(() => {
    const style: HeroStyle = {};
    if (normalizedCoverImageUrl) style['--hero-card-cover'] = cssUrl(normalizedCoverImageUrl);
    if (coverTint) {
      style['--hero-scrim-rgb'] = coverTint.rgb.join(', ');
      style['--hero-scrim-strength'] = String(coverTint.strength);
    }
    return style;
  }, [normalizedCoverImageUrl, coverTint]);
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
      value: formatStreak(streak, streakUnit, dailySummaryItem, streakTrackable),
      helper: streakHelper(streakUnit, dailySummaryItem, streakTrackable),
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
        className="hero-credit-card flex aspect-[1.586/1] w-full flex-col justify-between rounded-2xl px-3 py-5 text-white min-[400px]:px-6 min-[480px]:py-8"
        data-has-cover={coverImageUrl ? 'true' : 'false'}
        data-category={roomCategory ?? undefined}
        style={cardStyle}
      >
        {coverImageUrl && <div className="hero-card-feather" aria-hidden />}
        <div className="hero-card-pattern" aria-hidden />
        <div className="absolute right-3 top-[46%] z-20 flex -translate-y-1/2 flex-col items-start gap-1 min-[400px]:right-4">
          <div className="flex items-center gap-2">
            <CardChip />
            <ContactlessGlyph />
          </div>
          {validThruLabel && (
            <div className="leading-none">
              <span className="block font-mono text-[0.45rem] font-bold uppercase tracking-[0.20em] text-white/85">
                Valid Thru
              </span>
              <span className="mt-0.5 block font-mono text-[0.58rem] font-semibold tabular-nums tracking-[0.08em] text-white/85">
                {validThruLabel}
              </span>
            </div>
          )}
        </div>
        <div className="relative z-10 flex items-start justify-between gap-3">
          <h2 className="min-w-0 truncate py-0.5 font-mono-th text-[0.85rem] font-light leading-tight tracking-[0.12em] text-white/85 drop-shadow-[0_2px_10px_rgba(18,16,15,0.34)] min-[480px]:text-[1.42rem]">
            สวัสดี {displayName}
          </h2>
          <div className="flex shrink-0 items-center gap-1 text-white/85 drop-shadow-[0_2px_10px_rgba(18,16,15,0.5)]">
            <span
              className="-mt-0.5 mr-1.5 font-mono text-[0.95rem] font-light leading-none tracking-[0.04em] tabular-nums min-[480px]:text-[1.2rem]"
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
                <IconCamera size={20} strokeWidth={1} />
              </button>
            )}
            {onEdit ? (
              <button
                type="button"
                aria-label={editAriaLabel ?? 'Edit'}
                onClick={e => { e.stopPropagation(); onEdit(); }}
                className="-mt-1 grid h-8 w-8 place-items-center rounded-full text-white/82 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <IconEdit size={20} strokeWidth={1} />
              </button>
            ) : (
              <span className="-mt-1 grid h-8 w-8 place-items-center text-white/84" aria-hidden>
                <IconEdit size={20} strokeWidth={1} />
              </span>
            )}
          </div>
        </div>

        <div className="relative z-10 mt-2">
          <div className="flex min-w-0 max-w-full items-baseline gap-2 whitespace-nowrap">
            <span className="font-mono text-[clamp(1.1rem,5.2vw,2rem)] font-semibold leading-none tracking-[0.02em] tabular-nums text-white/85 drop-shadow-[0_2px_12px_rgba(18,16,15,0.36)]">
              {formatCurrency(Math.round(animSaved))}
            </span>
            <span className="font-mono text-[clamp(0.8rem,3.6vw,1.2rem)] font-medium leading-none tracking-[0.04em] tabular-nums text-white/85 drop-shadow-[0_2px_8px_rgba(18,16,15,0.28)]">
              <span className="mr-2">/</span>{formatCurrency(Math.round(animTarget))}
            </span>
          </div>

          <div className="mt-3 flex items-center pr-[4.25rem] min-[480px]:pr-[4.75rem]">
            <div className="min-w-0 flex-1">
              <div
                className="hero-progress-track h-2 w-full overflow-hidden rounded-pill bg-white/[0.3] shadow-[inset_0_1px_2px_rgba(18,16,15,0.22)]"
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

              <div className="relative mt-3 h-[1rem] overflow-hidden min-[480px]:h-[1.15rem]">
                <AnimatePresence initial={false}>
                  <motion.p
                    key={activeLineIndex}
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: '100%' }}
                    animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: '-100%' }}
                    transition={{ duration: reduceMotion ? 0.2 : 0.45, ease: [0.16, 1, 0.2, 1] }}
                    className="absolute inset-x-0 top-0 truncate font-mono-th text-[0.72rem] font-medium leading-snug tracking-[0.03em] text-white/85 drop-shadow-[0_1px_7px_rgba(18,16,15,0.32)] min-[480px]:text-[0.82rem]"
                  >
                    {goalLines[activeLineIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-4 grid grid-cols-4 border-t border-white/25 pt-3">
          {metrics.map((metric, index) => (
            <div key={metric.label} className={index === 0 ? 'min-w-0' : 'min-w-0 border-l border-white/50 pl-1.5'}>
              <MetricItem {...metric} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
});
