import { registerSW } from 'virtual:pwa-register';
import { appVersion } from './version';

const UPDATE_RELOAD_KEY = 'pwaReloadedForVersion';
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

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
      reloadForFreshApp();
    },
    onOfflineReady() {
      if (import.meta.env.DEV) console.info('[pwa] offline cache is ready');
    },
    onRegisteredSW(_swScriptUrl, registration) {
      if (!registration) return;
      void registration.update();
      window.setInterval(() => {
        if (!navigator.onLine) return;
        void registration.update();
      }, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (!navigator.onLine) return;
        void registration.update();
      });
    },
    onRegisterError(error) {
      console.warn('[pwa] service worker registration failed', error);
    },
  });
}

function reloadForFreshApp(): void {
  const version = appVersion();
  try {
    if (window.sessionStorage.getItem(UPDATE_RELOAD_KEY) === version) return;
    window.sessionStorage.setItem(UPDATE_RELOAD_KEY, version);
  } catch {
    // Storage can be blocked in private contexts. Reload anyway so the
    // activated service worker can serve the fresh app shell.
  }
  window.location.reload();
}

async function unregisterDevServiceWorkers(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
  } catch (error) {
    console.warn('[pwa] could not clear development service workers', error);
  }
}
