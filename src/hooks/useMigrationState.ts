import { useCallback, useEffect, useMemo, useState } from 'react';

export interface MigrationState {
  step: number;
  completedBucketIds: string[];
  dismissed: boolean;
  done: boolean;
}

const VERSION = 'v0.10.0';

function initialState(): MigrationState {
  return {
    step: 0,
    completedBucketIds: [],
    dismissed: false,
    done: false,
  };
}

function parseState(raw: string | null): MigrationState {
  if (!raw) return initialState();
  try {
    const parsed = JSON.parse(raw) as Partial<MigrationState>;
    return {
      step: typeof parsed.step === 'number' ? parsed.step : 0,
      completedBucketIds: Array.isArray(parsed.completedBucketIds)
        ? parsed.completedBucketIds.filter((id): id is string => typeof id === 'string')
        : [],
      dismissed: Boolean(parsed.dismissed),
      done: Boolean(parsed.done),
    };
  } catch {
    return initialState();
  }
}

export function migrationStorageKey(userId: string | undefined | null): string | null {
  return userId ? `migration_${VERSION}_${userId}` : null;
}

export function useMigrationState(userId: string | undefined | null) {
  const storageKey = useMemo(() => migrationStorageKey(userId), [userId]);
  const [state, setState] = useState<MigrationState>(() => initialState());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    if (!storageKey || typeof window === 'undefined') {
      setState(initialState());
      setLoaded(true);
      return;
    }
    setState(parseState(window.localStorage.getItem(storageKey)));
    setLoaded(true);
  }, [storageKey]);

  const update = useCallback((next: MigrationState | ((current: MigrationState) => MigrationState)) => {
    setState(current => {
      const resolved = typeof next === 'function' ? next(current) : next;
      if (storageKey && typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, JSON.stringify(resolved));
      }
      return resolved;
    });
  }, [storageKey]);

  const markDismissed = useCallback(() => {
    update(current => ({ ...current, dismissed: true }));
  }, [update]);

  const markBucketCompleted = useCallback((bucketId: string) => {
    update(current => {
      const completedBucketIds = current.completedBucketIds.includes(bucketId)
        ? current.completedBucketIds
        : [...current.completedBucketIds, bucketId];
      return {
        ...current,
        step: current.step + 1,
        completedBucketIds,
        dismissed: false,
      };
    });
  }, [update]);

  const markDone = useCallback(() => {
    update(current => ({ ...current, done: true, dismissed: false }));
  }, [update]);

  const resetDismissed = useCallback(() => {
    update(current => ({ ...current, dismissed: false }));
  }, [update]);

  return {
    state,
    loaded,
    setState: update,
    markDismissed,
    markBucketCompleted,
    markDone,
    resetDismissed,
  };
}
