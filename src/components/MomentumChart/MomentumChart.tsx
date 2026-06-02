import { memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { formatShortDateKey } from '../../i18n/formatters';
import { palette } from '../../lib/theme';
import { useI18n } from '../../i18n/useI18n';
import { formatCurrency } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { FADE_TRANSITION, REDUCED_MOTION_TRANSITION, SPRING } from '../../lib/motion';
import type { BucketCategory, ProfileTheme } from '../../types';
import { themeSwatches } from '../../lib/theme';
import { Avatar } from '../Avatar/Avatar';
import { BucketCategoryIcon } from '../BucketCategoryIcon/BucketCategoryIcon';

/**
 * Dashboard 7-day deposit trend chart. SVG bar chart with one bar per
 * day; when a partner series is provided the chart renders two side-by-
 * side bars per day (partner on the left, you on the right) under an
 * overlay trend line that traces the "you" bar tops.
 *
 * The visual treatment is ported from the Savings Performance reference
 * (`docs/design-references/graph-redesign/reference-chart-only.html`):
 * rounded-pill bar tops with a vertical gradient, a brand-orange trend
 * line with white-fill datapoints, and a "today" marker on the most
 * recent bar, set on a white card with a soft pale-navy border. Data
 * logic, props, calculations, and i18n keys are preserved from the
 * previous implementation; the `expectedSeries` and `weekExpected`
 * props remain on the API but are not rendered in this style (the
 * reference visual has no expected-plan overlay).
 */

interface MomentumChartProps {
  series: number[];
  partnerSeries?: number[];
  labels?: string[];
  dateKeys?: string[];
  barMarkers?: MomentumBarMarker[];
  partnerBarMarkers?: MomentumBarMarker[];
  yourName?: string;
  partnerName?: string;
  /** Short legend/tooltip label for the primary series. Overrides the
   *  default "You" copy so Dashboard can render `Room` or `Me` for the
   *  active Daily Deposit Trend mode. Mobile-safe legend uses this
   *  bounded short label rather than full member names. */
  primaryLabel?: string;
  primaryThemeColor?: ProfileTheme;
  primaryAvatarUrl?: string | null;
  primaryAvatarFallback?: string;
  /** Short legend/tooltip label for the secondary series. Used in
   *  Compare mode for the one selected member. When omitted the chart
   *  falls back to `partnerName`. */
  secondaryLabel?: string;
  secondaryThemeColor?: ProfileTheme;
  secondaryAvatarUrl?: string | null;
  secondaryAvatarFallback?: string;
  /** Caller-controlled header total. Overrides the legacy
   *  weekTotal-based sum so each mode (`Room` / `Me` / `Compare`) can
   *  drive its own visible total. */
  displayedTotal?: number;
  /** Optional purpose chip picker rendered between the title/amount
   *  block and the member mode control. */
  purposePicker?: ReactNode;
  /** Optional mode segmented control rendered inside the chart card,
   *  between the title/amount block and the legend. Dashboard passes
   *  the custom `Room | Me | Compare` control here. */
  modeControl?: ReactNode;
  /** Optional compare-member avatar chip row rendered between the mode
   *  control and the legend. Only mounted while Compare is active. */
  compareChips?: ReactNode;
  /** Message rendered inside the plot when the selected bucket/category
   *  has no recorded deposits in the visible 7-day window. */
  emptyStateMessage?: string;
  expectedSeries?: number[];
  todayIndex?: number;
  weekTotal?: number;
  weekExpected?: number;
}

export interface MomentumBarMarker {
  categories: BucketCategory[];
  bucketNames?: string[];
  hasAdjustment?: boolean;
  hasNegativeAdjustment?: boolean;
  adjustmentAmount?: number;
}

/** Local colour overrides — match the reference chart only.
 *  Other charts continue to use `chartIdentityColors` from
 *  `lib/chartIdentity` so their visual identity is unchanged. */
const COLOR_YOU = palette.brand500;
const COLOR_PARTNER = '#4F6382';
const COLOR_ADJUSTMENT = '#B86A16';
const W = 280;
const H = 188;
// 28px left gutter fits 4-char y-axis labels like "5.7k" without
// clipping when Room mode pushes the y-axis max into the decimal-k
// range. Older 22px gutter only fitted 2-3 char labels.
const PAD_LEFT = 28;
const PAD_RIGHT = 4;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;
const POPOVER_CHART_MARGIN = 8;

/** Mono stack mirroring `tailwind.config.js > fontFamily.mono`, so Thai
 *  glyphs in SVG `<text>` fall through to IBM Plex Sans Thai instead of
 *  the system monospace fallback (which lacks Thai coverage). */
const SVG_MONO = '"IBM Plex Mono", "IBM Plex Sans Thai", ui-monospace, SFMono-Regular, monospace';

/** Tween two numeric series toward target values whenever the targets
 *  change. Each call to `setTargets` starts a fresh ~350ms ease-out
 *  animation from the *currently displayed* values, so a mode switch
 *  visibly morphs bar heights instead of snapping. Partner series is
 *  optional and padded with zeros when it appears/disappears across
 *  modes, so bars grow/collapse smoothly. */
function useAnimatedSeries(
  target: number[],
  targetPartner: number[] | undefined,
  duration = 350,
  reduceMotion = false,
): { series: number[]; partner: number[] | undefined } {
  const [state, setState] = useState(() => ({
    series: target.slice(),
    partner: targetPartner ? targetPartner.slice() : undefined,
  }));
  const fromRef = useRef<{ series: number[]; partner: number[] | undefined }>(state);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef({ series: target, partner: targetPartner });

  useEffect(() => {
    const prev = targetRef.current;
    const sameSeries = prev.series.length === target.length
      && prev.series.every((v, i) => v === target[i]);
    const samePartner = (!prev.partner && !targetPartner)
      || (!!prev.partner && !!targetPartner
        && prev.partner.length === targetPartner.length
        && prev.partner.every((v, i) => v === targetPartner[i]));
    if (sameSeries && samePartner && !reduceMotion) return;
    targetRef.current = { series: target, partner: targetPartner };

    if (reduceMotion) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      const nextState = {
        series: target.slice(),
        partner: targetPartner ? targetPartner.slice() : undefined,
      };
      fromRef.current = nextState;
      const timeoutId = window.setTimeout(() => setState(nextState), 0);
      return () => window.clearTimeout(timeoutId);
    }

    const len = target.length;
    const pad = (arr: number[] | undefined): number[] =>
      Array.from({ length: len }, (_, i) => arr?.[i] ?? 0);
    const fromS = pad(fromRef.current.series);
    const fromP = pad(fromRef.current.partner);
    const toS = pad(target);
    const toP = pad(targetPartner);
    const hasPartnerNow = !!targetPartner;

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const s = toS.map((to, i) => fromS[i] + (to - fromS[i]) * e);
      const p = hasPartnerNow
        ? toP.map((to, i) => fromP[i] + (to - fromP[i]) * e)
        : undefined;
      fromRef.current = { series: s, partner: p };
      setState({ series: s, partner: p });
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, targetPartner, duration, reduceMotion]);

  return state;
}

