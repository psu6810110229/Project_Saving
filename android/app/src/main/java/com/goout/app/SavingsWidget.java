package com.goout.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.util.Locale;

/**
 * Home-screen widget showing the user's saved-vs-goal progress and streak.
 *
 * It is display-only: it renders a snapshot the web app writes via
 * @capacitor/preferences (Android SharedPreferences file "CapacitorStorage",
 * key "widget_snapshot"). It never talks to Supabase. Buttons deep-link into
 * the app via the goout:// scheme.
 */
public class SavingsWidget extends AppWidgetProvider {

    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String SNAPSHOT_KEY = "widget_snapshot";

    // Below this min width (dp) we render the compact 2x2 layout.
    private static final int COMPACT_MAX_WIDTH_DP = 180;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateWidget(context, manager, id);
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager,
                                          int appWidgetId, Bundle newOptions) {
        updateWidget(context, manager, appWidgetId);
    }

    private void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        Bundle options = manager.getAppWidgetOptions(appWidgetId);
        int minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
        boolean compact = minWidth > 0 && minWidth < COMPACT_MAX_WIDTH_DP;
        int layoutId = compact ? R.layout.widget_savings_2x2 : R.layout.widget_savings_4x2;

        RemoteViews views = new RemoteViews(context.getPackageName(), layoutId);

        Snapshot snap = readSnapshot(context);

        if (snap == null) {
            // First run / not yet synced.
            views.setTextViewText(R.id.w_amount, context.getString(R.string.widget_empty));
            views.setTextViewText(R.id.w_pct, "");
            if (!compact) {
                views.setTextViewText(R.id.w_room, context.getString(R.string.app_name));
                views.setTextViewText(R.id.w_streak, "");
                views.setProgressBar(R.id.w_progress, 100, 0, false);
            }
        } else {
            String amount = "฿" + formatThousands(snap.saved)
                    + " / ฿" + formatThousands(snap.goal);
            views.setTextViewText(R.id.w_amount, amount);
            views.setTextViewText(R.id.w_pct, snap.progressPct + "%");
            if (!compact) {
                views.setTextViewText(R.id.w_room, snap.roomName);
                views.setTextViewText(R.id.w_streak, "🔥 " + snap.streak);
                views.setProgressBar(R.id.w_progress, 100, snap.progressPct, false);
            }
        }

        // Deep links: open the app at the exact section.
        views.setOnClickPendingIntent(R.id.w_add,
                deepLink(context, "goout://dashboard?action=deposit", 1));
        views.setOnClickPendingIntent(R.id.w_card,
                deepLink(context, "goout://dashboard", 3));
        if (!compact) {
            views.setOnClickPendingIntent(R.id.w_check,
                    deepLink(context, "goout://dashboard?action=check-balance", 2));
        }

        manager.updateAppWidget(appWidgetId, views);
    }

    private PendingIntent deepLink(Context context, String url, int requestCode) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.setPackage(context.getPackageName());
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Snapshot readSnapshot(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String raw = prefs.getString(SNAPSHOT_KEY, null);
        if (raw == null) return null;
        try {
            JSONObject json = new JSONObject(raw);
            Snapshot s = new Snapshot();
            s.roomName = json.optString("roomName", context.getString(R.string.app_name));
            s.saved = Math.round(json.optDouble("saved", 0));
            s.goal = Math.round(json.optDouble("goal", 0));
            s.progressPct = json.optInt("progressPct", 0);
            s.streak = json.optInt("streak", 0);
            return s;
        } catch (Exception e) {
            return null;
        }
    }

    private static String formatThousands(long value) {
        return String.format(Locale.US, "%,d", value);
    }

    private static class Snapshot {
        String roomName;
        long saved;
        long goal;
        int progressPct;
        int streak;
    }
}
