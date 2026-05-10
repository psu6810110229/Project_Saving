import { formatCurrency } from './format';
import type { LeaderboardEntry } from '../hooks/useLeaderboard';

export interface NudgeInput {
  leaderboard: LeaderboardEntry[];
  myUserId: string;
  pendingAmount: number;
}

function formatPercent(diff: number): string {
  return diff.toFixed(1) + '%';
}

export function computeNudge({ leaderboard, myUserId, pendingAmount }: NudgeInput): string {
  // Edge: only 1 player total
  if (leaderboard.length <= 1) {
    return 'Invite a friend to start the battle';
  }

  const me = leaderboard.find(e => e.userId === myUserId);
  if (!me) return '';

  // Edge: me has no goal
  if (me.target === null || me.target <= 0) {
    return 'Set a goal in Settings to join the leaderboard';
  }

  const amount = Math.max(0, isNaN(pendingAmount) ? 0 : pendingAmount);
  const myProjectedSaved = me.saved + amount;
  const myProjectedPercent = myProjectedSaved / me.target!;

  // Build projected sorted leaderboard (replace me's percent for sorting, keep others unchanged)
  const projected = leaderboard
    .map(e => ({
      ...e,
      _sortPercent: e.userId === myUserId ? myProjectedPercent : (e.target && e.target > 0 ? e.saved / e.target : -Infinity),
    }))
    .sort((a, b) => {
      if (b._sortPercent !== a._sortPercent) return b._sortPercent - a._sortPercent;
      const aSaved = a.userId === myUserId ? myProjectedSaved : a.saved;
      const bSaved = b.userId === myUserId ? myProjectedSaved : b.saved;
      if (bSaved !== aSaved) return bSaved - aSaved;
      return a.displayName.localeCompare(b.displayName);
    });

  const newRank = projected.findIndex(e => e.userId === myUserId) + 1;
  const currentRank = me.rank;

  // Find the player just above me in the projected list
  const aboveEntry = newRank > 1 ? projected[newRank - 2] : null;

  // ΔBaht to overtake the player above (based on percent since targets may differ)
  function deltaToOvertake(above: LeaderboardEntry): number {
    const abovePercent = above.target && above.target > 0 ? above.saved / above.target : 0;
    const amountNeeded = Math.ceil(abovePercent * me!.target! - me!.saved);
    return Math.max(1, amountNeeded);
  }

  // No pending amount
  if (amount === 0) {
    if (currentRank === 1) {
      // Lead over rank #2
      const second = leaderboard.find(e => e.rank === 2);
      if (!second) return `You lead the board — keep the heat 🔥`;
      const myPct = me.target && me.target > 0 ? me.saved / me.target : 0;
      const secondPct = second.target && second.target > 0 ? second.saved / second.target : 0;
      const diff = (myPct - secondPct) * 100;
      return `You lead ${second.displayName} by ${formatPercent(diff)} — keep the heat 🔥`;
    } else {
      const above = leaderboard.find(e => e.rank === currentRank - 1)!;
      const delta = deltaToOvertake(above);
      return `Save ${formatCurrency(delta)} to overtake ${above.displayName}`;
    }
  }

  // With pending amount
  const rankImproved = newRank < currentRank;

  if (rankImproved) {
    return `฿${amount.toLocaleString('th-TH')} jumps you to #${newRank} 🔥`;
  }

  if (newRank === 1) {
    return `฿${amount.toLocaleString('th-TH')} extends your lead — keep stacking 🔥`;
  }

  // Check if it would cause a tie
  if (aboveEntry) {
    const abovePct = aboveEntry.target && aboveEntry.target > 0 ? aboveEntry.saved / aboveEntry.target : 0;
    if (Math.abs(myProjectedPercent - abovePct) < 0.0001) {
      return `฿${amount.toLocaleString('th-TH')} ties #${newRank - 1} — one more pushes you above`;
    }
  }

  // Same rank, not #1
  const delta = aboveEntry ? deltaToOvertake(aboveEntry) : 0;
  if (aboveEntry && delta > 0) {
    return `฿${amount.toLocaleString('th-TH')} closes the gap — ${formatCurrency(delta - amount > 0 ? delta - amount : delta)} more to overtake ${aboveEntry.displayName}`;
  }

  return `฿${amount.toLocaleString('th-TH')} closes the gap — keep going 🔥`;
}
