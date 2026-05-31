import { Capacitor } from '@capacitor/core';

/**
 * Signals to Capgo's Live Update plugin that the web bundle booted
 * successfully. Capgo applies a downloaded update on the next cold start and,
 * if the app never calls `notifyAppReady()`, automatically rolls back to the
 * previous (bundled) version after a timeout — this guards against shipping a
 * broken OTA update. No-op on the web.
 */
export async function notifyLiveUpdateReady(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    await CapacitorUpdater.notifyAppReady();
  } catch {
    /* plugin unavailable (e.g. web) — nothing to do */
  }
}
