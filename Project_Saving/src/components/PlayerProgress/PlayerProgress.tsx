import { formatCurrency } from '../../lib/format';
import { StreakFlame } from '../StreakFlame/StreakFlame';
import type { PlayerStat } from '../../hooks/useBattleStats';

interface Props {
  player: PlayerStat;
}

export function PlayerProgress({ player }: Props) {
  return (
    <div className="flex flex-col gap-2 flex-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">{player.displayName}</span>
          {player.isLeader && (
            <span className="text-xs bg-terracotta text-white rounded-full px-2 py-0.5">Leading</span>
          )}
        </div>
        <StreakFlame streak={player.streak} hasLoggedToday={player.hasLoggedToday} />
      </div>

      <div className="w-full bg-border rounded-full h-2">
        <div
          className="bg-terracotta h-2 rounded-full transition-all duration-500"
          style={{ width: `${player.percent}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>{formatCurrency(player.saved)}</span>
        <span>
          {player.target
            ? `${player.percent}% of ${formatCurrency(player.target)}`
            : 'No goal set'}
        </span>
      </div>
    </div>
  );
}
