import type { ThemeSwatch } from '../../lib/theme';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { PlayerProgressRow } from '../PlayerProgressRow/PlayerProgressRow';

/**
 * Dashboard Head-to-Head card. Two player rows stacked vertically with
 * a thin divider, plus the section label up top.
 *
 * Leader is computed from `saved / target` — higher ratio wins.
 */

interface PlayerInput {
  name: string;
  fallback: string;
  imageUrl?: string | null;
  saved: number;
  target: number;
  themeColor?: ThemeSwatch;
}

interface HeadToHeadCardProps {
  left: PlayerInput;
  right: PlayerInput;
}

export function HeadToHeadCard({ left, right }: HeadToHeadCardProps) {
  const leftPct = left.target > 0 ? left.saved / left.target : 0;
  const rightPct = right.target > 0 ? right.saved / right.target : 0;
  const leftLeads = leftPct > rightPct;
  const rightLeads = rightPct > leftPct;

  return (
    <section className="rounded-3xl bg-surface shadow-soft p-5">
      <SectionLabel tone="muted">Head-to-Head</SectionLabel>
      <div className="mt-4 flex flex-col gap-5">
        <PlayerProgressRow {...left} isLeader={leftLeads} />
        <div className="h-px bg-well" />
        <PlayerProgressRow {...right} isLeader={rightLeads} />
      </div>
    </section>
  );
}
