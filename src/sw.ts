/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

clientsClaim();
self.skipWaiting();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Never cache Supabase — auth + realtime must always be fresh
registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co'),
  new NetworkOnly(),
);

/**
 * Push payload shape emitted by the `send-nudge` (and future
 * `send-notification`) edge functions. All fields except `title` and
 * `body` are optional so the worker can degrade gracefully.
 */
interface PushPayload {
  notification_id?: string;
  event_key?: string;
  title?: string;
  body?: string;
  url?: string;
  fallback_url?: string;
  tag?: string;
}

// Mirrors the allow-list in src/lib/notifications.ts. Keep in sync if
// new in-app routes are added.
const ALLOWED_ROUTE_PREFIXES = [
  '/dashboard',
  '/add',
  '/check-balance',
  '/saving-plan',
  '/manage-project',
  '/notifications',
  '/profile',
];

function sanitizeTarget(raw: string | null | undefined): string {
  if (!raw) return '/dashboard';
  if (!raw.startsWith('/')) return '/dashboard';
  if (raw.startsWith('//')) return '/dashboard';
  const matched = ALLOWED_ROUTE_PREFIXES.some(prefix =>
    raw === prefix || raw.startsWith(`${prefix}?`) || raw.startsWith(`${prefix}/`),
  );
  return matched ? raw : '/dashboard';
}

function readPushPayload(event: PushEvent): PushPayload {
  if (!event.data) return {};
  try {
    return event.data.json() as PushPayload;
  } catch {
    return { title: 'Project Saving', body: event.data.text() };
  }
}

self.addEventListener('push', (event) => {
  const payload = readPushPayload(event);
  const title = payload.title ?? 'Project Saving';
  const target = sanitizeTarget(payload.url ?? payload.fallback_url);
  const fallback = sanitizeTarget(payload.fallback_url ?? payload.url);
  const options: NotificationOptions = {
    body: payload.body ?? 'Your partner sent a nudge.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.tag,
    data: {
      url: target,
      fallback_url: fallback,
      notification_id: payload.notification_id ?? null,
      event_key: payload.event_key ?? null,
    },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = (event.notification.data ?? {}) as {
    url?: string;
    fallback_url?: string;
  };
  const target = sanitizeTarget(data.url ?? data.fallback_url);

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const targetUrl = new URL(target, self.location.origin).toString();

    // Prefer a client already on the target route — focus only.
    const exact = allClients.find(client => client.url === targetUrl);
    if (exact) {
      await exact.focus();
      return;
    }

    // Otherwise navigate the first available client to the target so
    // the user lands on the right screen instead of wherever they
    // were last.
    const fallbackClient = allClients[0];
    if (fallbackClient) {
      try {
        if ('navigate' in fallbackClient) {
          await fallbackClient.navigate(target);
        }
        await fallbackClient.focus();
        return;
      } catch {
        // navigate() can throw on cross-origin clients; fall through
        // to openWindow.
      }
    }

    await self.clients.openWindow(target);
  })());
});
