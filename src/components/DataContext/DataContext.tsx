import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useBalanceAllocations } from '../../hooks/useBalanceAllocations';
import { useBuckets } from '../../hooks/useBuckets';
import { useBucketActivityEvents } from '../../hooks/useBucketActivityEvents';
import { useBucketTransfers } from '../../hooks/useBucketTransfers';
import { useGoal } from '../../hooks/useGoal';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { useLogs } from '../../hooks/useLogs';
import { usePartnerBuckets } from '../../hooks/usePartnerBuckets';
import { usePartnerSavingPlan } from '../../hooks/usePartnerSavingPlan';
import { useProfile } from '../../hooks/useProfile';
import { useReconcile } from '../../hooks/useReconcile';
import { useRoomMembersBuckets } from '../../hooks/useRoomMembersBuckets';
import { useRoomMembersSavingPlans } from '../../hooks/useRoomMembersSavingPlans';
import { useRoomOtherMemberIds } from '../../hooks/useRoomOtherMemberIds';
import { useSavingPlan } from '../../hooks/useSavingPlan';
import { useStreakFreeze } from '../../hooks/useStreakFreeze';
import { DataContext, type DataContextValue } from './DataContextValue';

// Hoists every page-shared data hook to one mount so tab navigation
// reuses cached state and realtime subscriptions instead of re-fetching.
export function DataProvider({ roomId, children }: { roomId: string; children: ReactNode }) {
  const { user } = useAuth();
  const profile = useProfile();
  const buckets = useBuckets(roomId);
  const bucketTransfers = useBucketTransfers(roomId);
  const balanceAllocations = useBalanceAllocations(roomId);
  const bucketActivityEvents = useBucketActivityEvents(roomId);
  const logs = useLogs(100, roomId);
  const streakFreeze = useStreakFreeze(user?.id);
  const leaderboard = useLeaderboard(user?.id, roomId, streakFreeze.frozenDates);
  const goal = useGoal(roomId);

  // N-safe per-member data layer. The plural fields below are the
  // canonical surface for any future N-aware UI (slice S4).
  const otherMemberIds = useRoomOtherMemberIds(roomId, user?.id);
  const roomMembersBuckets = useRoomMembersBuckets(roomId, otherMemberIds.memberIds);
  const roomMembersSavingPlans = useRoomMembersSavingPlans(roomId, otherMemberIds.memberIds);

  // Legacy single-partner derivation. Kept verbatim so Dashboard,
  // SavingPlan, NudgeButton, and BucketGrid render identically to
  // their pre-task behaviour. The wrappers below route through the
  // same N-safe code path internally; this is one duplicated query
  // per page mount (see docs/plans/32-multi-user-data-hooks.md §4.4).
  const partnerEntry = leaderboard.entries.find(entry => !entry.isYou);
  const partnerBuckets = usePartnerBuckets(roomId, partnerEntry?.userId ?? null);
  const savingPlan = useSavingPlan(roomId);
  const partnerSavingPlan = usePartnerSavingPlan(roomId, partnerEntry?.userId ?? null);
  const reconcile = useReconcile(roomId);

  // Ref holds the latest refetch functions so refreshAll stays stable.
  const refetchRef = useRef({
    logs: logs.refetch,
    buckets: buckets.refetch,
    goal: goal.refetch,
    profile: profile.refetch,
    reconcile: reconcile.refetch,
    savingPlan: savingPlan.refetch,
    streakFreeze: streakFreeze.refresh,
  });
  useEffect(() => {
    refetchRef.current = {
      logs: logs.refetch,
      buckets: buckets.refetch,
      goal: goal.refetch,
      profile: profile.refetch,
      reconcile: reconcile.refetch,
      savingPlan: savingPlan.refetch,
      streakFreeze: streakFreeze.refresh,
    };
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    const r = refetchRef.current;
    await Promise.allSettled([
      r.logs(),
      r.buckets(),
      r.goal(),
      r.profile(),
      r.reconcile(),
      r.savingPlan(),
      r.streakFreeze(),
    ]);
    setIsRefreshing(false);
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({
      profile,
      buckets,
      bucketTransfers,
      balanceAllocations,
      bucketActivityEvents,
      logs,
      leaderboard,
      goal,
      partnerBuckets,
      savingPlan,
      partnerSavingPlan,
      reconcile,
      streakFreeze,
      otherMemberIds,
      roomMembersBuckets,
      roomMembersSavingPlans,
      refreshAll,
      isRefreshing,
    }),
    [
      profile,
      buckets,
      bucketTransfers,
      balanceAllocations,
      bucketActivityEvents,
      logs,
      leaderboard,
      goal,
      partnerBuckets,
      savingPlan,
      partnerSavingPlan,
      reconcile,
      streakFreeze,
      otherMemberIds,
      roomMembersBuckets,
      roomMembersSavingPlans,
      refreshAll,
      isRefreshing,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
