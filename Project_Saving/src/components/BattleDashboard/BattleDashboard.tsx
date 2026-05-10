import { PlayerProgress } from '../PlayerProgress/PlayerProgress';
import { GapBadge } from '../GapBadge/GapBadge';
import type { BattleStats } from '../../hooks/useBattleStats';

interface Props {
  stats: BattleStats;
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-5 bg-border rounded w-1/3" />
      <div className="h-3 bg-border rounded-full" />
      <div className="h-4 bg-border rounded w-1/2 mx-auto" />
      <div className="h-3 bg-border rounded-full" />
      <div className="h-5 bg-border rounded w-1/3" />
    </div>
  );
}

export function BattleDashboard({ stats }: Props) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-1">
      <span className="text-xs text-ink-muted uppercase tracking-widest mb-4">⚔ Battle</span>

      {stats.loading ? (
        <Skeleton />
      ) : !stats.players ? (
        <p className="text-sm text-ink-muted text-center py-4">
          Waiting for partner to join…
        </p>
      ) : (
        <>
          {/* Mobile: stacked layout */}
          <div className="flex flex-col gap-4 md:hidden">
            <PlayerProgress player={stats.players[0]} />
            <GapBadge leaderName={stats.leaderName} gapAmount={stats.gapAmount} />
            <PlayerProgress player={stats.players[1]} />
          </div>

          {/* md+: side-by-side layout */}
          <div className="hidden md:flex items-start gap-6">
            <PlayerProgress player={stats.players[0]} />
            <div className="flex flex-col items-center gap-2 pt-2 shrink-0">
              <div className="w-px h-10 bg-border" />
              <GapBadge leaderName={stats.leaderName} gapAmount={stats.gapAmount} />
              <div className="w-px h-10 bg-border" />
            </div>
            <PlayerProgress player={stats.players[1]} />
          </div>
        </>
      )}
    </div>
  );
}
