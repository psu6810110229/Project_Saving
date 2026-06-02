import { registerSW } from 'virtual:pwa-register';
import { appVersion } from './version';

const UPDATE_RELOAD_KEY = 'pwaReloadedForVersion';
const RELEASE_MODAL_SKIP_ONCE_KEY = 'releaseSkipOnceAfterAppUpdate';
const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

let lastUpdateCheckAt = 0;
let updateReady = false;
let updateSWFn: ((reloadPage?: boolean) => Promise<void>) | null = null;
const updateListeners = new Set<() => void>();

export function registerAppServiceWorker(): void {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) {
    void unregisterDevServiceWorkers();
    return;
  }

  updateSWFn = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateReady = true;
      notifyUpdateListeners();
    },
    onNeedReload() {
      // If an already-active worker asks for a reload, record it but
      // avoid forcing a refresh while the user is in the app.
      rememberReloadForCurrentVersion();
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
    },
    onRegisterError(error) {
      console.warn('[pwa] service worker registration failed', error);
    },
  });
}

export function subscribeAppUpdate(listener: () => void): () => void {
  updateListeners.add(listener);
  // Fire immediately if a waiting worker was registered before the
  // subscriber mounted (race between SW registration and React render).
  if (updateReady) listener();
  return () => {
    updateListeners.delete(listener);
  };
}

export function isAppUpdateReady(): boolean {
  return updateReady;
}

export function skipReleaseModalOnceAfterUpdate(): void {
  try {
    window.sessionStorage.setItem(RELEASE_MODAL_SKIP_ONCE_KEY, '1');
  } catch {
    // Storage may be unavailable; the release modal will follow its
    // normal rules after the update reload.
  }
}

export function consumeReleaseModalSkipOnceAfterUpdate(): boolean {
  try {
    const shouldSkip = window.sessionStorage.getItem(RELEASE_MODAL_SKIP_ONCE_KEY) !== null;
    if (shouldSkip) window.sessionStorage.removeItem(RELEASE_MODAL_SKIP_ONCE_KEY);
    return shouldSkip;
  } catch {
    return false;
  }
}

export async function applyAppUpdate(): Promise<void> {
  if (!updateSWFn) {
    window.location.reload();
    return;
  }
  // updateSWFn(true) posts SKIP_WAITING and installs its own
  // `controllerchange` handler that reloads the page once the new worker
  // claims clients (skipWaiting + clients.claim in sw.ts). We must NOT also
  // call window.location.reload(): two competing programmatic reloads make
  // the installed PWA repaint against an unsettled viewport, which clips the
  // bottom nav below the fold until a manual refresh. So we let the single
  // controllerchange reload happen and keep a timer only as a fallback for
  // the rare case where controllerchange never fires.
  const fallbackReload = window.setTimeout(() => {
    window.location.reload();
  }, 3000);

  try {
    await updateSWFn(true);
    // Intentionally leave fallbackReload armed: the controllerchange reload
    // discards it by navigating away; if that never happens, it recovers.
  } catch (error) {
    window.clearTimeout(fallbackReload);
    console.warn('[pwa] update failed, falling back to reload', error);
    window.location.reload();
  }
}

function notifyUpdateListeners(): void {
  updateListeners.forEach(listener => {
    try {
      listener();
    } catch (error) {
      console.warn('[pwa] update listener failed', error);
    }
  });
}

function requestUpdateCheck(registration: ServiceWorkerRegistration): void {
  if (updateReady) return;
  const now = Date.now();
  // Throttle so frequent visibility changes do not spam update checks.
  if (now - lastUpdateCheckAt < UPDATE_CHECK_INTERVAL_MS) return;
  lastUpdateCheckAt = now;
  void registration.update();
}

function rememberReloadForCurrentVersion(): void {
  const version = appVersion();
  try {
    window.sessionStorage.setItem(UPDATE_RELOAD_KEY, version);
  } catch {
    // Storage can be blocked in private contexts; no action is needed
    // because we intentionally avoid automatic reloads.
  }
}

async function unregisterDevServiceWorkers(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
  } catch (error) {
    console.warn('[pwa] could not clear development service workers', error);
  }
}
