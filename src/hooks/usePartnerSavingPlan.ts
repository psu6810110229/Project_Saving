import { useMemo } from 'react';
import type { SavingPlan } from '../types';
import { useRoomMembersSavingPlans } from './useRoomMembersSavingPlans';

export interface UsePartnerSavingPlanResult {
  plan: SavingPlan | null;
  loading: boolean;
  error: string | null;
}

/**
 * Backward-compatible wrapper preserving today's single-partner shape.
 *
 * Delegates to {@link useRoomMembersSavingPlans} with a one-element id
 * array so the 2-user case exercises the same code path as the N-user
 * case. The N-aware Saving Plan surface replaces this wrapper in
 * slice S4 of the multi-user-rooms audit.
 *
 * Returns the partner's active plan or `null`, matching the pre-task
 * `UsePartnerSavingPlanResult` contract.
 */
export function usePartnerSavingPlan(
  roomId: string | null,
  partnerUserId: string | null | undefined,
): UsePartnerSavingPlanResult {
  const ids = useMemo(
    () => (partnerUserId ? [partnerUserId] : []),
    [partnerUserId],
  );
  const { plansByUser, loading, error } = useRoomMembersSavingPlans(roomId, ids);
  const plan = partnerUserId ? (plansByUser[partnerUserId] ?? null) : null;
  return { plan, loading, error };
}
