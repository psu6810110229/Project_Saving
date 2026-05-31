# 59 — Android Home-Screen Widget (Capacitor APK)

Status: Ready to implement
Branch: `claude/app-review-summary-vyxPj`

## Goal

Ship an Android home-screen widget for GO-OUT modeled on the Thai-bank
"Receive by QR" widget: a card that shows live savings data and has tappable
buttons that deep-link straight into the exact app section. Android only lists
widgets from installed apps, so the app must become a real APK (Capacitor).

## Locked decisions

- Packaging: **Capacitor** → real Android app.
- Distribution: sideloaded **APK** (link/QR). No Play Store.
- UI: web bundle **bundled inside the APK** (offline-capable). Vercel keeps serving the browser PWA in parallel.
- Backend: **Supabase unchanged.**
- Updates: **OTA via Capgo** for UI/bug fixes. New APK only when native code changes.
- Widget sizes: **4×2** (full) and **2×2** (compact).
- Widget data: saved vs personal goal + %, and 🔥 streak.
- Widget buttons: **＋ Add deposit** → opens deposit sheet for the focus bucket; **✓ Check balance** → opens Check Balance sheet; card body → dashboard.

## Hard facts this plan is built on (verified in repo)

- Router: `BrowserRouter` in `src/App.tsx:53`. Capacitor's Android WebView serves from `https://localhost`, so `BrowserRouter` works unchanged.
- Entry: `src/main.tsx` renders `<App />` into `#root`; registers SW via `registerAppServiceWorker()`.
- `/add` and `/saving-plan` **redirect to `/dashboard`** (`src/App.tsx:77-78`). There is **no `/reconcile` route**.
- **Add deposit** = `setExpandedBucketId(bucketId)` → `<BucketSheet open={Boolean(expandedBucketId)}>` (`src/pages/Dashboard.tsx:274,1620-1692`).
- **Check balance** = `setCheckBalanceOpen(true)` + `setCheckBalanceMode('check')` → `<CheckBalanceSheet>` (`src/pages/Dashboard.tsx:278-279,1563-1567`).
- **No URL/query-param entry point exists** for these modals → we must add one (see Phase 2).
- Data hooks & fields:
  - `useReconcile(roomId)` → `appBalance: number | null` (Verified Balance, source of truth). `src/hooks/useReconcile.ts`. Latest checkpoint = `latest`.
  - `useGoal(roomId)` → `personalGoalTarget: number | null`. `src/hooks/useGoal.ts`.
  - `useStreak(userId, logs, frozen, buckets, transfers)` → `{ streak, hasLoggedToday, unit, trackable }`. `src/hooks/useStreak.ts`.
  - Active room: `useRoom()` → `activeRoomId`, `activeRoom` (`activeRoom.name`). Persisted in `localStorage['activeRoomId']`.
  - Auth: `useAuth()` → `user`.
  - Aggregator: `useSharedData()` exposes `reconcile`, `goal`, `logs`, `buckets`, `streakFreeze`, etc. (`src/components/DataContext/DataContextValue.ts`).
- Money format: `formatCurrency(n)` in `src/lib/format.ts` → `'฿' + n.toLocaleString('th-TH', {maximumFractionDigits:0})`.
- Supabase singleton: `src/lib/supabase.ts` (`supabase`). Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- localStorage helper pattern: `src/hooks/useLocalStorageState.ts`; key convention `go-out:*`.
- PWA manifest (`vite.config.ts:17-40`): name `GO-OUT`, theme/bg `#FBF6F0`, icons `/icon-192.png`, `/icon-512.png`, `/icon-maskable-512.png`.
- Tokens (`tailwind.config.js`): `bg #FBF6F0`, `surface #FFFFFF`, `ink #2A1A0E`, `brand.500 #F26B1A`, `brand.800 #8E3F0D`, `accent.teal #2EA079`, `danger #B3331E`.
- App version: `package.json` `1.0.0`. App ID: **`com.goout.app`** (final, since no store rename concerns).

---

## Phase 1 — Capacitor shell (produces the APK)

Commands:
```bash
npm i @capacitor/core @capacitor/app @capacitor/preferences
npm i -D @capacitor/cli @capacitor/android
npx cap init "GO-OUT" "com.goout.app" --web-dir=dist
npm run build
npx cap add android
npx cap sync
```

`capacitor.config.ts` (repo root):
```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.goout.app',
  appName: 'GO-OUT',
  webDir: 'dist',
  android: { backgroundColor: '#FBF6F0' },
  // No server.url → files run locally inside the APK (offline-capable).
};

export default config;
```

