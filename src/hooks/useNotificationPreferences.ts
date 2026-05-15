import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type {
  NotificationPreferences,
  NotificationPreferencesUpdate,
} from '../types';

interface UseNotificationPreferencesResult {
  preferences: NotificationPreferences | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  update: (changes: NotificationPreferencesUpdate) => Promise<{ error?: string }>;
  refetch: () => Promise<void>;
}

/**
 * Wraps the `get_notification_preferences` and
 * `update_notification_preferences` security-definer RPCs. The first
 * read auto-creates a default row for the caller.
 */
export function useNotificationPreferences(): UseNotificationPreferencesResult {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrefs = useCallback(async () => {
    if (!user) {
      setPreferences(null);
      setLoading(false);
      return;
    }
    setError(null);
    const { data, error: err } = await supabase.rpc('get_notification_preferences');
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const row = (Array.isArray(data) ? data[0] : data) as NotificationPreferences | null;
    setPreferences(row ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void fetchPrefs();
  }, [fetchPrefs]);

  const update = useCallback(async (changes: NotificationPreferencesUpdate): Promise<{ error?: string }> => {
    if (!user) return { error: 'Not authenticated' };
    setSaving(true);
    setError(null);

    const previous = preferences;
    // Optimistic UI: merge change locally so toggles feel instant.
    if (previous) {
      setPreferences({ ...previous, ...changes } as NotificationPreferences);
    }

    const clearPromptDismissed =
      Object.prototype.hasOwnProperty.call(changes, 'prompt_dismissed_until') &&
      changes.prompt_dismissed_until === null;

    const { data, error: err } = await supabase.rpc('update_notification_preferences', {
      p_master_enabled: changes.master_enabled ?? null,
      p_push_enabled: changes.push_enabled ?? null,
      p_nudges_enabled: changes.nudges_enabled ?? null,
      p_saving_reminders_enabled: changes.saving_reminders_enabled ?? null,
      p_partner_activity_enabled: changes.partner_activity_enabled ?? null,
      p_product_updates_enabled: changes.product_updates_enabled ?? null,
      p_prompt_dismissed_until: clearPromptDismissed ? null : (changes.prompt_dismissed_until ?? null),
      p_clear_prompt_dismissed: clearPromptDismissed,
    });

    setSaving(false);

    if (err) {
      // Roll back optimistic state and surface the error.
      if (previous) setPreferences(previous);
      setError(err.message);
      return { error: err.message };
    }

    const row = (Array.isArray(data) ? data[0] : data) as NotificationPreferences | null;
    if (row) setPreferences(row);
    return {};
  }, [preferences, user]);

  return { preferences, loading, saving, error, update, refetch: fetchPrefs };
}
