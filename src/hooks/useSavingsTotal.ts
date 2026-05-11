import type { SavingsLog } from '../types';

// Derives total from the realtime log list — no separate DB query needed.
export function useSavingsTotal(userId: string | undefined, logs: SavingsLog[]) {
  const total = logs
    .filter(l => l.user_id === userId)
    .reduce((sum, l) => sum + l.amount, 0);

  return { total };
}