`package.json` scripts to add:
```json
"cap:sync": "npm run build && npx cap sync android",
"cap:open": "npx cap open android"
```

Verify: build + install debug APK on a phone, log in, confirm Supabase loads.
Supabase OAuth redirect: add `com.goout.app://auth/callback` and `https://localhost`
to Supabase Auth → URL config if Google login is used in-app (test; email login is unaffected).

Deliverable: sideloadable APK running the current app. No widget yet.

---

## Phase 2 — Deep-link entry point (web change, required)

This is the only change to existing app code. It lets a URL open the two modals.

### 2a. Dashboard query-param handler
Edit `src/pages/Dashboard.tsx`. Add near the other hooks:
```ts
import { useSearchParams } from 'react-router-dom';
// ...
const [searchParams, setSearchParams] = useSearchParams();

useEffect(() => {
  const action = searchParams.get('action');
  if (!action) return;

  if (action === 'deposit') {
    // open the focus bucket (own bucket with intent 'focus'); fallback: first own bucket
    const focus = ownBuckets.find(b => b.intent === 'focus') ?? ownBuckets[0];
    if (focus) setExpandedBucketId(focus.id);
  } else if (action === 'check-balance') {
    setCheckBalanceMode('check');
    setCheckBalanceOpen(true);
  }

  // consume the param so it doesn't re-fire on re-render/back
  const next = new URLSearchParams(searchParams);
  next.delete('action');
  setSearchParams(next, { replace: true });
}, [searchParams]); // intentionally minimal deps; runs once per action arrival
```
Use the existing variable that holds the user's own buckets (the array already
mapped to bucket cards on the Dashboard) for `ownBuckets`; reuse it, do not
refetch. If buckets aren't loaded yet when the param arrives, guard with the
existing loading flag and let the effect re-run when they populate (add the
buckets array to deps in that case).

Web deep-link URLs now work:
- `/dashboard?action=deposit`
- `/dashboard?action=check-balance`

### 2b. Native deep-link listener
The widget fires a custom-scheme URL; route it to the param URL above.
Add to `src/App.tsx` (inside a component under `BrowserRouter`, e.g. a tiny
`DeepLinkListener` rendered near the routes, or in `AppLayout`):
```ts
import { App as CapApp } from '@capacitor/app';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function DeepLinkListener() {
  const navigate = useNavigate();
  useEffect(() => {
    const sub = CapApp.addListener('appUrlOpen', ({ url }) => {
      // url like: goout://dashboard?action=deposit
      const u = new URL(url);
      const path = u.hostname + u.pathname; // 'dashboard'
      navigate('/' + path.replace(/^\/+/, '') + (u.search || ''));
    });
    return () => { sub.then(s => s.remove()); };
  }, [navigate]);
  return null;
}
```
Guard for web (no Capacitor): wrap in `Capacitor.isNativePlatform()` check, or
rely on the listener simply never firing in the browser.

### 2c. Register custom scheme (native, Phase 3 manifest)
Intent-filter for `goout://` is added in `AndroidManifest.xml` (see Phase 3).

---

## Phase 3 — Snapshot writer (feeds the widget)

The widget reads a cached snapshot from Android `SharedPreferences`.
`@capacitor/preferences` writes there automatically (file `CapacitorStorage`).

### 3a. Snapshot type + writer
New file `src/lib/widgetSnapshot.ts`:
```ts
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

export interface WidgetSnapshot {
  roomName: string;
  saved: number;          // verified balance (appBalance)
  goal: number;           // personalGoalTarget (0 if unset)
  progressPct: number;    // 0–100, clamped
  streak: number;
  streakUnit: 'day' | 'week' | 'month';
  hasLoggedToday: boolean;
  updatedAt: string;      // ISO
}

const KEY = 'widget_snapshot';

export async function writeWidgetSnapshot(s: WidgetSnapshot): Promise<void> {
  if (!Capacitor.isNativePlatform()) return; // no-op in browser
  await Preferences.set({ key: KEY, value: JSON.stringify(s) });
  // trigger immediate widget redraw (Phase 4 native bridge)
  try { await (await import('./widgetBridge')).refreshWidget(); } catch { /* noop */ }
}
```

