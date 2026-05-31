import { registerPlugin } from '@capacitor/core';

/**
 * Thin bridge to the native Android `WidgetBridge` plugin (implemented in the
 * Android project — see plan phase 4). `refresh()` asks Android to redraw the
 * home-screen widget immediately after the app writes a fresh snapshot, so the
 * widget doesn't wait for its periodic update.
 *
 * The native side is the only implementation; on web (or before the native
 * plugin exists) calls reject and callers swallow the error.
 */
interface WidgetBridgePlugin {
  refresh(): Promise<void>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

export function refreshWidget(): Promise<void> {
  return WidgetBridge.refresh();
}
