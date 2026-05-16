import { createContext } from 'react';
import type { useBuckets } from '../../hooks/useBuckets';
import type { useGoal } from '../../hooks/useGoal';
import type { useLeaderboard } from '../../hooks/useLeaderboard';
import type { useLogs } from '../../hooks/useLogs';
import type { usePartnerBuckets } from '../../hooks/usePartnerBuckets';
import type { usePartnerSavingPlan } from '../../hooks/usePartnerSavingPlan';
import type { useProfile } from '../../hooks/useProfile';
import type { useReconcile } from '../../hooks/useReconcile';
import type { useSavingPlan } from '../../hooks/useSavingPlan';

export interface DataContextValue {
  profile: ReturnType<typeof useProfile>;
  buckets: ReturnType<typeof useBuckets>;
  logs: ReturnType<typeof useLogs>;
  leaderboard: ReturnType<typeof useLeaderboard>;
  goal: ReturnType<typeof useGoal>;
  partnerBuckets: ReturnType<typeof usePartnerBuckets>;
  savingPlan: ReturnType<typeof useSavingPlan>;
  partnerSavingPlan: ReturnType<typeof usePartnerSavingPlan>;
  reconcile: ReturnType<typeof useReconcile>;
}

export const DataContext = createContext<DataContextValue | null>(null);
