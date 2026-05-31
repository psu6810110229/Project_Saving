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

    /**
     * Whether to render the compact 2x2 layout. The dedicated small widget
     * (CompactSavingsWidget) overrides this to always return true; the default
     * 4x2 widget decides by its current width so resizing still adapts.
     */
    protected boolean isCompact(Bundle options) {
        int minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
        return minWidth > 0 && minWidth < COMPACT_MAX_WIDTH_DP;
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager,
                                          int appWidgetId, Bundle newOptions) {
        updateWidget(context, manager, appWidgetId);
    }

    private void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        Bundle options = manager.getAppWidgetOptions(appWidgetId);
        boolean compact = isCompact(options);
        int layoutId = compact ? R.layout.widget_savings_2x2 : R.layout.widget_savings_4x2;

        RemoteViews views = new RemoteViews(context.getPackageName(), layoutId);

        Snapshot snap = readSnapshot(context);

        if (compact) {
            renderCompact(context, views, snap);
        } else {
            renderLarge(context, views, snap);
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

    /** Large 4x2: room + big saved amount + sub line + progress + percent + to-go + streak. */
    private void renderLarge(Context context, RemoteViews views, Snapshot snap) {
        if (snap == null) {
            views.setTextViewText(R.id.w_room, context.getString(R.string.app_name));
            views.setTextViewText(R.id.w_saved, context.getString(R.string.widget_empty));
            views.setTextViewText(R.id.w_savedsub, "");
            views.setTextViewText(R.id.w_pct, "");
            views.setTextViewText(R.id.w_togo, "");
            views.setTextViewText(R.id.w_streak, "");
            views.setProgressBar(R.id.w_progress, 100, 0, false);
            return;
        }
        views.setTextViewText(R.id.w_room, snap.roomName);
        views.setTextViewText(R.id.w_saved, "฿" + formatThousands(snap.saved));
        views.setTextViewText(R.id.w_savedsub,
                context.getString(R.string.widget_of_goal, "฿" + formatThousands(snap.goal)));
        views.setTextViewText(R.id.w_pct, snap.progressPct + "%");
        views.setTextViewText(R.id.w_togo, toGoText(context, snap));
        views.setTextViewText(R.id.w_streak, "🔥 " + snap.streak);
        views.setProgressBar(R.id.w_progress, 100, snap.progressPct, false);
    }

    /** Compact 2x2: room + big percent + saved amount + remaining + progress. */
    private void renderCompact(Context context, RemoteViews views, Snapshot snap) {
        if (snap == null) {
            views.setTextViewText(R.id.w_room, context.getString(R.string.app_name));
            views.setTextViewText(R.id.w_pct, "");
            views.setTextViewText(R.id.w_amount, context.getString(R.string.widget_empty));
            views.setTextViewText(R.id.w_amountsub, "");
            views.setProgressBar(R.id.w_progress, 100, 0, false);
            return;
        }
        views.setTextViewText(R.id.w_room, snap.roomName);
        views.setTextViewText(R.id.w_pct, snap.progressPct + "%");
        views.setTextViewText(R.id.w_amount, "฿" + formatThousands(snap.saved));
        views.setTextViewText(R.id.w_amountsub,
                context.getString(R.string.widget_of_goal, "฿" + formatThousands(snap.goal)));
        views.setProgressBar(R.id.w_progress, 100, snap.progressPct, false);
    }

    /** "เหลืออีก ฿X" / "X to go", or a done state when goal reached. */
    private String toGoText(Context context, Snapshot snap) {
        if (snap.goal <= 0) return "";
        long remaining = snap.goal - snap.saved;
        if (remaining <= 0) return context.getString(R.string.widget_goal_reached);
        return context.getString(R.string.widget_to_go, "฿" + formatThousands(remaining));
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
