import type { KeyboardEvent, ReactNode } from 'react';
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
   * Optional per-row tap handler. When provided, rows become
   * tappable: each row is wrapped in a `div role="button"` with
   * keyboard activation (Enter / Space). Used by Dashboard to deep
   * link into `/members/:userId` (or `/profile` for the caller's own
   * row). When omitted, rows remain non-interactive — matches the
   * Task-33 contract for legacy callsites and Storybook previews.
   *
   * The row wrapper is a `div` rather than a `<button>` because the
   * Dashboard's trailing slot can contain a `NudgeButton` (a native
   * `<button>`); nesting buttons is invalid. The trailing slot stops
   * pointer / keyboard event propagation so activating the nudge
   * does not also navigate.
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
          const wrappedTrailing = trailing ? (
            <div
              onClick={e => e.stopPropagation()}
              onKeyDown={e => e.stopPropagation()}
              onKeyUp={e => e.stopPropagation()}
            >
              {trailing}
            </div>
          ) : undefined;
          const row = (
            <PlayerProgressRow
              name={entry.name}
              fallback={entry.fallback}
              imageUrl={entry.imageUrl}
              saved={entry.saved}
              target={entry.target}
              themeColor={entry.themeColor}
              isYou={entry.isYou}
              isLeader={isLeader}
              gapLabel={gapLabel}
              trailing={wrappedTrailing}
            />
          );

          if (!onRowClick) {
            return <div key={entry.userId}>{row}</div>;
          }

          const handleActivate = () => onRowClick(entry);
          const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
              event.preventDefault();
              handleActivate();
            }
          };

          return (
            <div
              key={entry.userId}
              role="button"
              tabIndex={0}
              onClick={handleActivate}
              onKeyDown={handleKeyDown}
              className="cursor-pointer rounded-xl outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {row}
            </div>
          );
        })}
      </div>
      {sorted.length === 1 && emptyBody && (
        <p className="font-mono text-xs text-ink-muted">{emptyBody}</p>
      )}
    </section>
  );
}
