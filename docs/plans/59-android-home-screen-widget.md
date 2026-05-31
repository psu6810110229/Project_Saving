# 59 — Android Home-Screen Widget (Capacitor APK)

Status: Planned (no code yet)
Owner: front-end/full-stack
Branch: `claude/app-review-summary-vyxPj`

## Goal

Ship an Android **home-screen widget** for GO-OUT, modeled on the Thai-bank
"Receive by QR" widget the user referenced: a compact card that **shows live
savings data** and has **tappable buttons that deep-link straight into the exact
app section** (e.g. Add deposit, Check balance).

Because the app is currently a **browser PWA only**, this requires wrapping it in
a real installable Android app (APK) — Android only lists widgets from installed
apps, never from a "Add to Home Screen" PWA shortcut.

## Locked Spec

- **Packaging:** Capacitor → real Android app.
- **Distribution:** sideloaded **APK** (download link / QR / chat). **No Play Store** for now.
- **UI source:** web bundle **bundled inside the APK** (offline-capable), not loaded from Vercel URL.
- **Backend:** **Supabase unchanged.** Vercel keeps serving the existing browser PWA in parallel.
- **Updates:** **OTA Live Updates via Capgo** (open-source, self-hostable). Deploy → app users auto-update for UI/bug fixes, just like the PWA today. A new APK is only needed when **native** code (the widget, icon, permissions) changes.
- **Widget sizes:** **4×2** (full) and **2×2** (compact).
- **Widget data:** saved vs personal goal + progress %, and 🔥 current streak.
- **Widget buttons:** **＋ Add deposit** → `/add`, **✓ Check balance** → `/reconcile`; tapping the card body → dashboard `/`.

## Architecture

```
Android phone (installed APK)
 ├─ WebView: bundled React UI (dist/)        ← runs locally, offline OK
 │    └─ OTA Live Updates (Capgo) refresh the JS bundle on launch
 ├─ Native AppWidgetProvider (Kotlin)        ← the home-screen widget
 │    ├─ reads a cached snapshot (saved/goal/streak/last-check)
 │    └─ buttons fire PendingIntents → deep links
 └─ Data: ───────────────────────────► Supabase (unchanged)

Vercel: keeps serving the browser PWA for web users (untouched)
```

Key principle: **the widget never talks to Supabase directly.** The running app
writes a small JSON snapshot to shared storage; the widget only renders that
snapshot. This keeps auth/RLS entirely inside the app and makes the widget fast
and offline-safe.

## Work Breakdown

### Phase 1 — Capacitor shell (makes it an APK)
1. Add deps: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`.
2. `npx cap init` → app name `GO-OUT`, app ID e.g. `com.goout.app`.
3. `npx cap add android` → generates the `android/` Gradle project.
4. Confirm `npm run build` → `npx cap sync` copies `dist/` into the shell.
5. Build + install APK on a test phone; verify the app runs and hits Supabase.
   - Deep-link verification deferred to Phase 4.

Deliverable: a sideloadable APK that runs the current app. No widget yet.

### Phase 2 — Snapshot mechanism (feeds the widget its numbers)
The widget needs data even when the app is closed. The app writes a snapshot the
native side can read.

1. Define the snapshot shape (single source of truth for the widget):
   ```ts
   interface WidgetSnapshot {
     roomName: string;
     savedAmount: number;        // verified balance (source of truth)
     goalTarget: number;         // personal sub-goal
     progressPct: number;        // 0–100
     streak: number;
     streakUnit: 'day' | 'week' | 'month';
     daysSinceCheck: number | null;
     currency: string;
     updatedAt: string;          // ISO
   }
   ```
2. Source the values from existing hooks (no new RPCs):
   - `useReconcile` → `current_reconciled_balance` (savedAmount)
   - `useGoal` → personal goal target
   - `useStreak` → streak + unit
   - reconcile latest checkpoint → daysSinceCheck
3. Write the snapshot whenever the dashboard data settles (debounced), via a
   tiny Capacitor plugin call into native `SharedPreferences` (the storage the
   Android widget reads). Keep this in a focused helper, e.g.
   `src/lib/widgetSnapshot.ts`.
4. Trigger a widget refresh broadcast after each write.

Guardrail: snapshot is **display-only**, derived from already-visible numbers.
No mixing of Recorded Deposits / Verified Balance / Planned Balance beyond what
the dashboard already shows.

### Phase 3 — Native widget (the visible card)
1. `AppWidgetProvider` (Kotlin) under `android/.../widget/SavingsWidget.kt`.
2. Two layouts:
   - **4×2** `widget_savings_4x2.xml`: room name + streak, `฿saved / ฿goal`,
     progress bar, `progressPct`, two buttons (Add / Check).
   - **2×2** `widget_savings_2x2.xml`: `progressPct` + saved, single Add button.
3. Register in `AndroidManifest.xml`:
   `<receiver android:name=".widget.SavingsWidget">` + `appwidget-provider`
   meta-data (resizable size range, preview image, update period).
4. Render from the snapshot in `SharedPreferences`; empty/first-run state shows
   "Open GO-OUT to sync".
5. Style with app tokens (brand/surface/ink) so it matches the product.

Deliverable: widget appears in long-press → Widgets → GO-OUT, draggable, shows data.

### Phase 4 — Deep links (buttons open the exact section)
1. Define scheme + routes: `goout://add`, `goout://reconcile`, `goout://` (dash).
2. Register an intent-filter in `AndroidManifest.xml` for the scheme.
3. Each widget button = a `PendingIntent` carrying the target deep link.
4. App side: handle the incoming URL (Capacitor `App.addListener('appUrlOpen')`)
   and `navigate()` to the matching React Router route. Keep this in a small
   bootstrap helper; do not refactor the router.
5. Verify cold-start (app closed) and warm-start (app backgrounded) both land on
   the right screen.

### Phase 5 — OTA Live Updates (keep auto-update workflow)
1. Add Capgo (`@capgo/capacitor-updater`); configure self-hosted or Capgo cloud.
2. On app launch, check for and apply the latest web bundle.
3. CI/release: on Vercel-style web deploy, also publish the bundle to Capgo so
   installed apps auto-update.
4. Document: native/widget changes still require a fresh APK; UI/bug fixes do not.
   - Alternative noted: Ionic Appflow (paid) if Capgo is unsuitable.

### Phase 6 — Build, sign, distribute
1. Generate a signing key; configure release signing in Gradle.
2. Build release APK.
3. Distribute via direct link / QR. Document the "install from unknown sources"
   one-time step for users.

## Out of Scope (explicitly)
- Play Store publishing.
- iOS widget (separate effort).
- Any change to Supabase schema, RLS, RPCs, deposit flow, or money-state rules.
- Realtime data inside the widget (snapshot-based by design).
- Negative logs, bucket correction, reconcile allocation — untouched.

## Risks / Notes
- First widget add before any app open shows an empty state until the first sync.
- Snapshot freshness depends on the app having been opened/synced; acceptable for
  a glanceable widget. Optionally add a periodic background refresh later.
- New native release path (signing, APK hosting) is net-new ops, but small.
- Keep the web app 100% functional as a PWA throughout; Capacitor is additive.

## Checks before done
- `npm run build` passes.
- `npm run lint` passes where practical.
- APK installs and runs on a physical Android device.
- Widget shows correct saved/goal/streak from a logged-in account.
- Each button deep-links to the correct screen (cold + warm start).
- OTA update delivers a UI change without reinstalling the APK.
