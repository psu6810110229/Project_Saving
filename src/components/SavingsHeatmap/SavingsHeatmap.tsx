import { useEffect, useMemo, useRef, useState } from 'react';
import { IconFlag } from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';
import { todayBangkokKey } from '../../lib/savingPlan';
import { bucketPercent, bucketSaved } from '../../lib/buckets';
import { buildSavingsHeatmap, type HeatLevel } from '../../lib/savingsHeatmap';
import type { Bucket, BucketTransfer, SavingsLog } from '../../types';

interface SavingsHeatmapProps {
  /** All room logs; the component filters to the current user's own deposits. */
  logs: SavingsLog[];
  userId: string | undefined;
  /** The current user's buckets — drive the start / due markers. */
  buckets: Bucket[];
  /** Same-user bucket transfers — for accurate per-bucket saved totals. */
  transfers?: BucketTransfer[];
  /** Room created_at (ISO) — project window start. */
  roomStartIso?: string | null;
  /** Room end_date (YYYY-MM-DD) — project window end. */
  roomEndDateKey?: string | null;
  /** sessionStorage key for scroll-position persistence. */
  storageKey: string;
}

/** One bucket due on a given day, with its progress. */
interface DueBucketInfo {
  id: string;
  name: string;
  saved: number;
  target: number;
  percent: number;
}

/** A pinned due-marker popover: which day, and where to anchor it. */
interface DuePopover {
  dateKey: string;
  /** Centre x and top y of the tapped cell, relative to the section. */
  left: number;
  top: number;
}

const POPOVER_WIDTH = 192;
const POPOVER_MARGIN = 8;

const CELL_PX = 14;
const GAP_PX = 3;
const COL_PX = CELL_PX + GAP_PX;

const LEVEL_CLASS: Record<HeatLevel, string> = {
  0: 'bg-well',
  1: 'bg-brand-200',
  2: 'bg-brand-400',
  3: 'bg-brand-600',
  4: 'bg-brand-800',
};

function dayKeyOf(iso: string): string {
  return todayBangkokKey(new Date(iso));
}

function minKey(keys: string[]): string | null {
  let min: string | null = null;
  for (const k of keys) if (min === null || k < min) min = k;
  return min;
}

function maxKey(keys: string[]): string | null {
  let max: string | null = null;
  for (const k of keys) if (max === null || k > max) max = k;
  return max;
}

/**
 * GitHub-style contributions calendar of the current user's own daily
 * deposits. Cell colour intensity scales with the deposit amount that day
 * (quartiles of the user's own non-zero days). The grid spans the project
 * timeline (room/bucket start → latest bucket due / room end), scrolls
 * horizontally, auto-scrolls to today, persists its scroll position for
 * the session, and marks each bucket's start and due day.
 */
