import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

interface PushSubscriptionState {
  /** True once we know whether the user is subscribed on this device. */
  ready: boolean;
  /** Whether a PushSubscription exists for this device. */
  subscribed: boolean;
  /** Set when the browser does not support web push (iOS Safari pre-16.4). */
  unsupported: boolean;
  /** Subscribes the current device, prompting for permission if needed. */
  subscribe: () => Promise<{ error?: string }>;
  /** Removes the subscription locally and in `public.push_subscriptions`. */
  unsubscribe: () => Promise<{ error?: string }>;
}

/**
 * Manages the user's Web Push subscription for the Phase 6.8 nudge
 * feature. We store the (endpoint, p256dh, auth) triple in
 * public.push_subscriptions so the send-nudge edge function can look
 * up the partner's devices server-side. VAPID public key comes from
 * VITE_VAPID_PUBLIC_KEY at build time — see docs/vapid-runbook.md.
 */
export function usePushSubscription(): PushSubscriptionState {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const unsupported = typeof window === 'undefined'
    || !('serviceWorker' in navigator)
    || !('PushManager' in window)
    || !VAPID_PUBLIC_KEY;

  useEffect(() => {
    let cancelled = false;
    if (unsupported || !user) {
      Promise.resolve().then(() => { if (!cancelled) setReady(true); });
      return () => { cancelled = true; };
    }
    navigator.serviceWorker.ready.then(registration => registration.pushManager.getSubscription())
      .then(existing => { if (!cancelled) { setSubscribed(Boolean(existing)); setReady(true); } })
      .catch(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [user, unsupported]);

  const subscribe = useCallback(async (): Promise<{ error?: string }> => {
    if (unsupported || !user) return { error: 'Push not supported in this browser.' };
    if (!VAPID_PUBLIC_KEY) return { error: 'Push is not configured for this deployment.' };
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { error: 'Notifications were not allowed.' };

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

  return { ready, subscribed, unsupported, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}
