package com.goout.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;
import android.util.Log;

/**
 * Home-screen widget shell. Visual rendering is delegated to the React widget
 * route (see WidgetRenderer): a hidden WebView renders /widget/small or
 * /widget/medium, the bitmap is captured, and the result is stored as a PNG
 * cache that is applied here via RemoteViews.setImageViewBitmap.
 *
 * Real data flows web → @capacitor/preferences ("widget_snapshot") →
 * WidgetRenderer → React WebView injection → bitmap capture. This provider
 * never talks to Supabase directly.
 */
public class SavingsWidget extends AppWidgetProvider {

    private static final String TAG = "SavingsWidget";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager manager, int[] appWidgetIds) {
        Log.d(TAG, "provider update start: count=" + appWidgetIds.length);
        for (int id : appWidgetIds) {
            try {
                updateWidget(ctx, manager, id);
            } catch (Exception e) {
                Log.e(TAG, "provider update failed for id=" + id + ": " + e.getMessage(), e);
            }
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager manager,
                                           int appWidgetId, Bundle newOptions) {
        Log.d(TAG, "provider options changed: id=" + appWidgetId);
        try {
            updateWidget(ctx, manager, appWidgetId);
        } catch (Exception e) {
            Log.e(TAG, "provider options update failed for id=" + appWidgetId + ": "
                    + e.getMessage(), e);
        }
    }

    private void updateWidget(Context ctx, AppWidgetManager manager, int appWidgetId) {
        Bundle opts = manager.getAppWidgetOptions(appWidgetId);
        boolean compact = isCompact(opts);
        Log.d(TAG, "provider update widget: id=" + appWidgetId
                + " compact=" + compact
                + " minWidthDp=" + opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, -1)
                + " maxWidthDp=" + opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, -1));

        // Show last-good cached image immediately (or placeholder if no cache yet).
        WidgetRenderer.applyLastGood(ctx, appWidgetId, compact);
        Log.d(TAG, "foreground capture needed: id=" + appWidgetId + " compact=" + compact);
    }

    protected boolean isCompact(Bundle options) {
        int minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
        return minWidth > 0 && minWidth < 180;
    }
}
