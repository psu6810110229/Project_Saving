package com.goout.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.text.DateFormatSymbols;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Calendar;
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
    private static final int[] DEFAULT_HEATMAP_PATTERN = new int[]{
            1, 0, 1, 1, 0, 1, 1,
            0, 1, 1, 0, 1, 0, 1,
            1, 1, 0, 1, 1, 1, 0,
            0, 1, 1, 0, 1, 1, 1
    };

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
            bindCompact(context, views, snap);
        } else {
            bindLarge(context, views, snap);
        }

        views.setOnClickPendingIntent(R.id.w_card,
                deepLink(context, "goout://dashboard", 3));
        if (compact) {
            views.setOnClickPendingIntent(R.id.w_add,
                    deepLink(context, "goout://dashboard?action=deposit", 1));
        }

        manager.updateAppWidget(appWidgetId, views);
    }

    private void bindLarge(Context context, RemoteViews views, Snapshot snap) {
        if (snap == null) {
            views.setTextViewText(R.id.w_room, context.getString(R.string.app_name));
            views.setTextViewText(R.id.w_room_overlay, context.getString(R.string.app_name));
            views.setTextViewText(R.id.w_hero, context.getString(R.string.widget_empty));
            views.setViewVisibility(R.id.w_sub, View.GONE);
            views.setImageViewBitmap(R.id.w_mini_heatmap, generateMiniHeatmapBitmap(context, null));
            views.setViewVisibility(R.id.w_panel, View.GONE);
            views.setProgressBar(R.id.w_progress, 100, 0, false);
            return;
        }

        String room = fallbackText(snap.roomName, context.getString(R.string.app_name));
        String hero = fallbackText(heroText(context, snap), context.getString(R.string.widget_empty));
        String sub = normalizedText(dueLabel(context, snap));
        String saved = fallbackText(savedLineFull(context, snap), baht(0));
        String pct = clampPct(snap.progressPct) + "%";
        views.setTextViewText(R.id.w_room, room);
        views.setTextViewText(R.id.w_room_overlay, room);

        views.setTextViewText(R.id.w_hero, hero);
        if (sub.isEmpty()) {
            views.setViewVisibility(R.id.w_sub, View.GONE);
        } else {
            views.setViewVisibility(R.id.w_sub, View.VISIBLE);
            views.setTextViewText(R.id.w_sub, sub);
        }
        views.setImageViewBitmap(R.id.w_mini_heatmap, generateMiniHeatmapBitmap(context, snap));

        views.setViewVisibility(R.id.w_panel, View.VISIBLE);
        views.setTextViewText(R.id.w_saved, saved);
        views.setTextViewText(R.id.w_pct, pct);
        views.setProgressBar(R.id.w_progress, 100, clampPct(snap.progressPct), false);
    }

    private void bindCompact(Context context, RemoteViews views, Snapshot snap) {
        if (snap == null) {
            views.setTextViewText(R.id.w_room, context.getString(R.string.app_name));
            views.setTextViewText(R.id.w_hero, context.getString(R.string.widget_empty));
            views.setViewVisibility(R.id.w_sub, View.GONE);
            views.setTextViewText(R.id.w_support, "");
            views.setProgressBar(R.id.w_progress, 100, 0, false);
            return;
        }

        String room = fallbackText(snap.roomName, context.getString(R.string.app_name));
        String hero = fallbackText(heroText(context, snap), context.getString(R.string.widget_empty));
        String sub = "no_plan".equals(snap.todayState) ? "" : normalizedText(dueLabel(context, snap));
        String support = fallbackText(
                normalizedText(compactSupportLine(context, snap)),
                fallbackText(normalizedText(supportLine(context, snap)), bahtCompact(0))
        );

        views.setTextViewText(R.id.w_room, room);
        views.setTextViewText(R.id.w_hero, hero);
        if (sub.isEmpty()) {
            views.setViewVisibility(R.id.w_sub, View.GONE);
        } else {
            views.setViewVisibility(R.id.w_sub, View.VISIBLE);
            views.setTextViewText(R.id.w_sub, sub);
        }
        views.setTextViewText(R.id.w_support, support);
        views.setProgressBar(R.id.w_progress, 100, clampPct(snap.progressPct), false);
    }

    static String heroText(Context context, Snapshot snap) {
        if ("done".equals(snap.todayState)) {
            return context.getString(R.string.widget_done_short);
        }
        if ("due".equals(snap.todayState)) {
            return bahtCompact(snap.todayDue);
        }
        return bahtCompact(snap.saved);
    }

    static String dueLabel(Context context, Snapshot snap) {
        if ("done".equals(snap.todayState)) {
            return periodNoun(context, snap.todayPeriod);
        }
        if ("due".equals(snap.todayState)) {
            return periodLabel(context, snap.todayPeriod);
        }
        return context.getString(R.string.widget_saved_so_far);
    }

    static String savedLine(Context context, Snapshot snap) {
        if (snap.goal <= 0) return bahtCompact(snap.saved);
        return bahtCompact(snap.saved) + " "
                + context.getString(R.string.widget_of_goal, bahtCompact(snap.goal));
    }

    static String savedLineFull(Context context, Snapshot snap) {
        if (snap.goal <= 0) return baht(snap.saved);
        return baht(snap.saved) + "/" + String.format(Locale.US, "%,d", snap.goal);
    }

    static String supportLine(Context context, Snapshot snap) {
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
            return streakLabel(snap);
        }
        if ("done".equals(snap.todayState)) {
            return context.getString(R.string.widget_current_target_cleared);
        }
        if ("no_plan".equals(snap.todayState)) {
            if (snap.goal > 0) return toGoText(context, snap);
            return bahtCompact(snap.saved);
        }
        return savedLine(context, snap);
    }

    static String compactSupportLine(Context context, Snapshot snap) {
        String bucketLine = bucketProgressLine(snap);
        if (bucketLine != null && !bucketLine.isEmpty()) return bucketLine;
        return supportLine(context, snap);
    }

    static String periodLabel(Context context, String period) {
        if ("week".equals(period)) return context.getString(R.string.widget_need_week);
        if ("month".equals(period)) return context.getString(R.string.widget_need_month);
        return context.getString(R.string.widget_need_today);
    }

    static String periodNoun(Context context, String period) {
        if ("week".equals(period)) return context.getString(R.string.widget_period_week);
        if ("month".equals(period)) return context.getString(R.string.widget_period_month);
        return context.getString(R.string.widget_period_today);
    }

    static String streakLabel(Snapshot snap) {
        if (snap.streak <= 0) return "";
        if ("week".equals(snap.streakUnit)) return snap.streak + "w";
        if ("month".equals(snap.streakUnit)) return snap.streak + "m";
        return snap.streak + "d";
    }

    static String bucketProgressLine(Snapshot snap) {
        if (snap.focusBucketName == null || snap.focusBucketName.isEmpty() || snap.focusBucketTarget <= 0) {
            return null;
        }
        return snap.focusBucketName
                + " | "
                + formatToK(snap.focusBucketSaved)
                + "/"
                + formatToK(snap.focusBucketTarget)
                + " ("
                + snap.focusBucketPct
                + "%)";
    }

    static String toGoText(Context context, Snapshot snap) {
        if (snap.goal <= 0) return "";
        long remaining = snap.goal - snap.saved;
        if (remaining <= 0) return context.getString(R.string.widget_goal_reached);
        return context.getString(R.string.widget_to_go, bahtCompact(remaining));
    }

    private PendingIntent deepLink(Context context, String url, int requestCode) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.setPackage(context.getPackageName());
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Bitmap generateMiniHeatmapBitmap(Context context, Snapshot snap) {
        float density = context.getResources().getDisplayMetrics().density;
        int widthPx = Math.max(1, Math.round(184f * density));
        int heightPx = Math.max(1, Math.round(82f * density));
        float paddingStart = 4f * density;
        float paddingEnd = 4f * density;
        float paddingTop = 1.5f * density;
        float paddingBottom = 4f * density;
        float sideLabelWidth = 30f * density;
        float labelGap = 3f * density;
        float gridGap = 2.3f * density;
        float monthTextSize = 7.5f * density;
        float dayTextSize = 6.3f * density;
        float weekTextSize = 5.3f * density;
        int cols = 7;
        int rows = 4;

        Bitmap bitmap = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Paint cellPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        Paint monthPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        Paint axisPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        int activeColor = context.getColor(R.color.widget_brand);
        int inactiveColor = context.getColor(R.color.widget_well);
        int[] pattern = resolveHeatmapPattern(snap);

        monthPaint.setColor(context.getColor(R.color.widget_ink_soft));
        monthPaint.setTextSize(monthTextSize);
        monthPaint.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));

        axisPaint.setColor(context.getColor(R.color.widget_ink_soft));
        axisPaint.setTextSize(dayTextSize);
        axisPaint.setTypeface(Typeface.create("sans-serif", Typeface.NORMAL));

        float dayHeaderHeight = dayTextSize + (2f * density);
        float monthHeight = monthTextSize + (1f * density);
        float gridTop = paddingTop + monthHeight + dayHeaderHeight;
        float gridLeft = paddingStart + sideLabelWidth + labelGap;
        float availableWidth = widthPx - gridLeft - paddingEnd;
        float availableHeight = heightPx - gridTop - paddingBottom;
        float cellSize = Math.min(
                (availableWidth - (gridGap * (cols - 1))) / cols,
                (availableHeight - (gridGap * (rows - 1))) / rows
        );
        cellSize = Math.max(1f, cellSize * 0.82f);
        float gridWidth = (cellSize * cols) + (gridGap * (cols - 1));
        float gridHeight = (cellSize * rows) + (gridGap * (rows - 1));
        float gridStartX = gridLeft + Math.max(0f, availableWidth - gridWidth);
        float gridStartY = gridTop;
        float radius = Math.max(1.6f * density, cellSize * 0.24f);

        axisPaint.setTextSize(dayTextSize);
        float dayBaseline = paddingTop + monthHeight + dayTextSize;
        String[] dayLabels = new String[]{"S", "M", "T", "W", "T", "F", "S"};
        float monthCenterX = gridStartX + (gridWidth / 2f);
        float monthBaseline = paddingTop - monthPaint.ascent();
        float monthWidth = monthPaint.measureText(currentMonthLabel());
        canvas.drawText(currentMonthLabel(), monthCenterX - (monthWidth / 2f), monthBaseline, monthPaint);

        for (int col = 0; col < cols; col++) {
            float centerX = gridStartX + (col * (cellSize + gridGap)) + (cellSize / 2f);
            String label = dayLabels[col];
            float labelWidth = axisPaint.measureText(label);
            canvas.drawText(label, centerX - (labelWidth / 2f), dayBaseline, axisPaint);
        }

        axisPaint.setTextSize(weekTextSize);
        float weekLabelGap = 2f * density;
        for (int row = 0; row < rows; row++) {
            float top = gridStartY + (row * (cellSize + gridGap));
            float centerY = top + (cellSize / 2f);
            Paint.FontMetrics metrics = axisPaint.getFontMetrics();
            float weekBaseline = centerY - ((metrics.ascent + metrics.descent) / 2f);
            String weekLabel = "Week " + (row + 1);
            float weekLabelWidth = axisPaint.measureText(weekLabel);
            float weekLabelX = gridStartX - weekLabelGap - weekLabelWidth;
            canvas.drawText(weekLabel, Math.max(paddingStart, weekLabelX), weekBaseline, axisPaint);
        }

        for (int row = 0; row < rows; row++) {
            for (int col = 0; col < cols; col++) {
                int index = (row * cols) + col;
                if (index >= pattern.length) {
                    continue;
                }
                float left = gridStartX + (col * (cellSize + gridGap));
                float top = gridStartY + (row * (cellSize + gridGap));
                RectF cell = new RectF(left, top, left + cellSize, top + cellSize);
                cellPaint.setColor(pattern[index] == 1 ? activeColor : inactiveColor);
                canvas.drawRoundRect(cell, radius, radius, cellPaint);
            }
        }

        return bitmap;
    }

    private int[] resolveHeatmapPattern(Snapshot snap) {
        if (snap == null) return DEFAULT_HEATMAP_PATTERN;
        return DEFAULT_HEATMAP_PATTERN;
    }

    private String currentMonthLabel() {
        String month = new DateFormatSymbols(Locale.US).getShortMonths()[Calendar.getInstance().get(Calendar.MONTH)];
        return month == null ? "" : month.toUpperCase(Locale.US);
    }

    private Snapshot readSnapshot(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String raw = prefs.getString(SNAPSHOT_KEY, null);
        if (raw == null) return null;
        try {
            JSONObject json = new JSONObject(raw);
            Snapshot s = new Snapshot();
            s.roomName = cleanOptString(json, "roomName", context.getString(R.string.app_name));
            s.saved = Math.round(json.optDouble("saved", 0));
            s.goal = Math.round(json.optDouble("goal", 0));
            s.progressPct = json.optInt("progressPct", 0);
            s.todayDue = Math.round(json.optDouble("todayDue", 0));
            s.todayState = cleanOptString(json, "todayState", "no_plan");
            s.todayPeriod = cleanOptString(json, "todayPeriod", "flex");
            s.focusBucketName = cleanOptString(json, "focusBucketName", "");
            if (s.focusBucketName.isEmpty()) s.focusBucketName = null;
            s.focusBucketCount = json.optInt("focusBucketCount", 0);
            s.focusBucketSaved = Math.round(json.optDouble("focusBucketSaved", 0));
            s.focusBucketTarget = Math.round(json.optDouble("focusBucketTarget", 0));
            s.focusBucketPct = json.optInt("focusBucketPct", 0);
            s.streak = json.optInt("streak", 0);
            s.streakUnit = cleanOptString(json, "streakUnit", "day");
            return s;
        } catch (Exception e) {
            return null;
        }
    }

    private static String cleanOptString(JSONObject json, String key, String fallback) {
        String value = json.optString(key, fallback);
        if (value == null) return fallback;
        value = value.trim();
        if (value.isEmpty() || "null".equalsIgnoreCase(value) || "undefined".equalsIgnoreCase(value)) {
            return fallback;
        }
        return value;
    }

    private static String normalizedText(String text) {
        if (text == null) return "";
        String trimmed = text.trim();
        if (trimmed.isEmpty()) return "";
        if ("null".equalsIgnoreCase(trimmed) || "undefined".equalsIgnoreCase(trimmed)) return "";
        return trimmed;
    }

    private static String fallbackText(String primary, String fallback) {
        String value = normalizedText(primary);
        if (!value.isEmpty()) return value;
        return normalizedText(fallback);
    }

    static int clampPct(int value) {
        return Math.max(0, Math.min(100, value));
    }

    static String baht(long value) {
        return "\u0E3F" + String.format(Locale.US, "%,d", value);
    }

    static String bahtCompact(double value) {
        return "\u0E3F" + formatToK(value);
    }

    static String formatToK(double value) {
        double absValue = Math.abs(value);
        DecimalFormatSymbols symbols = DecimalFormatSymbols.getInstance(Locale.US);
        if (absValue >= 1000d) {
            DecimalFormat compactFormatter = new DecimalFormat("0.#", symbols);
            return compactFormatter.format(value / 1000d) + "k";
        }

        if (Math.rint(value) == value) {
            return String.format(Locale.US, "%,d", Math.round(value));
        }

        DecimalFormat wholeFormatter = new DecimalFormat("#,##0.#", symbols);
        return wholeFormatter.format(value);
    }

    static class Snapshot {
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
