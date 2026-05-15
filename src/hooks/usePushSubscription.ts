import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/**
 * Coarse permission/device state used by the Notification Settings
 * page and any future permission-onboarding card.
 *  - `unsupported`: browser lacks service workers / PushManager / VAPID
 *  - `denied`: user blocked notifications at the browser level
 *  - `granted_subscribed`: permission granted AND a subscription exists on this device
 *  - `granted_unsubscribed`: permission granted but no subscription
 *  - `default`: user has not been prompted yet
 */
export type PushDeviceState =
  | 'unsupported'
  | 'denied'
  | 'granted_subscribed'
  | 'granted_unsubscribed'
  | 'default';

interface PushSubscriptionState {
  /** True once we know whether the user is subscribed on this device. */
  ready: boolean;
  /** Whether a PushSubscription exists for this device. */
  subscribed: boolean;
  /** Set when the browser does not support web push (iOS Safari pre-16.4). */
  unsupported: boolean;
  /** Raw browser permission, or `unsupported` if the API is missing. */
  permission: NotificationPermission | 'unsupported';
  /** Combined permission + subscription state for UI. */
  deviceState: PushDeviceState;
  /** Subscribes the current device, prompting for permission if needed. */
  subscribe: () => Promise<{ error?: string }>;
  /** Removes the subscription locally and in `public.push_subscriptions`. */
  unsubscribe: () => Promise<{ error?: string }>;
}

function readPermission(unsupported: boolean): NotificationPermission | 'unsupported' {
  if (unsupported) return 'unsupported';
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

function deriveDeviceState(
  unsupported: boolean,
  permission: NotificationPermission | 'unsupported',
  subscribed: boolean,
): PushDeviceState {
  if (unsupported || permission === 'unsupported') return 'unsupported';
  if (permission === 'denied') return 'denied';
  if (permission === 'granted') return subscribed ? 'granted_subscribed' : 'granted_unsubscribed';
  return 'default';
}

/**
 * Manages the user's Web Push subscription for the nudge feature and
 * (post-23.2) the notification settings surface. The hook exposes both
 * the raw browser permission and a derived `deviceState` so UI code
 * doesn't have to repeat the same branching everywhere.
 */
export function usePushSubscription(): PushSubscriptionState {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const unsupported = typeof window === 'undefined'
    || !('serviceWorker' in navigator)
    || !('PushManager' in window)
    || !VAPID_PUBLIC_KEY;

  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    () => readPermission(unsupported),
  );

  useEffect(() => {
    let cancelled = false;
    if (unsupported || !user) {
      Promise.resolve().then(() => { if (!cancelled) setReady(true); });
      return () => { cancelled = true; };
    }
    navigator.serviceWorker.ready.then(registration => registration.pushManager.getSubscription())
      .then(existing => {
        if (cancelled) return;
        setSubscribed(Boolean(existing));
        setPermission(readPermission(unsupported));
        setReady(true);
      })
      .catch(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [user, unsupported]);

  const subscribe = useCallback(async (): Promise<{ error?: string }> => {
    if (unsupported || !user) return { error: 'Push not supported in this browser.' };
    if (!VAPID_PUBLIC_KEY) return { error: 'Push is not configured for this deployment.' };
    const next = await Notification.requestPermission();
    setPermission(next);
    if (next !== 'granted') return { error: 'Notifications were not allowed.' };

    const registration = await navigator.serviceWorker.ready;
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { error: 'Could not read the push subscription details.' };
    }

    const { error: insertError } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth_key: json.keys.auth,
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'user_id,endpoint' });
    if (insertError) return { error: insertError.message };

    setSubscribed(true);
    return {};
  }, [user, unsupported]);

  const unsubscribe = useCallback(async (): Promise<{ error?: string }> => {
    if (!user) return { error: 'Not authenticated' };
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      const endpoint = existing.endpoint;
      await existing.unsubscribe();
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    }
    setSubscribed(false);
    return {};
  }, [user]);

  const deviceState = deriveDeviceState(unsupported, permission, subscribed);

  return {
    ready,
    subscribed,
    unsupported,
    permission,
    deviceState,
    subscribe,
    unsubscribe,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}
