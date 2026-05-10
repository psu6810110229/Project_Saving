import { computeNudge } from '../../lib/battleNudge';
import type { LeaderboardEntry } from '../../hooks/useLeaderboard';

interface Props {
  leaderboard: LeaderboardEntry[];
  myUserId: string;
  pendingAmount: number;
}

export function BattleNudge({ leaderboard, myUserId, pendingAmount }: Props) {
  const text = computeNudge({ leaderboard, myUserId, pendingAmount });

  const me = leaderboard.find(e => e.userId === myUserId);
  const isAhead = me?.rank === 1;

  return (
    <p className={`text-sm transition-all duration-200 ${isAhead ? 'text-terracotta font-medium' : 'text-ink-muted'}`}>
      {text}
    </p>
  );
}
