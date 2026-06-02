import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { IconChevronRight, IconFlag } from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';
import { todayBangkokKey } from '../../lib/savingPlan';
import { FADE_TRANSITION, REDUCED_MOTION_TRANSITION, SPRING } from '../../lib/motion';
import { bucketSaved } from '../../lib/buckets';
import { buildSavingsHeatmap, type HeatLevel } from '../../lib/savingsHeatmap';
import type { BalanceAllocation, Bucket, BucketTransfer, SavingsLog } from '../../types';

interface SavingsHeatmapProps {
  /** All room logs; the component filters to the current user's own deposits. */
  logs: SavingsLog[];
  userId: string | undefined;
  /** The current user's buckets — drive the start / due markers. */
  buckets: Bucket[];
  /** Same-user signed allocation ledger — drives real-money due popup values. */
  transfers?: BucketTransfer[];
  allocations?: BalanceAllocation[];
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
  currentAmount: number;
  target: number;
  percent: number;
}

/** A pinned cell popover: which day, and where to anchor it. */
interface DuePopover {
  dateKey: string;
  /** Centre x of the tapped cell in viewport coordinates. */
  left: number;
  /** y of the cell's top (above) or bottom (below) edge in viewport coordinates. */
  top: number;
  /** When true the popup opens below the cell instead of above. */
  below: boolean;
  /**
   * Set for non-flag cells — the raw daily saved amount.
   * Undefined for flag (bucket-due) cells, which show bucket progress instead.
   */
  dayAmount?: number;
}

const POPOVER_WIDTH = 192;
const POPOVER_DAY_WIDTH = 90;
const POPOVER_MARGIN = 8;
/** Estimated popup height used for the above/below flip decision. */
const POPOVER_HEIGHT_EST = 100;

const CELL_PX = 14;
const GAP_PX = 3;
const COL_PX = CELL_PX + GAP_PX;
/** A month needs at least this many week-columns to show its name label. */
const MIN_LABEL_COLS = 3;

