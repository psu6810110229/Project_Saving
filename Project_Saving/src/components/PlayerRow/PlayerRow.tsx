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
        relative overflow-hidden rounded-2xl p-5 flex flex-col gap-4
        ${isYou
          ? 'bg-gradient-to-br from-terracotta/10 via-surface to-surface border-2 border-terracotta shadow-[0_4px_20px_rgba(230,90,55,0.15)] transform hover:-translate-y-1'
          : 'bg-surface border border-border hover:shadow-md transform hover:-translate-y-1'
        }
        transition-all duration-300 ease-out group
      `}
    >
      {/* Top row: rank badge | avatar + name | streak chip */}
      <div className="flex items-center gap-3 relative z-10">
        <RankBadge rank={rank} />

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative">
            <Avatar userId={userId} displayName={displayName} avatarUrl={entry.avatarUrl} size={56} />
            {isLeader && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white shadow-sm" />
            )}
          </div>
          <span
            className={`text-xl font-bold tracking-tight truncate ${isLeader ? 'text-terracotta' : 'text-ink'}`}
          >
            {displayName}
            {isYou && (
              <span className="ml-2 text-xs font-medium text-terracotta bg-terracotta/10 px-2 py-0.5 rounded-full uppercase tracking-wider">You</span>
            )}
          </span>
        </div>

        {streak >= 1 && (
          <div className="transform group-hover:scale-110 transition-transform duration-300">
            <StreakFlame streak={streak} hasLoggedToday={hasLoggedToday} />
          </div>
        )}
      </div>

      {/* Amount and Progress */}
      <div className="flex flex-col gap-2 relative z-10">
        <div className="flex items-end justify-between">
          <div
            className={`text-4xl font-extrabold tracking-tight tabular-nums ${isLeader ? 'text-terracotta drop-shadow-sm' : 'text-ink'}`}
          >
            {formatCurrency(saved)}
          </div>
          {target !== null && target > 0 && (
            <span className="text-sm font-medium text-ink-muted mb-1">{percent}% of goal</span>
          )}
        </div>

        {/* Progress bar */}
        {target !== null && target > 0 ? (
          <div className="h-2.5 rounded-full bg-border overflow-hidden relative shadow-inner">
            <div
              className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out ${isYou ? 'bg-gradient-to-r from-terracotta/80 to-terracotta shadow-[0_0_10px_rgba(230,90,55,0.4)]' : 'bg-ink/30'}`}
              style={{ width: `${Math.min(100, percent)}%` }}
            />
          </div>
        ) : (
          <div className="h-2.5 rounded-full bg-border/50" />
        )}
      </div>
      
      {/* Subtle background glow for the leader */}
      {isLeader && !isYou && (
        <div className="absolute top-0 right-0 -mr-10 -mt-10 w-32 h-32 bg-orange-200/20 rounded-full blur-3xl pointer-events-none" />
      )}
    </div>
  );
}