### 3b. Where to call it
New hook `src/hooks/useWidgetSync.ts`, mounted once inside the data-context
subtree (e.g. in `AppLayout` where `useSharedData()` is available):
```ts
export function useWidgetSync() {
  const { reconcile, goal, streakFreeze, logs, buckets, bucketTransfers } = useSharedData();
  const { activeRoom } = useRoom();
  const { user } = useAuth();
  const streak = useStreak(user?.id, logs.logs, /* frozen */ undefined, buckets.buckets, bucketTransfers.transfers);

  useEffect(() => {
    const saved = reconcile.appBalance ?? 0;
    const target = goal.personalGoalTarget ?? 0;
    const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
    void writeWidgetSnapshot({
      roomName: activeRoom?.name ?? 'GO-OUT',
      saved, goal: target, progressPct: pct,
      streak: streak.streak, streakUnit: streak.unit as WidgetSnapshot['streakUnit'],
      hasLoggedToday: streak.hasLoggedToday,
      updatedAt: new Date().toISOString(),
    });
  }, [reconcile.appBalance, goal.personalGoalTarget, streak.streak, streak.unit, streak.hasLoggedToday, activeRoom?.name]);
}
```
Match the real field names/args when wiring (e.g. `streakFreeze` frozen-dates
set if `useStreak` expects it). Snapshot is **display-only**, derived from
numbers already shown on the dashboard — no new RPCs, no money-state mixing.

---

## Phase 4 — Native widget + refresh bridge

All files under `android/app/src/main/`.

### 4a. Minimal Capacitor plugin for instant refresh
`java/com/goout/app/WidgetBridgePlugin.java`:
```java
package com.goout.app;
import com.getcapacitor.Plugin; import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod; import com.getcapacitor.annotation.CapacitorPlugin;
import android.content.Intent; import android.appwidget.AppWidgetManager;
import android.content.ComponentName;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {
  @PluginMethod
  public void refresh(PluginCall call) {
    AppWidgetManager mgr = AppWidgetManager.getInstance(getContext());
    ComponentName cn = new ComponentName(getContext(), SavingsWidget.class);
    int[] ids = mgr.getAppWidgetIds(cn);
    Intent i = new Intent(getContext(), SavingsWidget.class);
    i.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
    i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
    getContext().sendBroadcast(i);
    call.resolve();
  }
}
```
Register it in `MainActivity.java` `onCreate` via `registerPlugin(WidgetBridgePlugin.class)`.
Web side `src/lib/widgetBridge.ts`:
```ts
import { registerPlugin } from '@capacitor/core';
const WidgetBridge = registerPlugin<{ refresh(): Promise<void> }>('WidgetBridge');
export const refreshWidget = () => WidgetBridge.refresh();
```

### 4b. Provider `java/com/goout/app/SavingsWidget.java`
```java
package com.goout.app;
import android.app.PendingIntent; import android.appwidget.*; import android.content.*;
import android.net.Uri; import android.widget.RemoteViews; import org.json.JSONObject;

public class SavingsWidget extends AppWidgetProvider {
  @Override public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
    SharedPreferences sp = ctx.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
    String raw = sp.getString("widget_snapshot", null);
    String room = "GO-OUT"; long saved = 0, goal = 0; int pct = 0, streak = 0;
    if (raw != null) try {
      JSONObject j = new JSONObject(raw);
      room = j.optString("roomName", "GO-OUT");
      saved = j.optLong("saved"); goal = j.optLong("goal");
      pct = j.optInt("progressPct"); streak = j.optInt("streak");
    } catch (Exception ignored) {}

    for (int id : ids) {
      RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_savings_4x2);
      v.setTextViewText(R.id.w_room, room);
      v.setTextViewText(R.id.w_amount, "฿" + String.format("%,d", saved) + " / ฿" + String.format("%,d", goal));
      v.setTextViewText(R.id.w_streak, "🔥 " + streak);
      v.setProgressBar(R.id.w_progress, 100, pct, false);
      v.setTextViewText(R.id.w_pct, pct + "%");
      v.setOnClickPendingIntent(R.id.w_add, deep(ctx, "goout://dashboard?action=deposit", 1));
      v.setOnClickPendingIntent(R.id.w_check, deep(ctx, "goout://dashboard?action=check-balance", 2));
      v.setOnClickPendingIntent(R.id.w_card, deep(ctx, "goout://dashboard", 3));
      mgr.updateAppWidget(id, v);
    }
  }
  private PendingIntent deep(Context ctx, String url, int req) {
    Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
    i.setPackage(ctx.getPackageName());
    return PendingIntent.getActivity(ctx, req, i,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }
}
```

### 4c. Layout `res/layout/widget_savings_4x2.xml`
LinearLayout card (id `w_card`) styled with bg `#FBF6F0`, rounded background
drawable, ink `#2A1A0E`:
- Row: `w_room` (TextView) + `w_streak` (TextView, right).
- `w_amount` (TextView, bold).
- `w_progress` (ProgressBar horizontal, tint `brand.500 #F26B1A`) + `w_pct`.
- Button row: `w_add` ("＋ Add"), `w_check` ("✓ Check") — TextViews with rounded bg.
Add `res/drawable/widget_bg.xml` (rounded rect, `#FBF6F0`) and
`res/drawable/widget_btn.xml` (rounded, `#FFFFFF`).
Create a compact `res/layout/widget_savings_2x2.xml`: `w_pct` large + saved +
single `w_add`. Wire 2×2 with the same ids it uses.

