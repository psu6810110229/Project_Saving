import { formatCurrency } from '../../lib/format';
import { StreakFlame } from '../StreakFlame/StreakFlame';
import type { PlayerStat } from '../../hooks/useBattleStats';

interface Props {
  player: PlayerStat;
}

export function PlayerProgress({ player }: Props) {
  return (
    <div className="flex flex-col gap-2 flex-1 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {player.isLeader && <span className="text-base leading-none">👑</span>}
          <span className={`text-sm font-semibold ${player.isLeader ? 'text-terracotta' : 'text-ink'}`}>
            {player.displayName}
          </span>
        </div>
        <StreakFlame streak={player.streak} hasLoggedToday={player.hasLoggedToday} />
      </div>

      <p className={`text-2xl font-bold tracking-tight ${player.isLeader ? 'text-terracotta' : 'text-ink'}`}>
        {formatCurrency(player.saved)}
      </p>

      <div className="w-full bg-border rounded-full h-3">
        <div
          className="bg-terracotta h-3 rounded-full transition-all duration-500"
          style={{ width: `${player.percent}%` }}
        />
      </div>

      <p className="text-xs text-ink-muted">
        {player.target
          ? `${player.percent}% of ${formatCurrency(player.target)}`
          : 'No goal set'}
      </p>
    </div>
  );
}
