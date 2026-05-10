import type { LeaderboardState } from '../../hooks/useLeaderboard';
import { PlayerRow } from '../PlayerRow/PlayerRow';

interface Props {
  state: LeaderboardState;
}

function SkeletonRow() {
  return (
    <div className="rounded-2xl p-4 bg-surface border border-border flex flex-col gap-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-border" />
        <div className="w-10 h-10 rounded-full bg-border" />
        <div className="flex-1 h-4 rounded bg-border" />
      </div>
      <div className="h-8 w-32 rounded bg-border" />
      <div className="h-3 rounded-full bg-border" />
    </div>
  );
}

function WaitingPlaceholder() {
  return (
    <div className="rounded-2xl p-4 border-2 border-dashed border-border flex items-center justify-center text-sm text-ink-muted">
      Waiting for partner…
    </div>
  );
}

export function Leaderboard({ state }: Props) {
  const { entries, loading } = state;
  const playerCount = entries.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-ink-muted font-semibold">
          Leaderboard
        </span>
        {!loading && (
          <span className="text-xs text-ink-muted">
            {playerCount} {playerCount === 1 ? 'player' : 'players'}
          </span>
        )}
      </div>

      {/* Skeleton */}
      {loading && (
        <>
          <SkeletonRow />
          <SkeletonRow />
        </>
      )}

      {/* Rows */}
      {!loading && entries.map(entry => (
        <PlayerRow key={entry.userId} entry={entry} />
      ))}

      {/* Waiting placeholder if only 1 player */}
      {!loading && playerCount === 1 && <WaitingPlaceholder />}
    </div>
  );
}
