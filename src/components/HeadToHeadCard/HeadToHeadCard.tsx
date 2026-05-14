import { formatCurrency } from '../../lib/format';
import type { ThemeSwatch } from '../../lib/theme';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { PlayerProgressRow } from '../PlayerProgressRow/PlayerProgressRow';

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
}

export function HeadToHeadCard({ left, right }: HeadToHeadCardProps) {
  const tied = left.saved === right.saved;
  const gap = Math.abs(left.saved - right.saved);
  const rows = [left, right].sort((a, b) => {
    if (b.saved !== a.saved) return b.saved - a.saved;
    return a.name.localeCompare(b.name);
  });

  return (
    <section className="rounded-3xl bg-surface shadow-soft p-5">
      <SectionLabel tone="muted">Head-to-Head</SectionLabel>
      <div className="mt-4 flex flex-col gap-5">
        <PlayerProgressRow
          {...rows[0]}
          isLeader={!tied}
          gapLabel={tied ? 'Tied on recorded deposits' : `Leading by ${formatCurrency(gap)}`}
        />
        <div className="h-px bg-well" />
        <PlayerProgressRow
          {...rows[1]}
          gapLabel={tied ? 'Tied on recorded deposits' : `Behind by ${formatCurrency(gap)}`}
        />
      </div>
    </section>
  );
}
