import { useMemo, type ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useBuckets } from '../../hooks/useBuckets';
import { useGoal } from '../../hooks/useGoal';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { useLogs } from '../../hooks/useLogs';
import { usePartnerBuckets } from '../../hooks/usePartnerBuckets';
import { useProfile } from '../../hooks/useProfile';
import { useReconcile } from '../../hooks/useReconcile';
import { useSavingPlan } from '../../hooks/useSavingPlan';
import { DataContext, type DataContextValue } from './DataContextValue';

// Hoists every page-shared data hook to one mount so tab navigation
// reuses cached state and realtime subscriptions instead of re-fetching.
export function DataProvider({ roomId, children }: { roomId: string; children: ReactNode }) {
  const { user } = useAuth();
  const profile = useProfile();
  const buckets = useBuckets(roomId);
  const logs = useLogs(100, roomId);
  const leaderboard = useLeaderboard(logs.logs, user?.id, roomId);
  const goal = useGoal(roomId);
  const partnerEntry = leaderboard.entries.find(entry => !entry.isYou);
  const partnerBuckets = usePartnerBuckets(roomId, partnerEntry?.userId ?? null);
  const savingPlan = useSavingPlan(roomId);
  const reconcile = useReconcile(roomId);

  const value = useMemo<DataContextValue>(
    () => ({ profile, buckets, logs, leaderboard, goal, partnerBuckets, savingPlan, reconcile }),
    [profile, buckets, logs, leaderboard, goal, partnerBuckets, savingPlan, reconcile],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
