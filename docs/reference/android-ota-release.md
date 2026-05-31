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

---

# Building & distributing the APK (no Play Store)

Requires the Android SDK + JDK (Android Studio). The first APK and any later
**native** change is built and sideloaded directly.

## One-time: signing key
```bash
keytool -genkey -v -keystore goout-release.keystore \
  -alias goout -keyalg RSA -keysize 2048 -validity 10000
```
Then `cp keystore.properties.example keystore.properties` and fill in the real
`storePassword` / `keyPassword`. Both `goout-release.keystore` and
`keystore.properties` are gitignored — **back them up somewhere safe**. Losing
the key means future APKs can't update an already-installed app (users must
uninstall + reinstall).

`android/app/build.gradle` reads `keystore.properties` automatically; without
it the release build falls back to debug signing (fine for local testing).

## Build a release APK
```bash
npm run build            # web bundle into dist/
npx cap sync android     # copy dist/ + plugins into the Android project
cd android && ./gradlew assembleRelease
# -> android/app/build/outputs/apk/release/app-release.apk
```
For a quick unsigned test build: `./gradlew assembleDebug`.

## Versioning
Bump `versionCode` (integer, must increase each release) and `versionName`
in `android/app/build.gradle` before building an APK users will upgrade onto.

## Distribute (sideload)
Share `app-release.apk` via a download link / QR / chat. On the phone:
Settings → allow "install from unknown sources" for the browser/file app, then
open the APK to install. The home-screen widget then appears under
long-press → Widgets → GO-OUT.

## When to rebuild the APK vs. ship OTA
- **OTA (Capgo bundle upload):** any web/UI/bug fix. No new APK.
- **New APK:** native changes — the widget, `goout://` scheme,
  `WidgetBridgePlugin`, launcher icon, permissions, Capacitor/plugin upgrades,
  or a `versionCode`/`versionName` bump.