### 4d. Provider config `res/xml/savings_widget_info.xml`
```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:minWidth="250dp" android:minHeight="110dp"
  android:targetCellWidth="4" android:targetCellHeight="2"
  android:minResizeWidth="110dp" android:minResizeHeight="110dp"
  android:resizeMode="horizontal|vertical"
  android:updatePeriodMillis="1800000"
  android:initialLayout="@layout/widget_savings_4x2"
  android:previewImage="@drawable/widget_preview"
  android:widgetCategory="home_screen" />
```
Add `res/drawable/widget_preview.png` (a static mock image of the card).

### 4e. `AndroidManifest.xml`
Inside `<application>`:
```xml
<receiver android:name=".SavingsWidget" android:exported="false">
  <intent-filter>
    <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
  </intent-filter>
  <meta-data android:name="android.appwidget.provider"
    android:resource="@xml/savings_widget_info" />
</receiver>
```
Inside the existing `MainActivity` `<activity>` add the deep-link scheme:
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="goout" />
</intent-filter>
```

Empty state: when `widget_snapshot` is null, show "Open GO-OUT to sync".

---

## Phase 5 — OTA Live Updates (Capgo)

```bash
npm i @capgo/capacitor-updater
npx cap sync
```
- Configure auto-update in `capacitor.config.ts` (`plugins.CapacitorUpdater`) and
  initialize per Capgo docs (self-hosted bundle URL or Capgo cloud channel).
- Release flow: on web deploy, also `npx @capgo/cli bundle upload` to the channel
  so installed APKs fetch the new web bundle on next launch.
- Native/widget changes still require a fresh APK; UI/bug fixes do not.
- Alternative: Ionic Appflow (paid) if Capgo unsuitable.

---

## Phase 6 — Build, sign, distribute

```bash
keytool -genkey -v -keystore goout-release.keystore -alias goout \
  -keyalg RSA -keysize 2048 -validity 10000
```
- Add release signing to `android/app/build.gradle` (`signingConfigs.release`),
  reference from a non-committed `keystore.properties` (gitignore it).
- Build: `cd android && ./gradlew assembleRelease` → `android/app/build/outputs/apk/release/app-release.apk`.
- Distribute via link/QR. Document the one-time "install from unknown sources" step.

---

## Files touched / created

Web (existing app):
- `src/pages/Dashboard.tsx` — add query-param handler (2a).
- `src/App.tsx` (or `AppLayout`) — mount `DeepLinkListener` (2b) + `useWidgetSync` (3b).
- `src/lib/widgetSnapshot.ts`, `src/lib/widgetBridge.ts`, `src/hooks/useWidgetSync.ts` — new.
- `capacitor.config.ts`, `package.json` (deps + scripts).

Native (generated `android/` project):
- `SavingsWidget.java`, `WidgetBridgePlugin.java`, `MainActivity.java` (register plugin).
- `res/layout/widget_savings_4x2.xml`, `widget_savings_2x2.xml`.
- `res/xml/savings_widget_info.xml`; `res/drawable/widget_bg.xml`, `widget_btn.xml`, `widget_preview.png`.
- `AndroidManifest.xml` — receiver + `goout://` scheme.
- `keystore.properties` (gitignored), `build.gradle` signing.

`.gitignore` additions: `android/app/release/`, `*.keystore`, `keystore.properties`,
`android/local.properties`, `android/.gradle/`.

## Acceptance checks
- `npm run build` and `npm run lint` pass.
- Debug APK installs, logs in, loads data from Supabase.
- Widget appears in long-press → Widgets → GO-OUT (preview shown), draggable in 4×2 and 2×2.
- Widget shows correct saved / goal / % / streak for a logged-in account; updates within seconds after a deposit (bridge) and falls back to periodic refresh.
- `＋ Add` opens the focus bucket's deposit sheet; `✓ Check` opens Check Balance; card body opens dashboard — from both cold and warm start.
- Capgo OTA delivers a UI change without reinstalling the APK.

## Risks
- First widget add before any login/sync shows the empty state until first snapshot write.
- Snapshot freshness depends on the app having been opened/synced — acceptable for a glanceable widget.
- App ID `com.goout.app` is permanent for installed users; confirm before first release.
- New signing/APK-hosting is net-new ops, but small and one-time.
