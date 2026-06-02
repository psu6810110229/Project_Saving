import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'https://esm.sh/web-push@3.6.7';

export const PUSH_SUBSCRIPTION_SELECT =
  'id, user_id, endpoint, p256dh, auth_key, provider, fcm_token';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const FCM_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_CHANNEL_ID = 'goout_updates';

type SupabaseAdmin = ReturnType<typeof createClient>;

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string | null;
  auth_key: string | null;
  provider: 'web' | 'fcm' | null;
  fcm_token: string | null;
}

export interface PushPayload {
  notification_id: string | null;
  event_key: string;
  title: string;
  body: string;
  url: string;
  fallback_url: string;
  tag: string;
}

export interface AttemptRow {
  notification_id: string | null;
  recipient_user_id: string;
  push_subscription_id: string | null;
  channel: 'push';
  status: 'sent' | 'failed' | 'expired' | 'skipped';
  error_code: string | null;
  error_message: string | null;
}

export interface PushDeliveryResult {
  attempted: number;
  delivered: number;
  attempts: AttemptRow[];
  errors: string[];
}

interface FirebaseServiceAccount {
  client_email: string;
  private_key: string;
  project_id?: string;
}

let cachedFcmToken: { accessToken: string; expiresAtMs: number } | null = null;

function base64Url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function signJwt(serviceAccount: FirebaseServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: serviceAccount.client_email,
    scope: FCM_SCOPE,
    aud: FCM_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

async function getFcmAccessToken(): Promise<string> {
  if (cachedFcmToken && cachedFcmToken.expiresAtMs > Date.now() + 60_000) {
    return cachedFcmToken.accessToken;
  }

  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
  const serviceAccount = JSON.parse(raw) as FirebaseServiceAccount;
  const assertion = await signJwt(serviceAccount);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetch(FCM_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await response.json().catch(() => ({})) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description ?? `FCM auth failed (${response.status})`);
  }

  cachedFcmToken = {
    accessToken: json.access_token,
    expiresAtMs: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedFcmToken.accessToken;
}

function fcmData(payload: PushPayload): Record<string, string> {
  return {
    notification_id: payload.notification_id ?? '',
    event_key: payload.event_key,
    url: payload.url,
    fallback_url: payload.fallback_url,
    tag: payload.tag,
  };
}

function isExpiredFcmError(status: number, body: string): boolean {
  return status === 404
    || status === 410
    || body.includes('UNREGISTERED')
    || body.includes('registration-token-not-registered');
}

async function sendFcm(token: string, payload: PushPayload): Promise<Response> {
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID')
    ?? (JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') ?? '{}') as FirebaseServiceAccount).project_id;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is not configured');
  const accessToken = await getFcmAccessToken();
  return fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: fcmData(payload),
        android: {
          notification: {
            channel_id: FCM_CHANNEL_ID,
            tag: payload.tag,
          },
        },
      },
    }),
  });
}

export async function deliverPushToSubscriptions(
  admin: SupabaseAdmin,
  recipientUserId: string,
  notificationId: string | null,
  subscriptions: PushSubscriptionRow[],
  payload: PushPayload,
): Promise<PushDeliveryResult> {
  const attempts: AttemptRow[] = [];
  const errors: string[] = [];
  let delivered = 0;
  let attempted = 0;

  if (subscriptions.length === 0) {
    attempts.push({
      notification_id: notificationId,
      recipient_user_id: recipientUserId,
      push_subscription_id: null,
      channel: 'push',
      status: 'skipped',
      error_code: 'no_device',
      error_message: null,
    });
    return { attempted, delivered, attempts, errors };
  }

  const webPayload = JSON.stringify(payload);
  await Promise.all(subscriptions.map(async (sub) => {
    attempted += 1;
    try {
      if ((sub.provider ?? 'web') === 'fcm') {
        if (!sub.fcm_token) throw new Error('missing FCM token');
        const response = await sendFcm(sub.fcm_token, payload);
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          if (isExpiredFcmError(response.status, text)) {
            await admin.from('push_subscriptions').delete().eq('id', sub.id);
            attempts.push({
              notification_id: notificationId,
              recipient_user_id: recipientUserId,
              push_subscription_id: null,
              channel: 'push',
              status: 'expired',
              error_code: String(response.status),
              error_message: null,
            });
            return;
          }
          throw new Error(text.slice(0, 500) || `FCM send failed (${response.status})`);
        }
      } else {
        if (!sub.p256dh || !sub.auth_key) throw new Error('missing Web Push keys');
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          webPayload,
        );
      }

      delivered += 1;
      attempts.push({
        notification_id: notificationId,
        recipient_user_id: recipientUserId,
        push_subscription_id: sub.id,
        channel: 'push',
        status: 'sent',
        error_code: null,
        error_message: null,
      });
    } catch (error) {
      const status = typeof error === 'object' && error && 'statusCode' in error
        ? Number((error as { statusCode: number }).statusCode)
        : 0;
      const message = error instanceof Error
        ? error.message.slice(0, 500)
        : 'push failed';
      if ((sub.provider ?? 'web') === 'web' && (status === 404 || status === 410)) {
        await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        attempts.push({
          notification_id: notificationId,
          recipient_user_id: recipientUserId,
          push_subscription_id: null,
          channel: 'push',
          status: 'expired',
          error_code: String(status),
          error_message: null,
        });
      } else {
        errors.push(`${sub.endpoint.slice(0, 32)}...: ${message}`);
        attempts.push({
          notification_id: notificationId,
          recipient_user_id: recipientUserId,
          push_subscription_id: sub.id,
          channel: 'push',
          status: 'failed',
          error_code: status ? String(status) : null,
          error_message: message,
        });
      }
    }
  }));

  return { attempted, delivered, attempts, errors };
}

export function configureWebPush(): void {
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@example.com';
  if (vapidPublic && vapidPrivate) {
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  }
}
