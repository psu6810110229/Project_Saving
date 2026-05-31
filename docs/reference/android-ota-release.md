# Android OTA Live Updates (Capgo) — Release Runbook

The Android app (Capacitor APK, app id `com.goout.app`) ships its web UI as a
bundle that **Capgo updates over-the-air**. UI/bug fixes reach installed apps
without a new APK; a new APK is only needed when **native** code changes
(the widget, deep-link scheme, plugins, icon, permissions).

## How it works
- `capacitor.config.ts` → `plugins.CapacitorUpdater` runs in `autoUpdate` mode.
- On launch/resume the plugin checks the configured channel for a newer bundle,
  downloads it, and applies it on the next cold start (`directUpdate: true`).
- `src/lib/liveUpdate.ts` calls `CapacitorUpdater.notifyAppReady()` on boot. If
  a bundle fails to boot and never calls this, Capgo **rolls back** to the last
  good (or APK-bundled) version. This is the safety net.

## One-time account setup (not in repo — needs your Capgo account)
1. Create a Capgo account and an app keyed to `com.goout.app`.
2. `npm i -g @capgo/cli` (or use `npx @capgo/cli`).
3. `npx @capgo/cli login <YOUR_API_KEY>` — the API key is a **secret**; never commit it.
4. `npx @capgo/cli app add com.goout.app` (first time only).
5. Decide a channel (e.g. `production`) and set it as default in the dashboard.

## Per-release flow (UI / bug fix — no APK)
```bash
npm run build                      # produce dist/
npx @capgo/cli bundle upload \
  --channel production \
  --path dist
```
Installed apps pick up the new bundle on their next launch.

## When a new APK IS required (native change)
Anything under `android/` that isn't the web bundle: the widget, the
`goout://` scheme, `WidgetBridgePlugin`, the launcher icon, permissions, or a
Capacitor plugin upgrade. Then rebuild and redistribute the APK (see plan
phase 6).

## Notes
- Keep the bundled APK web version and the Capgo channel in sync at release
  time so a fresh install isn't immediately downgraded/upgraded unexpectedly.
- Alternative provider if Capgo is unsuitable: Ionic Appflow Live Updates (paid).
