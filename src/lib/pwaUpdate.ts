import { registerSW } from 'virtual:pwa-register';
import { appVersion } from './version';

const UPDATE_RELOAD_KEY = 'pwaReloadedForVersion';
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

let lastUpdateCheckAt = 0;
let pendingReload = false;
let navigationHooksInstalled = false;

export function registerAppServiceWorker(): void {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) {
    void unregisterDevServiceWorkers();
    return;
  }

  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateServiceWorker(true);
    },
    onNeedReload() {
      // Defer reload until the user navigates so returning to the app
      // from another tab/app does not refresh mid-screen.
      schedulePendingReload();
    },
    onOfflineReady() {
      if (import.meta.env.DEV) console.info('[pwa] offline cache is ready');
    },
    onRegisteredSW(_swScriptUrl, registration) {
      if (!registration) return;
      requestUpdateCheck(registration);
      window.setInterval(() => {
        if (!navigator.onLine) return;
        requestUpdateCheck(registration);
      }, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (!navigator.onLine) return;
        requestUpdateCheck(registration);
      });
      installNavigationReloadHooks();
    },
    onRegisterError(error) {
      console.warn('[pwa] service worker registration failed', error);
    },
  });
}

function requestUpdateCheck(registration: ServiceWorkerRegistration): void {
  const now = Date.now();
  // Throttle so frequent visibility changes do not spam update checks.
  if (now - lastUpdateCheckAt < UPDATE_CHECK_INTERVAL_MS) return;
  lastUpdateCheckAt = now;
  void registration.update();
}

function schedulePendingReload(): void {
  const version = appVersion();
  try {
    if (window.sessionStorage.getItem(UPDATE_RELOAD_KEY) === version) return;
  } catch {
    // Session storage can be blocked in private contexts; fall through
    // and rely on the in-memory flag to gate the reload.
  }
  pendingReload = true;
}

function installNavigationReloadHooks(): void {
  if (navigationHooksInstalled) return;
  navigationHooksInstalled = true;

  const reloadIfPending = (): void => {
    if (!pendingReload) return;
    pendingReload = false;
    const version = appVersion();
    try {
      window.sessionStorage.setItem(UPDATE_RELOAD_KEY, version);
    } catch {
      // Storage can be blocked; reload anyway so the activated worker
      // serves the fresh app shell.
    }
    window.location.reload();
  };

  const wrapHistoryMethod = (method: 'pushState' | 'replaceState'): void => {
    const original = window.history[method].bind(window.history);
    window.history[method] = function (
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ) {
      original(data, unused, url);
      reloadIfPending();
    } as History[typeof method];
  };
  wrapHistoryMethod('pushState');
  wrapHistoryMethod('replaceState');
  window.addEventListener('popstate', reloadIfPending);
}

async function unregisterDevServiceWorkers(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
  } catch (error) {
    console.warn('[pwa] could not clear development service workers', error);
  }
}
