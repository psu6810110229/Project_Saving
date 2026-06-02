import { registerPlugin } from '@capacitor/core';
import type { WidgetSnapshot } from './widgetSnapshot';

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
  refresh(options?: { snapshot?: string }): Promise<void>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

export function refreshWidget(snapshot?: WidgetSnapshot): Promise<void> {
  return WidgetBridge.refresh(
    snapshot == null ? undefined : { snapshot: JSON.stringify(snapshot) },
  );
}
