import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { BucketIntentEventKey, BucketIntentSettings } from '../types';

export interface UseBucketIntentSettingsResult {
  settings: BucketIntentSettings | null;
  loading: boolean;
  error: string | null;
  setManualNextBucket: (bucketId: string | null) => Promise<{ error?: string }>;
  logIntentEvent: (event: {
    eventKey: BucketIntentEventKey;
    bucketId?: string | null;
    payload?: Record<string, unknown>;
  }) => Promise<void>;
}

export function useBucketIntentSettings(
  roomId: string | null,
): UseBucketIntentSettingsResult {
  const { user } = useAuth();
  const [settings, setSettings] = useState<BucketIntentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!roomId || !user) {
      setSettings(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from('bucket_intent_settings')
      .select('*')
      .eq('user_id', user.id)
      .eq('room_id', roomId)
      .maybeSingle();
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSettings(data as BucketIntentSettings | null);
      setError(null);
    }
  }, [roomId, user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSettings();
  }, [fetchSettings]);

  const setManualNextBucket = useCallback(
    async (bucketId: string | null): Promise<{ error?: string }> => {
      if (!user || !roomId) return { error: 'Not authenticated or no room' };

      const now = bucketId ? new Date().toISOString() : null;
      const row = {
        user_id: user.id,
        room_id: roomId,
        manual_next_bucket_id: bucketId,
        manual_next_set_at: now,
        updated_at: new Date().toISOString(),
      };

      const { error: err } = await supabase
        .from('bucket_intent_settings')
        .upsert(row, { onConflict: 'user_id,room_id' });

      if (err) return { error: err.message };

      await fetchSettings();
      return {};
    },
    [user, roomId, fetchSettings],
  );

  const logIntentEvent = useCallback(
    async (event: {
      eventKey: BucketIntentEventKey;
      bucketId?: string | null;
      payload?: Record<string, unknown>;
    }): Promise<void> => {
      if (!user || !roomId) return;
      supabase
        .from('bucket_intent_events')
        .insert({
          user_id: user.id,
          room_id: roomId,
          bucket_id: event.bucketId ?? null,
          event_key: event.eventKey,
          payload: event.payload ?? {},
        })
        .then();
    },
    [user, roomId],
  );

  return { settings, loading, error, setManualNextBucket, logIntentEvent };
}