const LEVEL_CLASS: Record<HeatLevel, string> = {
  0: 'bg-[#F3ECE5]',
  1: 'bg-[#F2C9A5]',
  2: 'bg-[#F0A15F]',
  3: 'bg-[#DF6A22]',
  4: 'bg-[#9B430D]',
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
  allocations,
  roomStartIso,
  roomEndDateKey,
  storageKey,
}: SavingsHeatmapProps) {
  const { copy, language, formatMoney } = useI18n();
  const d = copy.dashboard;
  const todayKey = todayBangkokKey();
  const locale = language === 'th' ? 'th-TH' : 'en-US';
  const reduceMotion = useReducedMotion();

  const { weeks, todayColumnIndex } = useMemo(() => {
    const dailyTotals = new Map<string, number>();
    for (const log of logs) {
      if (userId && log.user_id !== userId) continue;
      if (log.amount <= 0) continue;
      const key = dayKeyOf(log.created_at);
      dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + log.amount);
    }
    // Positive balance allocations (reconcile surplus moved into buckets) also
    // count as daily saving activity. Negative allocations are write-downs and
    // should not reduce the displayed heat.
    for (const alloc of (allocations ?? [])) {
      if (userId && alloc.user_id !== userId) continue;
      if (alloc.amount <= 0) continue;
      const key = dayKeyOf(alloc.created_at);
      dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + alloc.amount);
    }

    const activeBuckets = buckets.filter(b => b.archived_at == null);
    const projectStartKey = roomStartIso ? dayKeyOf(roomStartIso) : null;
    const bucketDueKeys = new Set<string>(
      activeBuckets.flatMap(b => (b.deadline ? [b.deadline] : [])),
    );

    const startCandidates = [
      ...(projectStartKey ? [projectStartKey] : []),
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
      projectStartKey,
      bucketDueKeys,
    });
  }, [logs, allocations, userId, buckets, roomStartIso, roomEndDateKey, todayKey]);

  // Buckets due on each day, with progress — drives the tappable due-marker popover.
  const dueByDate = useMemo(() => {
    const map = new Map<string, DueBucketInfo[]>();
    for (const b of buckets) {
      if (b.archived_at != null || !b.deadline) continue;
      const currentAmount = bucketSaved(b.id, logs, transfers, allocations);
      const info: DueBucketInfo = {
        id: b.id,
        name: b.name,
        currentAmount,
        target: b.target_amount,
        percent: b.target_amount > 0
          ? Math.min(100, Math.max(0, Math.round((currentAmount / b.target_amount) * 100)))
          : 0,
      };
      const list = map.get(b.deadline);
      if (list) list.push(info);
      else map.set(b.deadline, [info]);
    }
    return map;
  }, [allocations, buckets, logs, transfers]);

  // Month markers — a divider at every month boundary, plus a name label for
  // months wide enough to fit one without colliding with the next.
  const monthMarks = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
    const monthOf = (key: string) => {
      const [y, m] = key.split('-').map(Number);
      return y * 12 + (m - 1);
    };
    const labelOf = (key: string) => {
      const [y, m, dd] = key.split('-').map(Number);
      return fmt.format(new Date(Date.UTC(y, m - 1, dd)));
    };

    const starts: { col: number; row: number; text: string }[] = [];
    let previousMonth: number | null = null;
    for (let col = 0; col < weeks.length; col++) {
      const column = weeks[col];
      for (let row = 0; row < column.length; row++) {
        const key = column[row].dateKey;
        const month = monthOf(key);
        if (previousMonth === null || month !== previousMonth) {
          starts.push({ col, row, text: labelOf(key) });
          previousMonth = month;
        }
      }
    }

    const boundaries = starts.slice(1);
    const labels: { col: number; text: string }[] = [];
    for (let i = 0; i < starts.length; i++) {
      const start = starts[i];
      const next = starts[i + 1];
      const lastCol = next
        ? next.col - (next.row === 0 ? 1 : 0)
        : weeks.length - 1;
      const span = lastCol - start.col + 1;
      if (span >= MIN_LABEL_COLS) labels.push({ col: start.col, text: start.text });
    }
    return { boundaries, labels };
  }, [weeks, locale]);

  const gridWidth = weeks.length * COL_PX;

  const weekdayLabels = language === 'th'
    ? ['จ', '', 'พ', '', 'ศ', '', '']
    : ['Mon', '', 'Wed', '', 'Fri', '', ''];

  const sectionRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<DuePopover | null>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const dueDateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
    [locale],
  );

  function handleCellClick(
    dateKey: string,
    e: React.MouseEvent<HTMLButtonElement>,
    dayAmount?: number,
  ) {
    // Read DOM rects synchronously — the synthetic event is reused and
    // its currentTarget is null by the time a setState updater runs.
    const section = sectionRef.current;
    if (!section) return;
    const cellRect = e.currentTarget.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    // Horizontal: clamp within the section so the popup never clips left/right.
    const rawLeft = cellRect.left - sectionRect.left + cellRect.width / 2;
    const pw = dayAmount !== undefined ? POPOVER_DAY_WIDTH : POPOVER_WIDTH;
    const half = pw / 2 + POPOVER_MARGIN;
    const left = Math.min(Math.max(rawLeft, half), sectionRect.width - half);
    // Vertical: flip below the cell when there is not enough viewport space above.
    const below = cellRect.top - POPOVER_HEIGHT_EST - 8 < 8;
    const top = below
      ? cellRect.bottom - sectionRect.top
      : cellRect.top - sectionRect.top;
    setPopover(prev => (prev?.dateKey === dateKey ? null : { dateKey, left, top, below, dayAmount }));
  }

  function updateScrollHint() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
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
    updateScrollHint();
  }, [storageKey, todayColumnIndex]);

  useEffect(() => {
    updateScrollHint();
    window.addEventListener('resize', updateScrollHint);
    return () => window.removeEventListener('resize', updateScrollHint);
  }, [weeks]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (popover) setPopover(null);
    updateScrollHint();
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
          {([0, 2, 3, 4] as HeatLevel[]).map(level => (
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

        <div className="relative min-w-0 flex-1">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="overflow-x-auto"
          >
            <div className="relative w-max">
            {/* Month boundaries follow the real first day, including mid-week starts. */}
            <div aria-hidden className="pointer-events-none absolute inset-0">
              {monthMarks.boundaries.flatMap(({ col, row }) => {
                const left = Math.round(col * COL_PX - GAP_PX / 2);
                const rowTop = Math.round(CELL_PX + row * COL_PX - GAP_PX / 2);
                const gridTop = CELL_PX;
                const gridBottom = CELL_PX + 7 * CELL_PX + 6 * GAP_PX;
                const verticalTop = row === 0 ? gridTop : rowTop;
                const line = 'linear-gradient(to bottom, rgba(126,104,86,0.06), rgba(126,104,86,0.22) 18%, rgba(126,104,86,0.22) 88%, rgba(126,104,86,0.06))';
                const parts = [
                  <span
                    key={`${col}-${row}-v`}
                    className="absolute"
                    style={{
                      left,
                      top: verticalTop,
                      width: 1,
                      height: gridBottom - verticalTop,
                      background: line,
                    }}
                  />,
                ];
                if (row > 0) {
                  parts.push(
                    <span
                      key={`${col}-${row}-h`}
                      className="absolute"
                      style={{
                        left,
                        top: rowTop,
                        width: CELL_PX,
                        height: 1,
                        background: 'rgba(126,104,86,0.18)',
                      }}
                    />,
                  );
                }
                return parts;
              })}
            </div>

            {/* Month labels — placed above each labelled month's first column. */}
            <div className="relative" style={{ height: CELL_PX, width: gridWidth }}>
              {monthMarks.labels.map(({ col, text }) => (
                <span
                  key={col}
                  className="absolute top-0 whitespace-nowrap font-mono text-[9px] leading-none text-ink-muted"
                  style={{ left: col * COL_PX + 1 }}
                >
                  {text}
                </span>
              ))}
            </div>

            {/* Week columns */}
            <div className="flex" style={{ gap: GAP_PX }}>
            {weeks.map((column, col) => (
              <div key={col} className="flex flex-col" style={{ gap: GAP_PX }}>
                {column.map(cell => {
                  const title = `${formatMoney(cell.amount)} · ${cell.dateKey}`
                    + (cell.bucketDue ? ` · ${d.heatmapDueLegend}` : '')
                    + (cell.projectStart ? ` · ${d.heatmapStartLegend}` : '');
                  const cellClass =
                    'relative rounded-[4px] shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] '
                    + LEVEL_CLASS[cell.level]
                    + (cell.isFuture ? ' opacity-40' : '')
                    + (!cell.inRange ? ' opacity-30' : '')
                    + (cell.isToday ? ' ring-2 ring-inset ring-ink' : '')
                    + (cell.projectStart ? ' ring-2 ring-inset ring-accent-leaf' : '');
                  const flag = cell.bucketDue && (
                    <span
                      className="absolute inset-0 grid place-items-center text-danger"
                      aria-hidden
                    >
                      <IconFlag size={11} strokeWidth={3} />
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
                        onClick={e => handleCellClick(cell.dateKey, e)}
                        className={
                          cellClass
                          + (popover?.dateKey === cell.dateKey ? ' ring-2 ring-inset ring-danger' : '')
                        }
                        style={{ height: CELL_PX, width: CELL_PX }}
                      >
                        {flag}
                      </button>
                    );
                  }

                  if (cell.amount >= 1) {
                    return (
                      <button
                        key={cell.dateKey}
                        type="button"
                        title={title}
                        aria-label={`${d.heatmapDaySavedLabel} · ${cell.dateKey}`}
                        aria-expanded={popover?.dateKey === cell.dateKey}
                        onClick={e => handleCellClick(cell.dateKey, e, cell.amount)}
                        className={
                          cellClass
                          + (popover?.dateKey === cell.dateKey ? ' ring-2 ring-inset ring-ink/60' : '')
                        }
                        style={{ height: CELL_PX, width: CELL_PX }}
                      />
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

          {canScrollRight && (
            <div
              aria-hidden
              className="pointer-events-none absolute -right-2 bottom-0 top-0 flex w-7 items-center justify-end bg-gradient-to-l from-surface via-surface/70 to-transparent pr-0.5"
            >
              <span className="grid h-5 w-4 place-items-center text-ink-muted">
                <IconChevronRight size={13} strokeWidth={2.5} />
              </span>
            </div>
          )}
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

      {/* Outside-tap dismiss layer. */}
      {popover && (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          className="fixed inset-0 z-10 cursor-default"
          onClick={() => setPopover(null)}
        />
      )}

      {/* Cell popover: tap a flag for bucket due info; tap a colored cell for daily savings. */}
      <AnimatePresence>
        {popover && (() => {
          const isFlagCell = popover.dayAmount === undefined;
          const items = isFlagCell ? (dueByDate.get(popover.dateKey) ?? []) : [];
          if (isFlagCell && items.length === 0) return null;
          const [py, pm, pd] = popover.dateKey.split('-').map(Number);
          const dateLabel = dueDateFmt.format(new Date(Date.UTC(py, pm - 1, pd)));
          const origin = popover.below ? 'top center' : 'bottom center';
          const transform = popover.below
            ? 'translate(-50%, 8px)'
            : 'translate(-50%, calc(-100% - 8px))';
          const popoverWidth = isFlagCell ? POPOVER_WIDTH : POPOVER_DAY_WIDTH;
          return (
            <motion.div
              key={popover.dateKey}
              className="absolute z-20"
              style={{
                left: popover.left,
                top: popover.top,
                width: popoverWidth,
                transform,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduceMotion ? REDUCED_MOTION_TRANSITION : FADE_TRANSITION}
            >
              <motion.div
                role="dialog"
                aria-label={isFlagCell
                  ? `${d.heatmapDueDetailTitle} · ${dateLabel}`
                  : `${d.heatmapDaySavedLabel} · ${dateLabel}`}
                className={`rounded-lg bg-surfaceAlt shadow-soft ring-1 ring-ink/10 ${isFlagCell ? 'p-2.5' : 'p-2'}`}
                style={{ transformOrigin: origin }}
                initial={reduceMotion ? false : { scale: 0.92, y: popover.below ? -4 : 4 }}
                animate={reduceMotion ? {} : { scale: 1, y: 0 }}
                exit={reduceMotion ? {} : { scale: 0.92, y: popover.below ? -4 : 4 }}
                transition={reduceMotion ? REDUCED_MOTION_TRANSITION : SPRING.content}
              >
                {isFlagCell ? (
                  <>
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
                            {d.heatmapCurrentBucketAmountLabel}: {formatMoney(item.currentAmount)} / {formatMoney(item.target)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <div className="font-mono text-[9px] text-ink-muted">{dateLabel}</div>
                    <div className="font-mono text-[12px] font-bold text-ink leading-tight mt-0.5">
                      {formatMoney(popover.dayAmount!)}
                    </div>
                    <div className="font-mono text-[9px] text-ink-dim">{d.heatmapDaySavedLabel}</div>
                  </>
                )}
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </section>
  );
}
