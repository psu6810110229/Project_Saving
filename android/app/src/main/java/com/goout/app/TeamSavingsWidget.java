package com.goout.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;
import android.util.Log;

/**
 * The "team bars" 2x2 variant, shown as a separate entry in the launcher's
 * widget picker alongside {@link SavingsWidget} (4x2) and
 * {@link CompactSavingsWidget} (2x2). It renders the React /widget/team route —
 * a room-total header plus one ranked horizontal bar per member.
 *
 * Like the other providers it never talks to Supabase: real data flows
 * web → @capacitor/preferences ("widget_snapshot") → WidgetRenderer → React
 * WebView injection → bitmap capture (cached as widget_team.png). This class is
 * standalone (not a SavingsWidget subclass) because the parent keys its layout
 * and capture on a boolean compact flag, while this variant is keyed on the
 * "team" size string in WidgetRenderer.
 */
public class TeamSavingsWidget extends AppWidgetProvider {

    private static final String TAG = "TeamSavingsWidget";
    private static final String SIZE = "team";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager manager, int[] appWidgetIds) {
        Log.d(TAG, "provider update start: count=" + appWidgetIds.length);
        for (int id : appWidgetIds) {
            try {
                updateWidget(ctx, id);
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
            updateWidget(ctx, appWidgetId);
        } catch (Exception e) {
            Log.e(TAG, "provider options update failed for id=" + appWidgetId + ": "
                    + e.getMessage(), e);
        }
    }

    private void updateWidget(Context ctx, int appWidgetId) {
        // Show last-good cached image immediately (or placeholder if no cache yet).
        // A fresh capture is driven from the foreground via WidgetBridgePlugin.
        WidgetRenderer.applyLastGood(ctx, appWidgetId, SIZE);
        Log.d(TAG, "foreground capture needed: id=" + appWidgetId + " size=" + SIZE);
    }
}
