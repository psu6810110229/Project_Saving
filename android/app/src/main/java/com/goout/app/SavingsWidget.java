package com.goout.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.util.Locale;

/**
 * Home-screen widget showing the user's save-today target, plus enough overall
 * progress context to stay useful at a glance.
 *
 * It is display-only: it renders a snapshot the web app writes via
 * @capacitor/preferences (Android SharedPreferences file "CapacitorStorage",
 * key "widget_snapshot"). It never talks to Supabase. Buttons deep-link into
 * the app via the goout:// scheme.
 */
public class SavingsWidget extends AppWidgetProvider {

    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String SNAPSHOT_KEY = "widget_snapshot";
    private static final int COMPACT_MAX_WIDTH_DP = 180;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateWidget(context, manager, id);
        }
    }

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

    private void renderLarge(Context context, RemoteViews views, Snapshot snap) {
        if (snap == null) {
            views.setTextViewText(R.id.w_room, context.getString(R.string.app_name));
            views.setViewVisibility(R.id.w_chip, View.GONE);
            views.setTextViewText(R.id.w_due, context.getString(R.string.widget_empty));
            views.setTextViewText(R.id.w_due_label, "");
            views.setTextViewText(R.id.w_support, "");
            views.setTextViewText(R.id.w_saved_label, "");
            views.setTextViewText(R.id.w_saved, "");
            views.setTextViewText(R.id.w_pct, "");
            views.setProgressBar(R.id.w_progress, 100, 0, false);
            return;
        }

        views.setTextViewText(R.id.w_room, snap.roomName);
        String chipText = streakLabel(context, snap);
        if (chipText.isEmpty()) {
            views.setViewVisibility(R.id.w_chip, View.GONE);
        } else {
            views.setViewVisibility(R.id.w_chip, View.VISIBLE);
            views.setTextViewText(R.id.w_chip, chipText);
        }
        views.setTextViewText(R.id.w_due, heroText(context, snap));
        views.setTextViewText(R.id.w_due_label, dueLabel(context, snap));
        views.setTextViewText(R.id.w_support, supportLine(context, snap));
        views.setTextViewText(R.id.w_saved_label, snap.todayState.equals("no_plan")
                ? context.getString(R.string.widget_current_progress)
                : context.getString(R.string.widget_overall_progress));
        views.setTextViewText(R.id.w_saved, savedLine(context, snap));
        views.setTextViewText(R.id.w_pct, snap.progressPct + "%");
        views.setProgressBar(R.id.w_progress, 100, clampPct(snap.progressPct), false);
    }

    private void renderCompact(Context context, RemoteViews views, Snapshot snap) {
        if (snap == null) {
            views.setTextViewText(R.id.w_room, context.getString(R.string.app_name));
            views.setTextViewText(R.id.w_due, context.getString(R.string.widget_empty));
            views.setTextViewText(R.id.w_due_label, "");
            views.setTextViewText(R.id.w_support, "");
            views.setProgressBar(R.id.w_progress, 100, 0, false);
            return;
        }

        views.setTextViewText(R.id.w_room, snap.roomName);
        views.setTextViewText(R.id.w_due, heroText(context, snap));
        views.setTextViewText(R.id.w_due_label, compactLabel(context, snap));
        views.setTextViewText(R.id.w_support, compactSupportLine(context, snap));
        views.setProgressBar(R.id.w_progress, 100, clampPct(snap.progressPct), false);
    }

    private String heroText(Context context, Snapshot snap) {
        if ("done".equals(snap.todayState)) {
            return context.getString(R.string.widget_done_short);
        }
        if ("due".equals(snap.todayState)) {
            return baht(snap.todayDue);
        }
        return baht(snap.saved);
    }

    private String dueLabel(Context context, Snapshot snap) {
        if ("done".equals(snap.todayState)) {
            return periodNoun(context, snap.todayPeriod);
        }
        if ("due".equals(snap.todayState)) {
            return periodLabel(context, snap.todayPeriod);
        }
        return context.getString(R.string.widget_saved_so_far);
    }

    private String compactLabel(Context context, Snapshot snap) {
        if ("no_plan".equals(snap.todayState)) {
            return savedLine(context, snap);
        }
        return dueLabel(context, snap);
    }

    private String savedLine(Context context, Snapshot snap) {
        if (snap.goal <= 0) return baht(snap.saved);
        return baht(snap.saved) + " " + context.getString(R.string.widget_of_goal, baht(snap.goal));
    }

    private String supportLine(Context context, Snapshot snap) {
        if (snap.focusBucketName != null && !snap.focusBucketName.isEmpty()) {
            if (snap.focusBucketCount > 1) {
                return context.getString(
                        R.string.widget_focus_more,
                        snap.focusBucketName,
                        snap.focusBucketCount - 1
                );
            }
            return snap.focusBucketName;
        }
        if (snap.streak > 0) {
            return streakLabel(context, snap);
        }
        if ("done".equals(snap.todayState)) {
            return context.getString(R.string.widget_current_target_cleared);
        }
        if ("no_plan".equals(snap.todayState)) {
            if (snap.goal > 0) return toGoText(context, snap);
            return baht(snap.saved);
        }
        return savedLine(context, snap);
    }

    private String compactSupportLine(Context context, Snapshot snap) {
        String bucketLine = bucketProgressLine(snap);
        if (bucketLine != null && !bucketLine.isEmpty()) return bucketLine;
        return supportLine(context, snap);
    }

    private String periodLabel(Context context, String period) {
        if ("week".equals(period)) return context.getString(R.string.widget_need_week);
        if ("month".equals(period)) return context.getString(R.string.widget_need_month);
        return context.getString(R.string.widget_need_today);
    }

    private String doneLabel(Context context, String period) {
        if ("week".equals(period)) return context.getString(R.string.widget_done_week);
        if ("month".equals(period)) return context.getString(R.string.widget_done_month);
        return context.getString(R.string.widget_done_today);
    }

    private String periodNoun(Context context, String period) {
        if ("week".equals(period)) return context.getString(R.string.widget_period_week);
        if ("month".equals(period)) return context.getString(R.string.widget_period_month);
        return context.getString(R.string.widget_period_today);
    }

    private String streakLabel(Context context, Snapshot snap) {
        if (snap.streak <= 0) return "";
        if ("week".equals(snap.streakUnit)) return snap.streak + "w";
        if ("month".equals(snap.streakUnit)) return snap.streak + "m";
        return snap.streak + "d";
    }

    private String bucketProgressLine(Snapshot snap) {
        if (snap.focusBucketName == null || snap.focusBucketName.isEmpty() || snap.focusBucketTarget <= 0) {
            return null;
        }
        return snap.focusBucketName
                + " | "
                + String.format(Locale.US, "%,d", snap.focusBucketSaved)
                + "/"
                + String.format(Locale.US, "%,d", snap.focusBucketTarget)
                + " ("
                + snap.focusBucketPct
                + "%)";
    }

    private String toGoText(Context context, Snapshot snap) {
        if (snap.goal <= 0) return "";
        long remaining = snap.goal - snap.saved;
        if (remaining <= 0) return context.getString(R.string.widget_goal_reached);
        return context.getString(R.string.widget_to_go, baht(remaining));
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
            s.todayDue = Math.round(json.optDouble("todayDue", 0));
            s.todayState = json.optString("todayState", "no_plan");
            s.todayPeriod = json.optString("todayPeriod", "flex");
            s.focusBucketName = json.optString("focusBucketName", "");
            if (s.focusBucketName.isEmpty()) s.focusBucketName = null;
            s.focusBucketCount = json.optInt("focusBucketCount", 0);
            s.focusBucketSaved = Math.round(json.optDouble("focusBucketSaved", 0));
            s.focusBucketTarget = Math.round(json.optDouble("focusBucketTarget", 0));
            s.focusBucketPct = json.optInt("focusBucketPct", 0);
            s.streak = json.optInt("streak", 0);
            s.streakUnit = json.optString("streakUnit", "day");
            return s;
        } catch (Exception e) {
            return null;
        }
    }

    private static int clampPct(int value) {
        return Math.max(0, Math.min(100, value));
    }

    private static String baht(long value) {
        return "฿" + String.format(Locale.US, "%,d", value);
    }

    private static class Snapshot {
        String roomName;
        long saved;
        long goal;
        int progressPct;
        long todayDue;
        String todayState;
        String todayPeriod;
        String focusBucketName;
        int focusBucketCount;
        long focusBucketSaved;
        long focusBucketTarget;
        int focusBucketPct;
        int streak;
        String streakUnit;
    }
}
