import type { ReactNode } from 'react';
import { themeSwatches, type ThemeSwatch } from '../../lib/theme';
import { Avatar } from '../Avatar/Avatar';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { formatCurrency } from '../../lib/format';
import { useI18n } from '../../i18n/useI18n';

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
}: PlayerProgressRowProps) {
  const { copy } = useI18n();
  const pct = target > 0 ? (saved / target) * 100 : 0;
  return (
    <div
      className={`flex items-center gap-3 rounded-xl bg-surface p-4 shadow-soft ${
        isYou ? 'border-2 border-brand-100' : ''
      }`}
    >
      <div className="relative shrink-0">
        {isLeader && <CrownBadge />}
        <Avatar
          size="lg"
          imageUrl={imageUrl}
          fallback={fallback}
          ring={isLeader ? 'leader' : themeColor ? 'theme' : 'none'}
          themeColor={themeColor}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-base font-bold text-ink truncate">
            {isYou ? `${copy.dashboard.youLabel} - ${name}` : name}
          </span>
          {trailing && <div className="shrink-0">{trailing}</div>}
        </div>
        <div className="mt-1 flex items-baseline gap-2 font-mono">
          <span className="text-lg font-bold text-brand-500">{formatCurrency(saved)}</span>
          <span className="text-xs text-ink-muted shrink-0">/ {formatCurrency(target)}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className={`font-mono text-xs font-bold tabular-nums shrink-0 ${pctColor(pct)}`}>
            {Math.round(pct)}%
          </span>
          <div className="flex-1">
            <ProgressBar
              value={pct}
              tone={themeColor ? 'theme' : 'primary'}
              themeHex={themeColor ? themeSwatches[themeColor] : undefined}
              size="md"
              animate
            />
          </div>
        </div>
        {gapLabel && (
          <p className="mt-2 font-mono text-xs text-ink-muted">{gapLabel}</p>
        )}
      </div>
    </div>
  );
}
