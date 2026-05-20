import type { ReactNode } from 'react';
import { formatCurrency } from '../../lib/format';
import type { ThemeSwatch } from '../../lib/theme';
import { PlayerProgressRow } from '../PlayerProgressRow/PlayerProgressRow';
import { useI18n } from '../../i18n/useI18n';

/**
 * One row's worth of data for the N-aware Progress Race list.
 * Mirrors the inputs `PlayerProgressRow` already consumes, plus the
 * `userId` the caller uses to key per-row trailing slots
 * (e.g. one `NudgeButton` per non-self entry).
 */
export interface PlayerProgressEntry {
  userId: string;
  name: string;
  fallback: string;
  imageUrl?: string | null;
  saved: number;
  target: number;
  themeColor?: ThemeSwatch;
  isYou: boolean;
}

interface RoomLeaderboardListProps {
  /** Leader-first list. Caller is responsible for sort. */
  entries: PlayerProgressEntry[];
  /** Render a per-row trailing slot for any non-self entry. */
  renderRowTrailing?: (entry: PlayerProgressEntry) => ReactNode;
  /** Section heading. Defaults to copy.dashboard.progressRace. */
  title?: string;
  /** Empty-state body when entries.length === 1 (solo creator). */
  emptyBody?: string;
  /**
   * Optional per-row tap handler. When provided, the avatar + content
   * stack of each row becomes a native `<button>` via
   * `PlayerProgressRow`'s `onClick` prop. The trailing slot (e.g.
   * `NudgeButton`) renders as a sibling of that button — never nested
   * inside it — so no interactive control sits inside another
   * interactive control. Used by Dashboard to deep link into
   * `/members/:userId` (or `/profile` for the caller's own row). When
   * omitted, rows remain non-interactive — matches the Task-33
   * contract for legacy callsites and Storybook previews.
   */
  onRowClick?: (entry: PlayerProgressEntry) => void;
}

/**
 * N-aware vertical leaderboard rendered near the top of the Dashboard.
 *
 * Replaces the hard-coded 2-player `HeadToHeadCard` with a list of
 * `PlayerProgressRow`s so the same surface works for 1, 2, ... N
 * members. The top row is the leader; when the top two are tied on
 * `saved`, no crown is shown and the leader's gap label reads "Tied"
 * — matching today's `HeadToHeadCard` behaviour byte-for-byte at N = 2.
 *
 * The list does NOT introduce horizontal scrolling or virtualisation.
 * Rows become tappable only when `onRowClick` is supplied — otherwise
 * they render as before (non-interactive div).
 */
export function RoomLeaderboardList({
  entries,
  renderRowTrailing,
  title,
  emptyBody,
  onRowClick,
}: RoomLeaderboardListProps) {
  const { copy } = useI18n();
  const d = copy.dashboard;
  const heading = title ?? d.progressRace;

  // Defensive resort so the visual order is independent of any future
  // leaderboard sort tweak. Matches the comparator used by today's
  // `HeadToHeadCard`.
  const sorted = [...entries].sort((a, b) => {
    if (b.saved !== a.saved) return b.saved - a.saved;
    return a.name.localeCompare(b.name);
  });

  const tied = sorted.length >= 2 && sorted[0].saved === sorted[1].saved;
  const gap = sorted.length >= 2 ? sorted[0].saved - sorted[1].saved : 0;

  return (
    <section className="space-y-3">
      <h2 className="font-mono text-lg font-bold leading-tight text-ink">{heading}</h2>
      <div className="flex flex-col gap-3">
        {sorted.map((entry, index) => {
          const isLeader = index === 0 && sorted.length >= 2 && !tied;
          const gapLabel = index === 0 && sorted.length >= 2
            ? (tied ? d.tied : d.leadingBy(formatCurrency(gap)))
            : undefined;
          const trailing = !entry.isYou ? renderRowTrailing?.(entry) : undefined;
          const handleClick = onRowClick ? () => onRowClick(entry) : undefined;
          const clickAriaLabel = handleClick
            ? (entry.isYou ? d.viewYourProfile : d.viewMemberAria(entry.name))
            : undefined;
          return (
            <PlayerProgressRow
              key={entry.userId}
              name={entry.name}
              fallback={entry.fallback}
              imageUrl={entry.imageUrl}
              saved={entry.saved}
              target={entry.target}
              themeColor={entry.themeColor}
              isYou={entry.isYou}
              isLeader={isLeader}
              gapLabel={gapLabel}
              trailing={trailing}
              onClick={handleClick}
              clickAriaLabel={clickAriaLabel}
            />
          );
        })}
      </div>
      {sorted.length === 1 && emptyBody && (
        <p className="font-mono text-xs text-ink-muted">{emptyBody}</p>
      )}
    </section>
  );
}
