import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

interface UseUnreadNotificationsCountResult {
  count: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Lightweight unread badge source for the Dashboard bell. Calls the
 * `unread_notification_count` RPC without tying refreshes to app focus,
 * so returning from another app never looks like a page reload.
 */
export function useUnreadNotificationsCount(): UseUnreadNotificationsCountResult {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCount = useCallback(async () => {
    if (!user) {
      setCount(0);
      setLoading(false);
      return;
    }
    setError(null);
    const { data, error: err } = await supabase.rpc('unread_notification_count');
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setCount(typeof data === 'number' ? data : Number(data ?? 0));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void fetchCount();
  }, [fetchCount]);

  return { count, loading, error, refetch: fetchCount };
}
