import { PlayerProgress } from '../PlayerProgress/PlayerProgress';
import { GapBadge } from '../GapBadge/GapBadge';
import type { BattleStats } from '../../hooks/useBattleStats';

interface Props {
  stats: BattleStats;
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-4 bg-border rounded w-1/3" />
      <div className="h-2 bg-border rounded-full" />
      <div className="h-3 bg-border rounded w-1/2 mx-auto" />
      <div className="h-2 bg-border rounded-full" />
      <div className="h-4 bg-border rounded w-1/3" />
    </div>
  );
}

export function BattleDashboard({ stats }: Props) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-1">
      <span className="text-xs text-ink-muted uppercase tracking-widest mb-3">Battle</span>

      {stats.loading ? (
        <Skeleton />
      ) : !stats.players ? (
        <p className="text-sm text-ink-muted text-center py-2">
          Waiting for partner to join…
        </p>
      ) : (
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 md:items-center">
          <PlayerProgress player={stats.players[0]} />

          <div className="md:w-px md:h-16 md:bg-border w-full h-px bg-border">
            <div className="md:hidden">
              <GapBadge leaderName={stats.leaderName} gapAmount={stats.gapAmount} />
            </div>
          </div>

          <PlayerProgress player={stats.players[1]} />

          <div className="hidden md:block absolute left-1/2 -translate-x-1/2">
            <GapBadge leaderName={stats.leaderName} gapAmount={stats.gapAmount} />
          </div>
        </div>
      )}

      {!stats.loading && stats.players && (
        <div className="md:hidden mt-1" />
      )}
    </div>
  );
}
