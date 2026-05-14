import { themeSwatches, type ThemeSwatch } from '../../lib/theme';
import { Avatar } from '../Avatar/Avatar';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { formatCurrency } from '../../lib/format';

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
}: PlayerProgressRowProps) {
  const pct = target > 0 ? (saved / target) * 100 : 0;
  return (
    <div className={`flex items-center gap-4 rounded-2xl px-2 py-2 ${isYou ? 'bg-brand-50' : ''}`}>
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
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-base font-bold text-ink truncate">
            {isYou ? `You · ${name}` : name}
          </span>
        </div>
        <div className="mt-1 flex items-baseline gap-2 font-mono">
          <span className="text-lg font-bold text-ink">{formatCurrency(saved)}</span>
          <span className="text-xs text-ink-muted shrink-0">/ {formatCurrency(target)}</span>
        </div>
        {gapLabel && (
          <p className="mt-1 font-mono text-xs text-ink-muted">{gapLabel}</p>
        )}
        <div className="mt-2">
          <ProgressBar
            value={pct}
            tone={themeColor ? 'theme' : 'primary'}
            themeHex={themeColor ? themeSwatches[themeColor] : undefined}
            size="md"
            animate
          />
        </div>
      </div>
    </div>
  );
}
