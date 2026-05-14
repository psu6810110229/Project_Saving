import { themeSwatches, type ThemeSwatch } from '../../lib/theme';
import { Avatar } from '../Avatar/Avatar';
import { Chip } from '../Chip/Chip';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { formatCurrency } from '../../lib/format';

/**
 * One player's row inside the Head-to-Head card. Renders the player's
 * avatar (with optional "Leader" badge when `isLeader`), their name,
 * the saved-vs-target amount, and a theme-tinted progress bar.
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
    <div className={`flex items-center gap-3 rounded-2xl px-2 py-2 ${isYou ? 'bg-brand-50' : ''}`}>
      <Avatar
        size="md"
        imageUrl={imageUrl}
        fallback={fallback}
        ring={isLeader ? 'leader' : themeColor ? 'theme' : 'none'}
        themeColor={themeColor}
        badge={isLeader ? <Chip tone="peach">Leader</Chip> : undefined}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-sm font-bold text-ink truncate">{isYou ? `You · ${name}` : name}</span>
          <span className="font-mono text-xs text-ink-muted shrink-0">
            {formatCurrency(saved)} / {formatCurrency(target)}
          </span>
        </div>
        {gapLabel && (
          <p className="mt-1 font-mono text-[11px] text-ink-muted">{gapLabel}</p>
        )}
        <div className="mt-1.5">
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
