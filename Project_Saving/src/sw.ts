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

interface NudgePushPayload {
  title?: string;
  body?: string;
  url?: string;
}

// Web Push handler for the Phase 6.8 nudge feature. The edge function
// posts a JSON payload via Web Push; we surface it as a system
// notification that opens (or focuses) the dashboard when tapped.
function readPushPayload(event: PushEvent): NudgePushPayload {
  if (!event.data) return {};
  try {
    return event.data.json() as NudgePushPayload;
  } catch {
    return { title: 'Project Saving', body: event.data.text() };
  }
}

self.addEventListener('push', (event) => {
  const payload = readPushPayload(event);
  const title = payload.title ?? 'Project Saving';
  const options: NotificationOptions = {
    body: payload.body ?? 'Your partner sent a nudge.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: { url: payload.url ?? '/dashboard' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data as { url?: string } | undefined)?.url ?? '/dashboard';
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const focused = allClients.find(client => client.url.includes(target));
    if (focused) { await focused.focus(); return; }
    if (allClients[0]) { await allClients[0].focus(); return; }
    await self.clients.openWindow(target);
  })());
});
