import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { NotificationItem } from '../types';

interface UseNotificationsOptions {
  limit?: number;
}

interface UseNotificationsResult {
  notifications: NotificationItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  markRead: (id: string) => Promise<{ error?: string }>;
  markAllRead: () => Promise<{ error?: string; count?: number }>;
}

type RpcRow = {
  id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  room_id: string | null;
  event_key: string;
  category: NotificationItem['category'];
  channel_policy: NotificationItem['channel_policy'];
  title: string;
  body: string;
  cta_label: string | null;
  target_route: string;
  target_section: string | null;
  fallback_route: string;
  push_safe: boolean;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  clicked_at: string | null;
  created_at: string;
};

function normalize(row: RpcRow): NotificationItem {
  return {
    id: row.id,
    recipient_user_id: row.recipient_user_id,
    actor_user_id: row.actor_user_id,
    room_id: row.room_id,
    event_key: row.event_key,
    category: row.category,
    channel_policy: row.channel_policy,
    title: row.title,
    body: row.body,
    cta_label: row.cta_label,
    target_route: row.target_route,
    target_section: row.target_section,
    fallback_route: row.fallback_route,
    push_safe: row.push_safe,
    payload: row.payload ?? {},
    read_at: row.read_at,
    clicked_at: row.clicked_at,
    created_at: row.created_at,
  };
}

/**
 * Fetches the current user's notification center list via the
 * `list_notifications` RPC. Marking-read is optimistic so the UI feels
 * snappy; failures revert local state and surface an error string.
 */
export function useNotifications({ limit = 30 }: UseNotificationsOptions = {}): UseNotificationsResult {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setError(null);
    const { data, error: err } = await supabase.rpc('list_notifications', {
      p_limit: limit,
      p_before: null,
    });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setNotifications(((data ?? []) as RpcRow[]).map(normalize));
    setLoading(false);
  }, [user, limit]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void fetchList();
  }, [fetchList]);

  const markRead = useCallback(async (id: string): Promise<{ error?: string }> => {
    const previous = notifications;
    const now = new Date().toISOString();
    setNotifications(items => items.map(item =>
      item.id === id ? { ...item, read_at: item.read_at ?? now } : item
    ));
    const { error: err } = await supabase.rpc('mark_notification_read', { p_notification_id: id });
    if (err) {
      setNotifications(previous);
      return { error: err.message };
    }
    return {};
  }, [notifications]);

  const markAllRead = useCallback(async (): Promise<{ error?: string; count?: number }> => {
    const previous = notifications;
    const now = new Date().toISOString();
    setNotifications(items => items.map(item =>
      item.read_at ? item : { ...item, read_at: now }
    ));
    const { data, error: err } = await supabase.rpc('mark_all_notifications_read');
    if (err) {
      setNotifications(previous);
      return { error: err.message };
    }
    return { count: typeof data === 'number' ? data : Number(data ?? 0) };
  }, [notifications]);

  return { notifications, loading, error, refetch: fetchList, markRead, markAllRead };
}
