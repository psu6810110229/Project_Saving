import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { themeSwatches, type ThemeSwatch } from '../../lib/theme';
import { Avatar } from '../Avatar/Avatar';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { formatCurrency } from '../../lib/format';
import { useI18n } from '../../i18n/useI18n';
import { SPRING } from '../../lib/motion';

/**
 * One player's row inside the Progress Race card. Renders the
 * player's avatar with an optional crown icon badge on the top-left
 * when leading, their name, the saved-vs-target amount, and a
 * theme-tinted progress bar.
 *
 * Mobile-first: avatar + text stack stays single-row at 375px; the
 * progress bar takes the full remaining width.
 */

interface PlayerProgressRowProps {
  name: string;
  fallback: string;
  imageUrl?: string | null;
  saved: number;
  target: number;
  themeColor?: ThemeSwatch;
  isLeader?: boolean;
  gapLabel?: string;
  isYou?: boolean;
  trailing?: ReactNode;
  /**
   * When provided, the avatar + content stack becomes a native
   * `<button>` that calls `onClick`. The `trailing` slot renders
   * outside the button so that an interactive trailing control (e.g.
   * `NudgeButton`) is never nested inside another interactive
   * element. When omitted, the row is fully non-interactive — matches
   * the legacy behaviour used by `HeadToHeadCard` and previews.
   */
  onClick?: () => void;
  /** Accessible label for the row button when `onClick` is set. */
  clickAriaLabel?: string;
}

function CrownBadge() {
  return (
    <span
      aria-hidden
      className="absolute -top-1 -left-1 z-10 grid h-6 w-6 place-items-center rounded-full bg-brand-500 text-ink-inverse shadow-haloOrange"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 18h18l-2-10-4.5 4L12 6l-2.5 6L5 8 3 18Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function pctColor(pct: number): string {
  if (pct >= 100) return 'text-accent-leaf';
  if (pct >= 75)  return 'text-accent-gold';
  if (pct >= 25)  return 'text-brand-800';
  return 'text-ink-muted';
}

function ProgressLine({
  pct,
  themeColor,
}: {
  pct: number;
  themeColor?: ThemeSwatch;
}) {
  return (
    <div className="mt-2 flex min-w-0 items-center gap-2">
      <span className={`font-mono text-xs font-bold tabular-nums shrink-0 ${pctColor(pct)}`}>
        {Math.round(pct)}%
      </span>
      <div className="min-w-[72px] flex-1">
        <ProgressBar
          value={pct}
          tone={themeColor ? 'theme' : 'primary'}
          themeHex={themeColor ? themeSwatches[themeColor] : undefined}
          size="md"
          animate
        />
      </div>
    </div>
  );
}

function NameLine({
  displayName,
  gapLabel,
}: {
  displayName: string;
  gapLabel?: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="min-w-0 truncate font-mono text-base font-bold text-ink">
        {displayName}
      </span>
      {gapLabel && (
        <span className="max-w-[58%] shrink-0 truncate rounded-pill bg-brand-500 px-2 py-0.5 font-mono text-xs font-bold leading-tight text-ink-inverse">
          {gapLabel}
        </span>
      )}
    </div>
  );
}

export function PlayerProgressRow({
  name,
  fallback,
  imageUrl,
  saved,
  target,
  themeColor,
  isLeader = false,
  gapLabel,
  isYou = false,
  trailing,
  onClick,
  clickAriaLabel,
}: PlayerProgressRowProps) {
  const { copy } = useI18n();
  const reduceMotion = useReducedMotion();
  const pct = target > 0 ? (saved / target) * 100 : 0;

  const displayName = isYou ? `${copy.dashboard.youLabel} - ${name}` : name;

  const avatar = (
    <div className="relative shrink-0">
      {isLeader && <CrownBadge />}
      <Avatar
        size="xl"
        imageUrl={imageUrl}
        fallback={fallback}
        ring={isLeader ? 'leader' : themeColor ? 'theme' : 'none'}
        themeColor={themeColor}
      />
    </div>
  );

  const cardClasses = `flex items-center gap-3 rounded-xl bg-surface p-4 shadow-soft ${
    isYou ? 'border-2 border-brand-100' : ''
  }`;

  // Interactive variant. The avatar + content stack is wrapped in a
  // native `<button>` so navigation is a real button activation. The
  // `trailing` slot renders outside the button as a sibling — this
  // prevents an interactive control (e.g. `NudgeButton`) from being
  // nested inside another interactive element, which is invalid HTML
  // and bad for assistive tech.
  if (onClick) {
    return (
      <div className={cardClasses}>
        <motion.button
          type="button"
          onClick={onClick}
          aria-label={clickAriaLabel}
          className="flex flex-1 min-w-0 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          whileTap={reduceMotion ? { opacity: 0.85 } : { scale: 0.97, y: 2 }}
          transition={SPRING.press}
        >
          {avatar}
          <div className="flex-1 min-w-0">
            <NameLine displayName={displayName} gapLabel={gapLabel} />
            <div className="mt-1 flex items-baseline gap-2 font-mono">
              <span className="text-2xl font-bold text-brand-500">{formatCurrency(saved)}</span>
              <span className="text-xs text-ink-muted shrink-0">/ {formatCurrency(target)}</span>
            </div>
            <ProgressLine pct={pct} themeColor={themeColor} />
          </div>
        </motion.button>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>
    );
  }

  return (
    <div className={cardClasses}>
      {avatar}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <NameLine displayName={displayName} gapLabel={gapLabel} />
          {trailing && <div className="shrink-0">{trailing}</div>}
        </div>
        <div className="mt-1 flex items-baseline gap-2 font-mono">
          <span className="text-2xl font-bold text-brand-500">{formatCurrency(saved)}</span>
          <span className="text-xs text-ink-muted shrink-0">/ {formatCurrency(target)}</span>
        </div>
        <ProgressLine pct={pct} themeColor={themeColor} />
      </div>
    </div>
  );
}
