package com.goout.app;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Lets the web layer (useWidgetSync) request an immediate widget redraw after
 * writing a fresh snapshot to @capacitor/preferences.
 *
 * Because this is called from the foreground app, WidgetRenderer.render can
 * safely create a WebView on the main thread, load the bundled assets, and
 * capture a fresh bitmap — the most reliable capture path.
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    private static final String TAG = "WidgetBridge";

    @PluginMethod
    public void refresh(PluginCall call) {
        try {
            String snapshotJson = call.getString("snapshot");
            Log.d(TAG, "native refresh received: directSnapshot="
                    + (snapshotJson != null && !snapshotJson.trim().isEmpty())
                    + " snapshotLen=" + (snapshotJson != null ? snapshotJson.length() : 0));

            Context appCtx = getContext().getApplicationContext();
            Activity activity = getActivity();
            Context renderCtx = activity != null ? activity : appCtx;
            AppWidgetManager manager = AppWidgetManager.getInstance(appCtx);

            // Pass dp values (not physical pixels). WidgetRenderer captures at 2×dp and
            // injects a viewport meta so CSS pixels == dp, giving correct scale on screen.

            // Trigger capture for all SavingsWidget (4x2 / dynamic size) instances.
            int[] largeIds = manager.getAppWidgetIds(
                    new ComponentName(appCtx, SavingsWidget.class));
            Log.d(TAG, "widget ids found: large=" + largeIds.length);
            for (int id : largeIds) {
                try {
                    Bundle opts = manager.getAppWidgetOptions(id);
                    int wDp = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 250);
                    int hDp = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 130);
                    boolean compact = isBelowCompactThreshold(opts);
                    WidgetRenderer.applyLastGood(appCtx, id, compact);
                    WidgetRenderer.render(renderCtx, id, compact, wDp, hDp, snapshotJson);
                } catch (Exception e) {
                    Log.e(TAG, "foreground capture request failed for id=" + id + ": "
                            + e.getMessage(), e);
                }
            }

            // Trigger capture for all CompactSavingsWidget (2x2) instances.
            int[] compactIds = manager.getAppWidgetIds(
                    new ComponentName(appCtx, CompactSavingsWidget.class));
            Log.d(TAG, "widget ids found: compact=" + compactIds.length);
            for (int id : compactIds) {
                try {
                    Bundle opts = manager.getAppWidgetOptions(id);
                    int dimDp = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 110);
                    WidgetRenderer.applyLastGood(appCtx, id, true);
                    WidgetRenderer.render(renderCtx, id, true, dimDp, dimDp, snapshotJson);
                } catch (Exception e) {
                    Log.e(TAG, "foreground compact capture request failed for id=" + id + ": "
                            + e.getMessage(), e);
                }
            }

            // Trigger capture for all TeamSavingsWidget (2x2 team bars) instances.
            int[] teamIds = manager.getAppWidgetIds(
                    new ComponentName(appCtx, TeamSavingsWidget.class));
            Log.d(TAG, "widget ids found: team=" + teamIds.length);
            for (int id : teamIds) {
                try {
                    Bundle opts = manager.getAppWidgetOptions(id);
                    int dimDp = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 110);
                    WidgetRenderer.applyLastGood(appCtx, id, "team");
                    WidgetRenderer.render(renderCtx, id, "team", dimDp, dimDp, snapshotJson);
                } catch (Exception e) {
                    Log.e(TAG, "foreground team capture request failed for id=" + id + ": "
                            + e.getMessage(), e);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "foreground capture bridge failed: " + e.getMessage(), e);
        }

        call.resolve();
    }

    private static boolean isBelowCompactThreshold(Bundle opts) {
        int minWidth = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
        return minWidth > 0 && minWidth < 180;
    }
}