function fmtShort(v: number): string {
  if (v >= 10000) return `${Math.round(v / 1000)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(v));
}

/** Catmull-Rom-to-cubic-Bezier smoother. Produces a soft curve that
 *  passes through every point with a configurable tension (lower =
 *  tighter to the points, higher = looser). */
function smoothPath(points: { x: number; y: number }[], tension = 0.85): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
  }
  let path = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + ((p2.x - p0.x) * tension) / 6;
    const cp1y = p1.y + ((p2.y - p0.y) * tension) / 6;
    const cp2x = p2.x - ((p3.x - p1.x) * tension) / 6;
    const cp2y = p2.y - ((p3.y - p1.y) * tension) / 6;
    path += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return path;
}

function roundedTopBar(x: number, y: number, w: number, h: number, r: number): string {
  const actualH = Math.max(h, 0);
  if (actualH === 0) return '';
  const actualR = Math.min(r, w / 2, actualH);
  return [
    `M ${x},${y + actualH}`,
    `L ${x},${y + actualR}`,
    `A ${actualR},${actualR} 0 0,1 ${x + actualR},${y}`,
    `L ${x + w - actualR},${y}`,
    `A ${actualR},${actualR} 0 0,1 ${x + w},${y + actualR}`,
    `L ${x + w},${y + actualH}`,
    'Z',
  ].join(' ');
}

function chartValue(value: number | undefined, marker?: MomentumBarMarker): number {
  void marker;
  return Math.max(0, value ?? 0);
}

function formatDateKeyLabel(
  dateKey: string | undefined,
  language: 'th' | 'en',
  fallback: string,
): string {
  if (!dateKey) return fallback;
  const shortLabel = formatShortDateKey(dateKey, language);
  if (shortLabel === dateKey) return fallback;
  const [year] = dateKey.split('-').map(Number);
  if (!year) return shortLabel;
  if (language === 'th') return `${shortLabel} ${String(year + 543).slice(-2)}`;
  return `${shortLabel} ${String(year).slice(-2)}`;
}

export const MomentumChart = memo(function MomentumChart({
  series,
  partnerSeries,
  labels,
  dateKeys,
  barMarkers,
  partnerBarMarkers,
  yourName,
  partnerName,
  primaryLabel,
  primaryThemeColor,
  primaryAvatarUrl,
  primaryAvatarFallback,
  secondaryLabel,
  secondaryThemeColor,
  secondaryAvatarUrl,
  secondaryAvatarFallback,
  displayedTotal,
  purposePicker,
  modeControl,
  compareChips,
  emptyStateMessage,
  expectedSeries,
  todayIndex,
  weekTotal,
  weekExpected,
}: MomentumChartProps) {
  const { copy, language } = useI18n();
  const reduceMotion = useReducedMotion();
  const d = copy.dashboard;
  const catLabels = copy.bucket.categoryLabels;
  // Primary/secondary labels in the legend prefer the caller-controlled
  // short label (`Room` / `Me` / selected member short). They fall back
  // to the legacy "You" / partnerName copy so 2-user code paths keep
  // their current legend text.
  const resolvedYourName = primaryLabel ?? d.youLabel;
  const resolvedPartnerName = secondaryLabel ?? partnerName ?? d.partnerLabel;
  const primaryColor = primaryThemeColor ? themeSwatches[primaryThemeColor] : COLOR_YOU;
  const secondaryColor = secondaryThemeColor ? themeSwatches[secondaryThemeColor] : COLOR_PARTNER;
  const hasPartner = Array.isArray(partnerSeries) && partnerSeries.length === series.length;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [popoverOffsetX, setPopoverOffsetX] = useState(0);
  const chartRootRef = useRef<HTMLDivElement | null>(null);
  const popoverCardRef = useRef<HTMLDivElement | null>(null);

  // Retain the last non-null compare chips while collapsing so the
  // grid-template-rows transition has real content to shrink from
  // instead of unmounting in the same frame (which would resolve `1fr`
  // to 0 immediately and skip the animation in the compare→room/me
  // direction).
  const [lingeringChips, setLingeringChips] = useState<ReactNode>(compareChips);
  useEffect(() => {
    if (compareChips) {
      const t = window.setTimeout(() => setLingeringChips(compareChips), 0);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setLingeringChips(null), 620);
    return () => window.clearTimeout(t);
  }, [compareChips]);

  useEffect(() => {
    if (selectedIndex === null) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        setSelectedIndex(null);
        return;
      }
      if (chartRootRef.current?.contains(target)) return;
      setSelectedIndex(null);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [selectedIndex]);

  // Tween bar values whenever the mode (or underlying data) changes so
  // bars visibly morph between Room / Me / Compare instead of snapping.
  // Header totals and legend amounts stay snapped to the target values.
  const animated = useAnimatedSeries(series, hasPartner ? partnerSeries : undefined, 750, reduceMotion ?? false);
  const animSeries = animated.series;
  const animPartner = animated.partner;

  // Props preserved on the API for compatibility with existing
  // Dashboard / DashboardHero call sites; the reference visual does not
  // surface these.
  void yourName;
  void expectedSeries;
  void weekExpected;

  // Drive the y-axis from the *animated* values so the axis labels,
  // grid lines, and trend line scale in sync with the bar tween instead
  // of snapping to the new mode's max.
  const rawMax = Math.max(
    1,
    ...animSeries.map((value, index) => chartValue(value, barMarkers?.[index])),
    ...(animPartner ?? []).map((value, index) => chartValue(value, partnerBarMarkers?.[index])),
  );
  // Cap the y-axis at 1.25× the tallest bar so the chart hugs the data
  // and bars use more vertical space than a wide-rounded niceMax would.
  const max = rawMax * 1.25;

  const barCount = series.length;
  // Wider gap in single-bar modes (Room / Me) so bars don't read as a
  // continuous block; Compare mode keeps the tighter gap because each
  // group is already a visually separated pair.
  const groupGap = hasPartner ? 2 : 8;
  const innerGap = hasPartner ? 1 : 0;
  const chartW = W - PAD_LEFT - PAD_RIGHT;
  const groupW = (chartW - groupGap * Math.max(barCount - 1, 0)) / Math.max(barCount, 1);
  const barW = hasPartner ? (groupW - innerGap) / 2.8 : groupW;
  const chartH = H - PAD_TOP - PAD_BOTTOM;
  const baselineY = PAD_TOP + chartH;
  const groupStride = groupW + groupGap;
  const pairW = hasPartner ? barW * 2 + innerGap : barW;

  const barLayoutAt = (index: number) => {
    const groupX = PAD_LEFT + index * groupStride;
    const pairX = groupX + (groupW - pairW) / 2;
    const partnerBarX = hasPartner ? pairX : null;
    const yourBarX = hasPartner ? pairX + barW + innerGap : pairX;
    return { groupX, partnerBarX, yourBarX };
  };

  useLayoutEffect(() => {
    if (selectedIndex === null) return;
    const index = selectedIndex;

    function updatePopoverOffset() {
      const root = chartRootRef.current;
      const popoverCard = popoverCardRef.current;
      if (!root || !popoverCard) return;

      const groupX = PAD_LEFT + index * groupStride;
      const anchorPx = (groupX + groupW / 2) / W * root.clientWidth;
      const halfWidth = popoverCard.offsetWidth / 2 + POPOVER_CHART_MARGIN;
      const clampedCenter = Math.min(Math.max(anchorPx, halfWidth), root.clientWidth - halfWidth);
      const nextOffset = clampedCenter - anchorPx;
      setPopoverOffsetX(prev => (Math.abs(prev - nextOffset) < 0.5 ? prev : nextOffset));
    }

    updatePopoverOffset();
    window.addEventListener('resize', updatePopoverOffset);
    return () => window.removeEventListener('resize', updatePopoverOffset);
  }, [groupStride, groupW, selectedIndex]);

  const yourTotal = series.reduce((s, v) => s + v, 0);
  const partnerTotal = hasPartner ? partnerSeries!.reduce((s, v) => s + v, 0) : 0;
  // Header total: prefer the caller-controlled `displayedTotal` so each
  // Daily Deposit Trend mode can drive its own visible total
  // (`Room` = room total, `Me` = personal, `Compare` = visible pair).
  // Fall back to the legacy weekTotal + partner sum when the prop is
  // omitted so older call sites keep their previous behaviour.
  const headerTotal = typeof displayedTotal === 'number'
    ? displayedTotal
    : typeof weekTotal === 'number'
      ? weekTotal + (hasPartner ? partnerTotal : 0)
      : yourTotal + partnerTotal;
  const showEmptyState = !!emptyStateMessage && headerTotal <= 0;

  // Overlay polyline coordinates — through the top-centre of every
  // "you" bar so the trend line traces the primary series. Uses the
  // animated heights so any overlay would track the tween.
  const linePoints = animSeries.map((v, i) => {
    const { yourBarX } = barLayoutAt(i);
    const yourX = yourBarX + barW / 2;
    const yourH = (chartValue(v, barMarkers?.[i]) / max) * chartH;
    const yourY = baselineY - yourH;
    return { x: yourX, y: yourY };
  });
  const trendCurveD = smoothPath(linePoints);

  const gridFractions = [0.25, 0.5, 0.75, 1];

  return (
    <section className="relative isolate overflow-visible rounded-[2rem] bg-surface px-4 pt-4 pb-4 text-ink shadow-soft">
      {/* Header — fully stacked on mobile so the legend never overlaps
          the title/amount block. Order: title → amount + last7Days →
          mode control → compare avatar chips → compact legend → chart.
          Long member names are not allowed inline; the legend uses the
          short caller-controlled labels (`Room` / `Me` / short member). */}
      <div className="relative z-20 mb-3 flex min-w-0 flex-col gap-3">
        <div className="min-w-0">
          <h2 className="mb-2 font-mono text-lg font-bold leading-tight text-ink">
            {d.dailyDepositTrend}
          </h2>
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-2xl font-bold leading-none text-ink">
              {formatCurrency(headerTotal)}
            </span>
            <span className="font-mono text-[12px] text-ink-muted/80">
              {d.last7Days}
            </span>
          </div>
        </div>

        {purposePicker}

        {modeControl && (
          <div className="flex min-w-0 flex-wrap items-start gap-1.5">
            <div className="min-w-0 shrink-0">{modeControl}</div>
            <div
              className={`min-w-0 transition-[max-width,opacity] duration-[520ms] ease-[cubic-bezier(0.16,1,0.2,1)] ${compareChips ? 'overflow-visible' : 'overflow-hidden'}`}
              style={{
                maxWidth: compareChips ? '20rem' : '0px',
                opacity: compareChips ? 1 : 0,
                pointerEvents: compareChips ? undefined : 'none',
              }}
              aria-hidden={!compareChips}
            >
              {lingeringChips}
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-row flex-wrap gap-x-4 gap-y-1">
            <LegendChip
            color={primaryColor}
            avatarUrl={primaryAvatarUrl}
            avatarFallback={primaryAvatarFallback}
            avatarThemeColor={primaryThemeColor}
            glow={`${primaryColor}66`}
            name={resolvedYourName}
            total={yourTotal}
          />
          <div
            className="min-w-0 overflow-hidden transition-[max-width,opacity] duration-300 ease-out"
            style={{
              maxWidth: hasPartner ? '14rem' : '0px',
              opacity: hasPartner ? 1 : 0,
            }}
            aria-hidden={!hasPartner}
          >
            <LegendChip
              color={secondaryColor}
              avatarUrl={secondaryAvatarUrl}
              avatarFallback={secondaryAvatarFallback}
              avatarThemeColor={secondaryThemeColor}
              glow={`${secondaryColor}66`}
              name={resolvedPartnerName}
              total={animPartner ? animPartner.reduce((s, v) => s + v, 0) : partnerTotal}
            />
          </div>
        </div>
      </div>

      {/* Chart */}
      <div
        ref={chartRootRef}
        className={`relative mt-0 h-[200px] w-full overflow-visible ${selectedIndex !== null ? 'z-[60]' : 'z-0'}`}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          role="img"
          aria-label={d.chartAriaLabel}
        >
        <title>{d.chartTitle(false)}</title>

        {/* Horizontal grid */}
        {gridFractions.map(t => {
          const y = baselineY - t * chartH;
          return (
            <line
              key={t}
              x1={PAD_LEFT}
              x2={W - PAD_RIGHT}
              y1={y}
              y2={y}
              stroke="rgba(200,210,225,0.55)"
              strokeWidth={0.5}
            />
          );
        })}
        {/* Baseline */}
        <line
          x1={PAD_LEFT}
          x2={W - PAD_RIGHT}
          y1={baselineY}
          y2={baselineY}
          stroke="rgba(160,176,200,0.7)"
          strokeWidth={0.6}
        />

        {/* Y-axis labels — 0 / mid / max */}
        {[0, max / 2, max].map((tick, i) => {
          const y = baselineY - (tick / max) * chartH;
          return (
            <text
              key={`y-${i}`}
              x={PAD_LEFT - 0}
              y={y + 4.5}
              textAnchor="end"
              fontSize="10"
              fontWeight="300"
              fontFamily={SVG_MONO}
              fill={palette.ink}
            >
              {fmtShort(tick)}
            </text>
          );
        })}

        {/* Bar groups — bar heights are tweened via `animSeries` /
            `animPartner` so a mode switch (Room / Me / Compare) morphs
            the bars instead of snapping. Value labels keep showing the
            real target numbers so the displayed text doesn't flicker
            mid-tween. */}
        {series.map((v, i) => {
          const { groupX, partnerBarX, yourBarX } = barLayoutAt(i);
          const partnerVal = hasPartner ? partnerSeries![i] : 0;
          const animV = animSeries[i] ?? 0;
          const animPartnerVal = animPartner?.[i] ?? 0;
          const visualV = chartValue(animV, barMarkers?.[i]);
          const visualPartnerVal = chartValue(animPartnerVal, partnerBarMarkers?.[i]);
          const yourBarColor = primaryColor;
          const partnerBarColor = secondaryColor;
          const yourH = (visualV / max) * chartH;
          const yourY = baselineY - yourH;
          const partnerH = (visualPartnerVal / max) * chartH;
          const partnerY = baselineY - partnerH;
          const yourCenterX = yourBarX + barW / 2;
          const partnerCenterX = partnerBarX !== null ? partnerBarX + barW / 2 : 0;
          const dimmed = selectedIndex !== null && selectedIndex !== i;
          const barOpacity = dimmed ? 0.4 : 1;

          return (
            <g key={i}>
              {/* Partner bar — left of the pair */}
              {hasPartner && visualPartnerVal > 0 && (
                <g>
                  <path
                    d={roundedTopBar(partnerBarX!, partnerY, barW, Math.max(partnerH, 2), barW / 2)}
                    fill={partnerBarColor}
                    opacity={barOpacity}
                    style={{ cursor: 'pointer' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setSelectedIndex(prev => (prev === i ? null : i));
                      haptic('success');
                    }}
                  />
                </g>
              )}
              {hasPartner && partnerVal > 0 && (
                <text
                  x={partnerCenterX}
                  y={partnerY - 8}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="200"
                  fontFamily={SVG_MONO}
                  fill={secondaryColor}
                  opacity={barOpacity}
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedIndex(prev => (prev === i ? null : i));
                    haptic('success');
                  }}
                >
                  {fmtShort(partnerVal)}
                </text>
              )}

              {/* You bar — right of the pair, or the only bar */}
              {visualV > 0 && (
                <g>
                  <path
                    d={roundedTopBar(yourBarX, yourY, barW, Math.max(yourH, 2), barW / 2)}
                    fill={yourBarColor}
                    opacity={barOpacity}
                    style={{ cursor: 'pointer' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setSelectedIndex(prev => (prev === i ? null : i));
                      haptic('success');
                    }}
                  />
                </g>
              )}
              {v > 0 && (
                <text
                  x={yourCenterX}
                  y={yourY - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="500"
                  fontFamily={SVG_MONO}
                  fill={primaryColor}
                  opacity={barOpacity}
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedIndex(prev => (prev === i ? null : i));
                    haptic('success');
                  }}
                >
                  {fmtShort(v)}
                </text>
              )}

              {hasPartner && (
                <BarIconCluster
                  marker={partnerBarMarkers?.[i]}
                  centerX={partnerCenterX}
                  y={partnerY}
                  h={partnerH}
                  barW={barW}
                  baselineY={baselineY}
                  categoryLabels={catLabels}
                  opacity={barOpacity}
                />
              )}
              <BarIconCluster
                marker={barMarkers?.[i]}
                centerX={yourCenterX}
                y={yourY}
                h={yourH}
                barW={barW}
                baselineY={baselineY}
                categoryLabels={catLabels}
                opacity={barOpacity}
              />
              <AdjustmentBadge
                marker={barMarkers?.[i]}
                centerX={yourCenterX}
                y={yourY}
                h={yourH}
                baselineY={baselineY}
                opacity={barOpacity}
              />

              {/* X-axis label */}
              {labels?.[i] && (
                <text
                  x={groupX + groupW / 2}
                  y={H - 3}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight={todayIndex === i ? '1000' : '400'}
                  fontFamily={SVG_MONO}
                  fill={todayIndex === i ? primaryColor : palette.ink}
                >
                  {labels[i]}
                </text>
              )}

            </g>
          );
        })}

        {/* Overlay trend line — a soft curve through every "you" bar top */}
        {showEmptyState && (
          <foreignObject
            x={PAD_LEFT + 6}
            y={PAD_TOP + chartH * 0.36}
            width={W - PAD_LEFT - PAD_RIGHT - 12}
            height={48}
            style={{ pointerEvents: 'none' }}
          >
            <div className="flex h-full items-center justify-center rounded-lg bg-white/80 px-2 text-center font-mono text-[10px] font-bold leading-tight text-ink-muted">
              {emptyStateMessage}
            </div>
          </foreignObject>
        )}

        <path
          d={trendCurveD}
          fill="none"
          stroke={primaryColor}
          strokeWidth={0.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0}
          style={{ pointerEvents: 'none' }}
        />
        {linePoints.map((p, i) => (
          <circle
            key={`pt-${i}`}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill="#FFFFFF"
            stroke={primaryColor}
            strokeWidth={0.5}
            opacity={0}
            style={{ pointerEvents: 'none' }}
          />
        ))}

        {/* Today marker — slightly larger white pill on today's "you" bar */}
        {typeof todayIndex === 'number'
          && todayIndex >= 0
          && todayIndex < linePoints.length
          && (
            <circle
              cx={linePoints[todayIndex].x}
              cy={linePoints[todayIndex].y}
              r={3.2}
              fill="#FFFFFF"
              stroke={primaryColor}
              strokeWidth={1.5}
              style={{ pointerEvents: 'none' }}
            />
          )}

        </svg>
        <AnimatePresence>
          {selectedIndex !== null && (() => {
            const i = selectedIndex;
            const v = series[i];
            const partnerVal = hasPartner ? partnerSeries![i] : 0;
            const marker = barMarkers?.[i];
            const partnerMarker = partnerBarMarkers?.[i];
            const { groupX } = barLayoutAt(i);
            const anchorX = groupX + groupW / 2;
            const yourH = (chartValue(v, marker) / max) * chartH;
            const yourY = baselineY - yourH;
            const partnerH = (chartValue(partnerVal, partnerMarker) / max) * chartH;
            const partnerY = baselineY - partnerH;
            const topBarY = hasPartner ? Math.min(yourY, partnerY) : yourY;
            const yourCategoryText = markerCategoryText(marker, catLabels);
            const partnerCategoryText = markerCategoryText(partnerMarker, catLabels);
            const fullDateLabel = formatDateKeyLabel(
              dateKeys?.[i],
              language,
              labels?.[i] ?? d.last7Days,
            );

            return (
              <motion.div
                key={`momentum-popover-${i}`}
                className="pointer-events-none absolute z-[90]"
                style={{
                  left: `${(anchorX / W) * 100}%`,
                  top: `${(topBarY / H) * 100}%`,
                  transform: `translate(calc(-50% + ${popoverOffsetX}px), calc(-100% - 10px))`,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={reduceMotion ? REDUCED_MOTION_TRANSITION : FADE_TRANSITION}
              >
                <motion.div
                  ref={popoverCardRef}
                  className="relative min-w-[11.5rem] max-w-[16rem] rounded-[1rem] bg-surfaceAlt p-3 shadow-soft ring-1 ring-ink/10"
                  style={{ transformOrigin: 'bottom center' }}
                  initial={reduceMotion ? false : { scale: 0.92, y: 4 }}
                  animate={reduceMotion ? {} : { scale: 1, y: 0 }}
                  exit={reduceMotion ? {} : { scale: 0.92, y: 4 }}
                  transition={reduceMotion ? REDUCED_MOTION_TRANSITION : SPRING.content}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[10px] font-bold text-ink-muted">
                        {fullDateLabel}
                      </span>
                    </div>

                    <div className="rounded-[0.9rem] bg-white/70 px-2.5 py-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate font-mono text-[10px] font-semibold text-ink-muted">
                          {resolvedYourName}
                        </span>
                        <span className="shrink-0 font-mono text-sm font-bold text-ink">
                          <span style={{ color: primaryColor }}>{formatCurrency(v)}</span>
                        </span>
                      </div>
                      {yourCategoryText && (
                        <div className="mt-1 text-[10px] leading-[1.45] text-ink-muted">
                          <span className="font-mono font-semibold text-ink-dim">{language === 'th' ? 'หมวด' : 'Category'}</span>{' '}
                          <span>{yourCategoryText}</span>
                        </div>
                      )}
                    </div>

                    {hasPartner && (
                      <div className="rounded-[0.9rem] bg-[#F8FAFC]/90 px-2.5 py-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate font-mono text-[10px] font-semibold text-ink-muted">
                            {resolvedPartnerName}
                          </span>
                          <span className="shrink-0 font-mono text-sm font-bold text-ink">
                          <span style={{ color: secondaryColor }}>{formatCurrency(partnerVal)}</span>
                          </span>
                        </div>
                        {partnerCategoryText && (
                          <div className="mt-1 text-[10px] leading-[1.45] text-ink-muted">
                            <span className="font-mono font-semibold text-ink-dim">{language === 'th' ? 'หมวด' : 'Category'}</span>{' '}
                            <span>{partnerCategoryText}</span>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                  <div
                    className="absolute top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-surfaceAlt ring-1 ring-ink/10"
                    style={{ left: `calc(50% - ${popoverOffsetX}px)` }}
                  />
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>
    </section>
  );
});

function markerCategoryText(
  marker: MomentumBarMarker | undefined,
  categoryLabels: Record<BucketCategory, string>,
): string | null {
  if (!marker || marker.categories.length === 0) return null;
  return marker.categories.map(cat => categoryLabels[cat]).join(', ');
}

interface AdjustmentBadgeProps {
  marker: MomentumBarMarker | undefined;
  centerX: number;
  y: number;
  h: number;
  baselineY: number;
  opacity: number;
}

function AdjustmentBadge({ marker, centerX, y, h, baselineY, opacity }: AdjustmentBadgeProps) {
  if (!marker?.hasNegativeAdjustment) return null;
  const cy = h > 0 ? Math.max(PAD_TOP + 7, y - 8) : baselineY - 10;

  return (
    <g opacity={opacity} style={{ pointerEvents: 'none' }}>
      <circle
        cx={centerX}
        cy={cy}
        r={6}
        fill="#FFF6E8"
        stroke={COLOR_ADJUSTMENT}
        strokeWidth={1.25}
      />
      <text
        x={centerX}
        y={cy + 3.2}
        textAnchor="middle"
        fontSize="9"
        fontWeight="900"
        fontFamily={SVG_MONO}
        fill={COLOR_ADJUSTMENT}
      >
        !
      </text>
    </g>
  );
}

interface BarIconClusterProps {
  marker: MomentumBarMarker | undefined;
  centerX: number;
  y: number;
  h: number;
  barW: number;
  baselineY: number;
  categoryLabels: Record<BucketCategory, string>;
  opacity: number;
}

function BarIconCluster({
  marker,
  centerX,
  y,
  h,
  barW,
  baselineY,
  categoryLabels,
  opacity,
}: BarIconClusterProps) {
  if (!marker || marker.categories.length === 0 || h <= 0) return null;

  const visible = marker.categories.slice(0, 2);
  const extra = marker.categories.length - visible.length;
  const iconSize = 13;
  const iconBox = 14;
  const chipGap = 2;
  const extraH = extra > 0 ? 10 : 0;
  const clusterW = Math.min(
    Math.max(barW + 8, extra > 0 ? 20 : iconBox),
    34,
  );
  const clusterH = visible.length * iconBox + Math.max(0, visible.length - 1) * chipGap + extraH;
  const insideBar = h >= clusterH + 12;
  const topY = insideBar
    ? Math.min(baselineY - clusterH - 2, y + 6)
    : Math.max(PAD_TOP + 1, y - clusterH - 2);
  const label = marker.categories.map(cat => categoryLabels[cat]).join(', ');

  return (
    <foreignObject
      x={centerX - clusterW / 2}
      y={topY}
      width={clusterW}
      height={clusterH}
      opacity={opacity}
      style={{ pointerEvents: 'none' }}
    >
      <div
        title={label}
        className="flex h-full items-center justify-center text-white"
      >
        <div className="inline-flex flex-col items-center justify-center gap-0.5">
          {visible.map(cat => (
            <span
              key={cat}
              className="grid place-items-center"
              style={{
                width: iconBox,
                height: iconBox,
              }}
            >
              <BucketCategoryIcon category={cat} size={iconSize} />
            </span>
          ))}
          {extra > 0 && (
            <span
              className="grid h-[10px] min-w-[18px] place-items-center px-0.5 font-mono text-[7px] font-bold leading-none text-white"
            >
              +{extra}
            </span>
          )}
        </div>
      </div>
    </foreignObject>
  );
}

interface LegendChipProps {
  color: string;
  glow: string;
  name: string;
  total: number;
  avatarUrl?: string | null;
  avatarFallback?: string;
  avatarThemeColor?: ProfileTheme;
}

/** Compact one-line legend chip used in the Daily Deposit Trend header.
 *  Mobile-safe: the name truncates with an ellipsis inside a bounded
 *  max width so long English / Thai member labels never wrap or push
 *  the amount off the card. */
function LegendChip({ color, glow, name, total, avatarUrl, avatarFallback, avatarThemeColor }: LegendChipProps) {
  return (
    <div className="inline-flex min-w-0 max-w-full items-center gap-2 font-mono text-[12px] text-ink-muted">
      {avatarUrl || avatarFallback ? (
        <span className="relative inline-flex shrink-0 items-center justify-center">
          <Avatar
            size="sm"
            imageUrl={avatarUrl ?? undefined}
            fallback={avatarFallback ?? '?'}
            themeColor={avatarThemeColor}
            className="[&>div]:!h-5 [&>div]:!w-5"
          />
          <span
            aria-hidden
            className="absolute -right-0.5 -bottom-0.5 inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white"
            style={{ backgroundColor: color, boxShadow: `0 0 8px ${glow}` }}
          />
        </span>
      ) : (
        <span
          aria-hidden
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${glow}` }}
        />
      )}
      <span
        className="max-w-[6rem] truncate whitespace-nowrap sm:max-w-[10rem]"
        title={name}
      >
        {name}
      </span>
      <span className="shrink-0 whitespace-nowrap font-bold" style={{ color }}>
        {formatCurrency(total)}
      </span>
    </div>
  );
}