export function SavingsHeatmap({
  logs,
  userId,
  buckets,
  transfers,
  roomStartIso,
  roomEndDateKey,
  storageKey,
}: SavingsHeatmapProps) {
  const { copy, language, formatMoney } = useI18n();
  const d = copy.dashboard;
  const todayKey = todayBangkokKey();
  const locale = language === 'th' ? 'th-TH' : 'en-US';

  const { weeks, todayColumnIndex } = useMemo(() => {
    const dailyTotals = new Map<string, number>();
    for (const log of logs) {
      if (userId && log.user_id !== userId) continue;
      if (log.amount <= 0) continue;
      const key = dayKeyOf(log.created_at);
      dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + log.amount);
    }

    const activeBuckets = buckets.filter(b => b.archived_at == null);
    const bucketStartKeys = new Set<string>(activeBuckets.map(b => dayKeyOf(b.created_at)));
    const bucketDueKeys = new Set<string>(
      activeBuckets.flatMap(b => (b.deadline ? [b.deadline] : [])),
    );

    const startCandidates = [
      ...(roomStartIso ? [dayKeyOf(roomStartIso)] : []),
      ...bucketStartKeys,
      ...dailyTotals.keys(),
    ];
    let startKey = minKey(startCandidates) ?? todayKey;
    if (startKey > todayKey) startKey = todayKey;

    const endCandidates = [
      ...(roomEndDateKey ? [roomEndDateKey] : []),
      ...bucketDueKeys,
      todayKey,
    ];
    const endKey = maxKey(endCandidates) ?? todayKey;

    return buildSavingsHeatmap({
      dailyTotals,
      startKey,
      endKey,
      todayKey,
      bucketStartKeys,
      bucketDueKeys,
    });
  }, [logs, userId, buckets, roomStartIso, roomEndDateKey, todayKey]);

  // Buckets due on each day, with progress — drives the tappable due-marker popover.
  const dueByDate = useMemo(() => {
    const map = new Map<string, DueBucketInfo[]>();
    for (const b of buckets) {
      if (b.archived_at != null || !b.deadline) continue;
      const info: DueBucketInfo = {
        id: b.id,
        name: b.name,
        saved: bucketSaved(b.id, logs, transfers),
        target: b.target_amount,
        percent: Math.round(bucketPercent(b, logs, transfers)),
      };
      const list = map.get(b.deadline);
      if (list) list.push(info);
      else map.set(b.deadline, [info]);
    }
    return map;
  }, [buckets, logs, transfers]);

  // Month labels — shown above the first column of each calendar month.
  const monthLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
    const months = weeks.map(column => {
      const mondayKey = column[0]?.dateKey;
      if (!mondayKey) return '';
      const [y, m, dd] = mondayKey.split('-').map(Number);
      return fmt.format(new Date(Date.UTC(y, m - 1, dd)));
    });
    // Label only the first column of each month.
    return months.map((month, i) => (month && month !== months[i - 1] ? month : ''));
  }, [weeks, locale]);

  const weekdayLabels = language === 'th'
    ? ['จ', '', 'พ', '', 'ศ', '', '']
    : ['Mon', '', 'Wed', '', 'Fri', '', ''];

  const sectionRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<DuePopover | null>(null);

  const dueDateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
    [locale],
  );

  function handleDueClick(dateKey: string, e: React.MouseEvent<HTMLButtonElement>) {
    setPopover(prev => {
      if (prev?.dateKey === dateKey) return null;
      const section = sectionRef.current;
      if (!section) return null;
      const cellRect = e.currentTarget.getBoundingClientRect();
      const sectionRect = section.getBoundingClientRect();
      const rawLeft = cellRect.left - sectionRect.left + cellRect.width / 2;
      const half = POPOVER_WIDTH / 2 + POPOVER_MARGIN;
      const left = Math.min(Math.max(rawLeft, half), sectionRect.width - half);
      return { dateKey, left, top: cellRect.top - sectionRect.top };
    });
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let saved: number | null = null;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw != null) saved = Number(raw);
    } catch { /* sessionStorage may be unavailable */ }

    if (saved != null && Number.isFinite(saved)) {
      el.scrollLeft = saved;
    } else if (todayColumnIndex >= 0) {
      el.scrollLeft = Math.max(0, todayColumnIndex * COL_PX - el.clientWidth / 2 + COL_PX / 2);
    } else {
      el.scrollLeft = el.scrollWidth;
    }
  }, [storageKey, todayColumnIndex]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (popover) setPopover(null);
    try {
      window.sessionStorage.setItem(storageKey, String(Math.round(el.scrollLeft)));
    } catch { /* ignore */ }
  }

  return (
    <section ref={sectionRef} className="relative rounded-xl bg-surface p-4 shadow-soft" aria-label={d.heatmapTitle}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-mono text-sm font-bold text-ink">{d.heatmapTitle}</h2>
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-ink-muted">
          <span>{d.heatmapLess}</span>
          {([0, 1, 2, 3, 4] as HeatLevel[]).map(level => (
            <span
              key={level}
              className={`h-[10px] w-[10px] rounded-[2px] ${LEVEL_CLASS[level]}`}
            />
          ))}
          <span>{d.heatmapMore}</span>
        </div>
      </div>

      <div className="flex gap-1.5">
        {/* Weekday gutter — aligned with the grid rows below the month row. */}
        <div className="flex shrink-0 flex-col" style={{ gap: GAP_PX }} aria-hidden>
          <div style={{ height: CELL_PX }} />
          {weekdayLabels.map((label, row) => (
            <div
              key={row}
              className="flex items-center justify-end font-mono text-[8px] leading-none text-ink-dim"
              style={{ height: CELL_PX, width: 22 }}
            >
              {label}
            </div>
          ))}
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="min-w-0 flex-1 overflow-x-auto"
        >
          {/* Month labels */}
          <div className="flex" style={{ gap: GAP_PX, height: CELL_PX }}>
            {monthLabels.map((label, col) => (
              <div
                key={col}
                className="font-mono text-[9px] leading-none text-ink-muted"
                style={{ width: CELL_PX }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Week columns */}
          <div className="flex" style={{ gap: GAP_PX }}>
            {weeks.map((column, col) => (
              <div key={col} className="flex flex-col" style={{ gap: GAP_PX }}>
                {column.map(cell => {
                  const title = `${formatMoney(cell.amount)} · ${cell.dateKey}`
                    + (cell.bucketDue ? ` · ${d.heatmapDueLegend}` : '')
                    + (cell.bucketStart ? ` · ${d.heatmapStartLegend}` : '');
                  const cellClass =
                    'relative rounded-[3px] '
                    + LEVEL_CLASS[cell.level]
                    + (cell.isFuture ? ' opacity-40' : '')
                    + (!cell.inRange ? ' opacity-30' : '')
                    + (cell.isToday ? ' ring-2 ring-ink' : '')
                    + (cell.bucketStart ? ' ring-2 ring-accent-leaf' : '');
                  const flag = cell.bucketDue && (
                    <span
                      className="absolute inset-0 grid place-items-center text-danger"
                      aria-hidden
                    >
                      <IconFlag size={9} strokeWidth={2.5} />
                    </span>
                  );

                  if (cell.bucketDue) {
                    return (
                      <button
                        key={cell.dateKey}
                        type="button"
                        title={title}
                        aria-label={`${d.heatmapDueLegend} · ${cell.dateKey}`}
                        aria-expanded={popover?.dateKey === cell.dateKey}
                        onClick={e => handleDueClick(cell.dateKey, e)}
                        className={
                          cellClass
                          + (popover?.dateKey === cell.dateKey ? ' ring-2 ring-danger' : '')
                        }
                        style={{ height: CELL_PX, width: CELL_PX }}
                      >
                        {flag}
                      </button>
                    );
                  }

                  return (
                    <div
                      key={cell.dateKey}
                      title={title}
                      className={cellClass}
                      style={{ height: CELL_PX, width: CELL_PX }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Marker legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-[10px] w-[10px] rounded-[2px] bg-well ring-2 ring-accent-leaf" />
          {d.heatmapStartLegend}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="grid h-[12px] w-[12px] place-items-center text-danger">
            <IconFlag size={10} strokeWidth={2.5} />
          </span>
          {d.heatmapDueLegend}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[10px] w-[10px] rounded-[2px] bg-well ring-2 ring-ink" />
          {d.heatmapTodayLegend}
        </span>
      </div>

      {/* Due-marker popover: tap a flag to see the bucket(s) due that day. */}
      {popover && (() => {
        const items = dueByDate.get(popover.dateKey) ?? [];
        if (items.length === 0) return null;
        const [py, pm, pd] = popover.dateKey.split('-').map(Number);
        const dateLabel = dueDateFmt.format(new Date(Date.UTC(py, pm - 1, pd)));
        return (
          <>
            {/* Outside-tap dismiss layer. */}
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setPopover(null)}
            />
            <div
              role="dialog"
              aria-label={`${d.heatmapDueDetailTitle} · ${dateLabel}`}
              className="absolute z-20 -translate-x-1/2 rounded-lg bg-surfaceAlt p-2.5 shadow-soft ring-1 ring-ink/10"
              style={{
                left: popover.left,
                top: popover.top,
                width: POPOVER_WIDTH,
                transform: 'translate(-50%, calc(-100% - 8px))',
              }}
            >
              <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-bold text-danger">
                <IconFlag size={10} strokeWidth={2.5} />
                <span>{d.heatmapDueDetailTitle} · {dateLabel}</span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {items.map(item => (
                  <li key={item.id} className="flex flex-col gap-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-mono text-[11px] text-ink">{item.name}</span>
                      <span className="shrink-0 font-mono text-[10px] font-bold text-ink-muted">{item.percent}%</span>
                    </div>
                    <span className="font-mono text-[10px] text-ink-dim">
                      {formatMoney(item.saved)} / {formatMoney(item.target)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        );
      })()}
    </section>
  );
}
