import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import {
  PushNotifications,
  type ActionPerformed,
  type PermissionStatus,
} from '@capacitor/push-notifications';
import { supabase } from './supabase';

const DEVICE_ID_KEY = 'native_push_device_id';
const DEFAULT_CHANNEL_ID = 'goout_updates';
const ALLOWED_ROUTE_PREFIXES = [
  '/dashboard',
  '/add',
  '/check-balance',
  '/saving-plan',
  '/manage-project',
  '/notifications',
  '/profile',
];

export function isNativeAndroidPush(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function nativePermissionToNotificationPermission(
  status: PermissionStatus['receive'],
): NotificationPermission {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'default';
}

export async function readNativePushPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNativeAndroidPush()) return 'unsupported';
  const status = await PushNotifications.checkPermissions();
  return nativePermissionToNotificationPermission(status.receive);
}

async function getOrCreateDeviceId(): Promise<string> {
  const existing = await Preferences.get({ key: DEVICE_ID_KEY });
  if (existing.value) return existing.value;

  const next = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await Preferences.set({ key: DEVICE_ID_KEY, value: next });
  return next;
}

async function setPushPreferenceEnabled(): Promise<void> {
  const { error } = await supabase.rpc('update_notification_preferences', {
    p_master_enabled: null,
    p_push_enabled: true,
    p_nudges_enabled: null,
    p_saving_reminders_enabled: null,
    p_partner_activity_enabled: null,
    p_product_updates_enabled: null,
    p_prompt_dismissed_until: null,
    p_clear_prompt_dismissed: false,
  });
  if (error) console.warn('[nativePush] could not enable push pref', error);
}

async function upsertNativeToken(token: string): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  const { error } = await supabase.rpc('upsert_native_push_token', {
    p_device_id: deviceId,
    p_fcm_token: token,
    p_platform: 'android',
    p_app_version: null,
  });
  if (error) throw new Error(error.message);
  await setPushPreferenceEnabled();
}

export async function hasNativePushSubscription(): Promise<boolean> {
  if (!isNativeAndroidPush()) return false;
  const deviceId = await getOrCreateDeviceId();
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('provider', 'fcm')
    .eq('device_id', deviceId)
    .maybeSingle();
  if (error) {
    console.warn('[nativePush] could not read native subscription state', error);
    return false;
  }
  return Boolean(data);
}

export async function registerNativePush(): Promise<void> {
  if (!isNativeAndroidPush()) throw new Error('Push not supported in this browser.');

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') throw new Error('Notifications were not allowed.');

  await PushNotifications.createChannel({
    id: DEFAULT_CHANNEL_ID,
    name: 'GO-OUT',
    description: 'GO-OUT reminders and updates',
    importance: 4,
    visibility: 1,
  });

  const handles: PluginListenerHandle[] = [];

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('Push registration timed out.'));
      }, 15000);

      void PushNotifications.addListener('registration', token => {
        void (async () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          try {
            await upsertNativeToken(token.value);
            resolve();
          } catch (error) {
            reject(error);
          }
        })();
      }).then(handle => { handles.push(handle); });

      void PushNotifications.addListener('registrationError', error => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        reject(new Error(error.error));
      }).then(handle => { handles.push(handle); });

      void PushNotifications.register();
    });
  } finally {
    for (const handle of handles) void handle.remove();
  }
}

export async function unregisterNativePush(): Promise<void> {
  if (!isNativeAndroidPush()) return;
  const deviceId = await getOrCreateDeviceId();
  await PushNotifications.unregister().catch(() => {});
  const { error } = await supabase.rpc('delete_native_push_token', { p_device_id: deviceId });
  if (error) throw new Error(error.message);
}

function sanitizeTarget(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dashboard';
  const matched = ALLOWED_ROUTE_PREFIXES.some(prefix =>
    raw === prefix || raw.startsWith(`${prefix}?`) || raw.startsWith(`${prefix}/`),
  );
  return matched ? raw : '/dashboard';
}

function stringFromData(data: unknown, key: string): string | null {
  if (!data || typeof data !== 'object') return null;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

export async function addNativePushActionListener(
  navigate: (target: string) => void,
): Promise<PluginListenerHandle | null> {
  if (!isNativeAndroidPush()) return null;
  return PushNotifications.addListener('pushNotificationActionPerformed', (event: ActionPerformed) => {
    const data = event.notification.data as unknown;
    const target = sanitizeTarget(
      stringFromData(data, 'url')
      ?? stringFromData(data, 'fallback_url')
      ?? event.notification.link
      ?? null,
    );
    navigate(target);
  });
}
