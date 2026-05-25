import { createContext } from 'react';
import type { useBuckets } from '../../hooks/useBuckets';
import type { useBucketActivityEvents } from '../../hooks/useBucketActivityEvents';
import type { useBucketTransfers } from '../../hooks/useBucketTransfers';
import type { useGoal } from '../../hooks/useGoal';
import type { useLeaderboard } from '../../hooks/useLeaderboard';
import type { useLogs } from '../../hooks/useLogs';
import type { usePartnerBuckets } from '../../hooks/usePartnerBuckets';
import type { usePartnerSavingPlan } from '../../hooks/usePartnerSavingPlan';
import type { useProfile } from '../../hooks/useProfile';
import type { useReconcile } from '../../hooks/useReconcile';
import type { useRoomMembersBuckets } from '../../hooks/useRoomMembersBuckets';
import type { useRoomMembersSavingPlans } from '../../hooks/useRoomMembersSavingPlans';
import type { useRoomOtherMemberIds } from '../../hooks/useRoomOtherMemberIds';
import type { useSavingPlan } from '../../hooks/useSavingPlan';
import type { useStreakFreeze } from '../../hooks/useStreakFreeze';

export interface DataContextValue {
  profile: ReturnType<typeof useProfile>;
  buckets: ReturnType<typeof useBuckets>;
  bucketTransfers: ReturnType<typeof useBucketTransfers>;
  bucketActivityEvents: ReturnType<typeof useBucketActivityEvents>;
  logs: ReturnType<typeof useLogs>;
  leaderboard: ReturnType<typeof useLeaderboard>;
  goal: ReturnType<typeof useGoal>;
  partnerBuckets: ReturnType<typeof usePartnerBuckets>;
  savingPlan: ReturnType<typeof useSavingPlan>;
  partnerSavingPlan: ReturnType<typeof usePartnerSavingPlan>;
  reconcile: ReturnType<typeof useReconcile>;
  streakFreeze: ReturnType<typeof useStreakFreeze>;
  otherMemberIds: ReturnType<typeof useRoomOtherMemberIds>;
  roomMembersBuckets: ReturnType<typeof useRoomMembersBuckets>;
  roomMembersSavingPlans: ReturnType<typeof useRoomMembersSavingPlans>;
  refreshAll: () => Promise<void>;
  isRefreshing: boolean;
}

export const DataContext = createContext<DataContextValue | null>(null);
