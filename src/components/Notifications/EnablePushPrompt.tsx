import { useState } from 'react';
import { Button } from '../Button/Button';
import { useI18n } from '../../i18n/useI18n';
import { usePushSubscription } from '../../hooks/usePushSubscription';
import { useNotificationPreferences } from '../../hooks/useNotificationPreferences';

/**
 * Dismissible banner shown to users who have not yet subscribed a
 * device for push notifications. Renders only when:
 *   - push API is supported in this browser
 *   - the user hasn't explicitly denied OS/browser permission
 *   - no existing push subscription exists on this device
 *   - the user hasn't dismissed the prompt within the last 7 days
 *
 * On "Turn on" → calls subscribe() (which also sets push_enabled=true).
 * On "Not now"  → sets prompt_dismissed_until to now+7 days.
 *
 * Reuses the same device-card pattern from NotificationSettings so the
 * visual language stays consistent.
 */
export function EnablePushPrompt() {
  const { copy } = useI18n();
  const n = copy.notifications.enablePushPrompt;

  const { ready, unsupported, permission, deviceState, subscribe } = usePushSubscription();
  const { preferences, loading: prefsLoading, update } = useNotificationPreferences();

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Derived visibility. All of these must be true before we render.
  const permissionHard = permission === 'denied' || permission === 'unsupported';
  const isSubscribed = deviceState === 'granted_subscribed';

  const dismissed = (() => {
    if (!preferences?.prompt_dismissed_until) return false;
    return new Date(preferences.prompt_dismissed_until) > new Date();
  })();

  const shouldShow = ready && !prefsLoading && !unsupported && !permissionHard && !isSubscribed && !dismissed && !done;

  if (!shouldShow) return null;

  async function handleEnable() {
    setBusy(true);
    const result = await subscribe();
    setBusy(false);
    if (!result.error) {
      setDone(true);
    }
  }

  async function handleDismiss() {
    const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await update({ prompt_dismissed_until: until });
  }

  return (
    <section className="rounded-xl bg-surface p-4 shadow-soft flex items-start gap-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 text-lg"
        aria-hidden
      >
        🔔
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm font-bold text-ink">{n.title}</p>
        <p className="mt-0.5 font-mono text-xs leading-relaxed text-ink-muted">{n.body}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="action" size="sm" onClick={handleEnable} disabled={busy}>
            {busy ? n.enablingButton : n.enableButton}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDismiss} disabled={busy}>
            {n.dismissButton}
          </Button>
        </div>
      </div>
    </section>
  );
}
