import type { ReactNode } from 'react';
import { formatCurrency } from '../../lib/format';
import type { ThemeSwatch } from '../../lib/theme';
import { PlayerProgressRow } from '../PlayerProgressRow/PlayerProgressRow';
import { useI18n } from '../../i18n/useI18n';

interface PlayerInput {
  name: string;
  fallback: string;
  imageUrl?: string | null;
  saved: number;
  target: number;
  themeColor?: ThemeSwatch;
  isYou?: boolean;
}

interface HeadToHeadCardProps {
  left: PlayerInput;
  right: PlayerInput;
  /** Slot rendered on the partner's row (the row where `isYou` is false). */
  partnerSlot?: ReactNode;
}

/**
 * Two-player progress comparison shown near the top of the Dashboard.
 * Leader appears first; a small icon badge sits on the top-left of
 * the leader's avatar so rank is obvious at a glance. The trailing
 * player no longer carries a "Behind by ฿X" subtitle — the gap is
 * read once from the leader's row to avoid duplicate state.
 */
export function HeadToHeadCard({ left, right, partnerSlot }: HeadToHeadCardProps) {
  const { copy } = useI18n();
  const d = copy.dashboard;
  const tied = left.saved === right.saved;
  const gap = Math.abs(left.saved - right.saved);
  const rows = [left, right].sort((a, b) => {
    if (b.saved !== a.saved) return b.saved - a.saved;
    return a.name.localeCompare(b.name);
  });

  return (
    <section className="space-y-3">
      <h2 className="font-mono text-lg font-bold leading-tight text-ink">{d.progressRace}</h2>
      <div className="flex flex-col gap-3">
        <PlayerProgressRow
          {...rows[0]}
          isLeader={!tied}
          gapLabel={tied ? d.tied : d.leadingBy(formatCurrency(gap))}
          trailing={!rows[0].isYou ? partnerSlot : undefined}
        />
        <PlayerProgressRow
          {...rows[1]}
          gapLabel={undefined}
          trailing={!rows[1].isYou ? partnerSlot : undefined}
        />
      </div>
    </section>
  );
}
