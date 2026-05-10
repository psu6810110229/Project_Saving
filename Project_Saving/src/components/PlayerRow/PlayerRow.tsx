import type { LeaderboardEntry } from '../../hooks/useLeaderboard';
import { Avatar } from '../Avatar/Avatar';
import { RankBadge } from '../RankBadge/RankBadge';
import { StreakFlame } from '../StreakFlame/StreakFlame';
import { formatCurrency } from '../../lib/format';

interface Props {
  entry: LeaderboardEntry;
}

export function PlayerRow({ entry }: Props) {
  const { rank, userId, displayName, saved, target, percent, streak, hasLoggedToday, isYou } = entry;
  const isLeader = rank === 1;

  return (
    <div
      className={`
        rounded-2xl p-4 flex flex-col gap-3
        ${isYou
          ? 'bg-terracotta/10 border-2 border-terracotta'
          : 'bg-surface border border-border shadow-sm'
        }
        transition-all duration-300
      `}
    >
      {/* Top row: rank badge | avatar + name | streak chip */}
      <div className="flex items-center gap-3">
        <RankBadge rank={rank} />

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Avatar userId={userId} displayName={displayName} size={40} />
          <span
            className={`text-base font-semibold truncate ${isLeader ? 'text-terracotta' : 'text-ink'}`}
          >
            {displayName}
            {isYou && (
              <span className="ml-1 text-xs font-normal text-ink-muted">(you)</span>
            )}
          </span>
        </div>

        {streak >= 1 && (
          <StreakFlame streak={streak} hasLoggedToday={hasLoggedToday} />
        )}
      </div>

      {/* Amount */}
      <div
        className={`text-3xl font-bold tracking-tight ${isLeader ? 'text-terracotta' : 'text-ink'}`}
      >
        {formatCurrency(saved)}
      </div>

      {/* Progress bar + percent */}
      {target !== null && target > 0 ? (
        <div className="flex flex-col gap-1">
          <div className="h-3 rounded-full bg-border overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${isYou ? 'bg-terracotta' : 'bg-ink/40'}`}
              style={{ width: `${Math.min(100, percent)}%` }}
            />
          </div>
          <span className="text-xs text-ink-muted">{percent}% of goal</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="h-3 rounded-full bg-border" />
          <span className="text-xs text-ink-muted">—</span>
        </div>
      )}
    </div>
  );
}
