package com.goout.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.RemoteViews;

import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Renders the React widget route in a hidden WebView and captures a bitmap
 * that is stored as a PNG cache and applied to the home-screen widget via
 * setImageViewBitmap. The capture always runs on the main thread.
 *
 * Architecture:
 *   native reads widget_snapshot JSON → injects into hidden WebView via
 *   window.__renderWidget → React signals data-widget-ready → bitmap captured
 *   → PNG saved to filesDir/widgets/ → RemoteViews.setImageViewBitmap applied
 *
 * Bitmap limits (safe/clamped per guardrail):
 *   4x2 (medium): max 560×248 px  ≈ 556 KB ARGB_8888, under 1 MB Binder limit
 *   2x2 (small):  max 300×300 px  ≈ 360 KB ARGB_8888
 */
public class WidgetRenderer {

    private static final String TAG = "WidgetRenderer";

    static final String PREFS_NAME = "CapacitorStorage";
    static final String SNAPSHOT_KEY = "widget_snapshot";

    // Physical capture limits (wPx/hPx are passed as dp; we capture at dp×2).
    // Safe ceiling: 600×300 × 4 bytes = 720 KB < 900 KB Binder limit.
    private static final int MAX_PX_MEDIUM_W = 600; // 2× max of 300 dp wide
    private static final int MAX_PX_MEDIUM_H = 300; // 2× max of 150 dp tall
    private static final int MAX_PX_SMALL = 300;    // 2× max of 150 dp square
    private static final int MIN_PX = 100;

    private static final long CAPTURE_TIMEOUT_MS = 5000;
    private static final long POLL_INTERVAL_MS = 120;

    private static final String DOM_VALIDATION_JS =
            "(function(){try{"
                    + "var root=document.querySelector('[data-widget-capture-root]');"
                    + "var host=root||document.body;"
                    + "var rect=root?root.getBoundingClientRect():null;"
                    + "var ready=document.documentElement.getAttribute('data-widget-ready');"
                    + "var content=root?(root.getAttribute('data-widget-content')||'missing'):'missing';"
                    + "var hasProject=!!host.querySelector('[data-widget-project]');"
                    + "var hasAmount=!!host.querySelector('[data-widget-amount]');"
                    + "var hasProgress=!!host.querySelector('[data-widget-progress]');"
                    + "var hasEmpty=!!host.querySelector('[data-widget-empty]');"
                    + "var text=(host.textContent||'').trim();"
                    + "var visible=!!rect&&rect.width>0&&rect.height>0&&rect.left<innerWidth&&rect.top<innerHeight&&rect.right>0&&rect.bottom>0;"
                    + "var ok=visible&&((content==='real'&&hasProject&&(hasAmount||hasProgress)&&text.length>0)||(content==='empty'&&hasEmpty&&text.length>0));"
                    + "return JSON.stringify({ok:ok,ready:ready,content:content,hasProject:hasProject,hasAmount:hasAmount,hasProgress:hasProgress,hasEmpty:hasEmpty,textLength:text.length,viewport:innerWidth+'x'+innerHeight,rect:rect?Math.round(rect.width)+'x'+Math.round(rect.height):'none'});"
                    + "}catch(e){return JSON.stringify({ok:false,error:String(e)});}})()";

    // Track one in-progress WebView per size to avoid concurrent captures.
    private static final Map<String, WebView> activeRenders = new HashMap<>();

    // -------------------------------------------------------------------------
    // Public entry points
    // -------------------------------------------------------------------------

    /** Schedule a capture for one widget instance (posts to main thread). */
    static void render(Context ctx, int appWidgetId, boolean compact, int wPx, int hPx) {
        render(ctx, appWidgetId, compact, wPx, hPx, null);
    }

    /** Schedule a capture with a foreground-supplied snapshot JSON, falling back to prefs. */
    static void render(Context ctx, int appWidgetId, boolean compact, int wPx, int hPx,
                       String snapshotJsonOverride) {
        try {
            new Handler(Looper.getMainLooper()).post(() -> {
                try {
                    doCapture(ctx, appWidgetId, compact, wPx, hPx, snapshotJsonOverride);
                } catch (Exception e) {
                    Log.e(TAG, "capture failed before render completed: " + e.getMessage(), e);
                    applyLastGood(ctx, appWidgetId, compact);
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "capture scheduling failed: " + e.getMessage(), e);
            applyLastGood(ctx, appWidgetId, compact);
        }
    }

    /**
     * Apply the last-good cached PNG to a widget instance. Safe to call from
     * any thread that is already on the main looper (AppWidgetProvider.onUpdate,
     * evaluateJavascript callbacks). Shows a transparent placeholder if no cache.
     */
    static void applyLastGood(Context ctx, int appWidgetId, boolean compact) {
        try {
            String sizeName = compact ? "small" : "medium";
            File cacheFile = cacheFile(ctx, sizeName);
            Log.d(TAG, "last-good " + (cacheFile.exists() ? "exists" : "missing")
                    + ": " + sizeName + " path=" + cacheFile.getPath());

            AppWidgetManager manager = AppWidgetManager.getInstance(ctx);
            int layoutId = compact ? R.layout.widget_savings_2x2 : R.layout.widget_savings_4x2;
            RemoteViews views = new RemoteViews(ctx.getPackageName(), layoutId);

            // Keep a reference so we can recycle AFTER updateAppWidget parcels the bitmap.
            Bitmap bitmapToRecycle = null;
            boolean applied = false;
            if (cacheFile.exists()) {
                Bitmap cached = decodeSafe(cacheFile);
                if (cached != null) {
                    views.setImageViewBitmap(R.id.w_image, cached);
                    Log.d(TAG, "file applied: " + sizeName + " (" + cached.getWidth()
                            + "×" + cached.getHeight() + ")");
                    bitmapToRecycle = cached;
                    applied = true;
                }
            }
            if (!applied) {
                Bitmap placeholder = placeholderBitmap(compact);
                views.setImageViewBitmap(R.id.w_image, placeholder);
                Log.w(TAG, "placeholder applied: " + sizeName + " (no valid cache)");
                bitmapToRecycle = placeholder;
            }

            // Whole-widget tap opens the dashboard.
            views.setOnClickPendingIntent(R.id.w_card, dashboardIntent(ctx));
            Log.d(TAG, "RemoteViews image applied: " + sizeName + " applied=" + applied);
            manager.updateAppWidget(appWidgetId, views);
            Log.d(TAG, "AppWidgetManager.updateAppWidget called: id=" + appWidgetId
                    + " size=" + sizeName);
            // Recycle only after updateAppWidget has parcelled the bitmap over Binder.
            if (bitmapToRecycle != null) bitmapToRecycle.recycle();
        } catch (Exception e) {
            Log.e(TAG, "apply widget image failed: " + e.getMessage(), e);
        }
    }

    // -------------------------------------------------------------------------
    // Capture implementation (must run on main thread)
    // -------------------------------------------------------------------------

    private static void doCapture(Context ctx, int appWidgetId, boolean compact,
                                   int wPx, int hPx, String snapshotJsonOverride) {
        String sizeName = compact ? "small" : "medium";
        String sizePath = sizeName; // URL path segment: "small" | "medium"

        // Fixed design sizes. The widget content has a near-constant pixel height
        // (~213px for medium) because all text sizes are fixed, so we lay out at a
        // known CSS size tall enough for every section, then fitCenter scales the
        // bitmap into the actual home-screen cell. The per-instance dp (wPx/hPx) is
        // intentionally ignored — deriving CSS size from it produced a viewport far
        // too short for the content (the bottom half was clipped).
        //
        // With useWideViewPort=true the injected `width=<viewportW>` meta is honored,
        // so CSS innerWidth == viewportW. The physical capture aspect matches the design
        // aspect, so CSS innerHeight == viewportH. Bitmaps stay under the 900 KB Binder limit.
        int capW, capH, viewportW, viewportH;
        if (compact) {
            viewportW = 185; viewportH = 185;   // 2x2 square
            capW = 370;      capH = 370;         // 547 KB ARGB_8888
        } else {
            // 4x2: ~2.2:1, close to a real 4x2 cell. The layout uses fitXY so the
            // card fills the whole cell; matching this aspect keeps distortion tiny.
            // Content (no buttons) is ~168px tall; 172 leaves a little breathing room.
            // Capture at ~1.8x the design size so it stays sharp when scaled up.
            viewportW = 380; viewportH = 172;
            capW = 680;      capH = 308;         // 838 KB ARGB_8888 (< 900 KB Binder)
        }

        Log.d(TAG, "capture start: " + sizeName + " " + capW + "×" + capH
                + " viewport=" + viewportW + "x" + viewportH
                + " ctxType=" + ctx.getClass().getSimpleName()
                + " hasDirectSnapshot=" + (snapshotJsonOverride != null));

        // Cancel any in-progress render for this size.
        WebView existing = activeRenders.get(sizeName);
        if (existing != null) {
            Log.d(TAG, "cancelling previous render for " + sizeName);
            try {
                existing.destroy();
            } catch (Exception e) {
                Log.w(TAG, "previous render destroy failed: " + e.getMessage());
            }
            activeRenders.remove(sizeName);
        }

        String resolvedSnapshotJson = normalizeSnapshotJson(snapshotJsonOverride);
        if (resolvedSnapshotJson != null) {
            Log.d(TAG, "snapshot read: using foreground bridge payload length="
                    + resolvedSnapshotJson.length());
        } else {
            resolvedSnapshotJson = readSnapshotJson(ctx);
        }
        if (resolvedSnapshotJson == null) {
            Log.w(TAG, "capture skipped: snapshot missing for " + sizeName);
            applyLastGood(ctx, appWidgetId, compact);
            return;
        }
        final String snapshotJson = resolvedSnapshotJson;

        // Build the hidden WebView.
        WebView webView = new WebView(ctx);
        // Force software rendering so webView.draw(canvas) works on a non-attached View.
        // Without this, draw() either silently draws nothing or throws IllegalStateException
        // on hardware-accelerated Views drawing to a software Canvas.
        webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        webView.setBackgroundColor(Color.TRANSPARENT);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        // Honor the injected `width=` viewport meta so CSS innerWidth == our design width.
        // Without these, WebView ignores width= and uses physical/density (≈171px), which
        // is far too small and clips the content.
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);

        // Serve bundled web assets via WebViewAssetLoader so absolute /assets/ paths work.
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain("appassets.androidplatform.net")
                .addPathHandler("/", new PublicAssetsPathHandler(ctx))
                .build();

        activeRenders.put(sizeName, webView);
        final Handler handler = new Handler(Looper.getMainLooper());
        final long startMs = SystemClock.elapsedRealtime();
        final int fCapW = capW;
        final int fCapH = capH;
        final int fViewportW = viewportW;
        final int fViewportH = viewportH;

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d(TAG, "web console [" + consoleMessage.messageLevel() + "] "
                        + consoleMessage.message() + " @ "
                        + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber());
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view,
                                                               WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                Log.d(TAG, "page finished: " + url);
                // Set the layout viewport to exactly viewportW×viewportH CSS px.
                // Using only width= (no initial-scale) lets the browser compute the
                // scale automatically: capW physical px / viewportW CSS px = 2px/CSS px.
                // Forcing initial-scale=2.0 on DPR=3.5 devices makes the visual
                // viewport 71 CSS px (500÷7) instead of 250, breaking layout.
                String viewportJs = "(function(){"
                        + "var c='width=" + fViewportW + ",height=" + fViewportH + "';"
                        + "var m=document.querySelector('meta[name=viewport]');"
                        + "if(m){m.content=c;}else{"
                        + "var n=document.createElement('meta');n.name='viewport';n.content=c;"
                        + "document.head.appendChild(n);}"
                        + "})()";
                view.evaluateJavascript(viewportJs, ignored -> {
                    Log.d(TAG, "viewport injected: " + fViewportW + "x" + fViewportH
                            + " for " + sizeName);
                    // Ping JS to confirm the engine is live before starting the injection loop.
                    view.evaluateJavascript("typeof window.__renderWidget", pingValue -> {
                        Log.d(TAG, "JS ping __renderWidget type=" + pingValue
                                + " for " + sizeName);
                        injectSnapshotWhenBridgeReady(view, handler, startMs, snapshotJson,
                                sizePath, ctx, appWidgetId, compact, sizeName, fCapW, fCapH);
                    });
                });
            }
        });

        // Size the WebView before loading so CSS viewport units resolve correctly.
        webView.measure(
                View.MeasureSpec.makeMeasureSpec(capW, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(capH, View.MeasureSpec.EXACTLY));
        webView.layout(0, 0, capW, capH);

        String routeUrl = "https://appassets.androidplatform.net/widget/" + sizePath;
        Log.d(TAG, "route load requested: " + routeUrl);
        webView.loadUrl(routeUrl);
    }

    private static void injectSnapshotWhenBridgeReady(WebView webView, Handler handler,
                                                       long startMs, String snapshotJson,
                                                       String sizePath, Context ctx,
                                                       int appWidgetId, boolean compact,
                                                       String sizeName, int capW, int capH) {
        if (SystemClock.elapsedRealtime() - startMs > CAPTURE_TIMEOUT_MS) {
            Log.w(TAG, "snapshot injection timeout for " + sizeName + " - keeping last-good cache");
            cleanupRender(webView, sizeName);
            applyLastGood(ctx, appWidgetId, compact);
            return;
        }

        String dataExpr = "null";
        if (snapshotJson != null) {
            String b64 = Base64.encodeToString(
                    snapshotJson.getBytes(StandardCharsets.UTF_8),
                    Base64.NO_WRAP);
            // Decode Base64 as UTF-8. Plain atob() yields a binary (Latin-1) string,
            // which corrupts multi-byte characters (e.g. Thai room/bucket names) into
            // mojibake. TextDecoder reconstructs the original UTF-8 text correctly.
            dataExpr = "JSON.parse(new TextDecoder('utf-8').decode("
                    + "Uint8Array.from(atob('" + b64 + "'),function(c){return c.charCodeAt(0);})))";
        }

        String injectJs = "(function(){try{"
                + "if(typeof window.__renderWidget!=='function')return 'missing';"
                + "window.__renderWidget(" + dataExpr + ",'" + sizePath + "');"
                + "return 'called';"
                + "}catch(e){console.error('[Widget] inject failed',e);return 'error:'+(e&&e.message?e.message:String(e));}})()";

        webView.evaluateJavascript(injectJs, value -> {
            String result = decodeJsString(value);
            if ("called".equals(result)) {
                Log.d(TAG, "snapshot injected: " + sizeName + " data=" + (snapshotJson != null));
                Log.d(TAG, "__renderWidget called successfully: " + sizeName);
                scheduleReadyPoll(webView, handler, startMs, ctx, appWidgetId,
                        compact, sizeName, capW, capH);
            } else if ("missing".equals(result)) {
                Log.d(TAG, "__renderWidget not ready yet: " + sizeName);
                handler.postDelayed(
                        () -> injectSnapshotWhenBridgeReady(webView, handler, startMs,
                                snapshotJson, sizePath, ctx, appWidgetId, compact,
                                sizeName, capW, capH),
                        POLL_INTERVAL_MS);
            } else {
                Log.e(TAG, "snapshot injection failed for " + sizeName + ": " + result);
                cleanupRender(webView, sizeName);
                applyLastGood(ctx, appWidgetId, compact);
            }
        });
    }

    private static void scheduleReadyPoll(WebView webView, Handler handler, long startMs,
                                           Context ctx, int appWidgetId, boolean compact,
                                           String sizeName, int capW, int capH) {
        if (SystemClock.elapsedRealtime() - startMs > CAPTURE_TIMEOUT_MS) {
            Log.w(TAG, "capture timeout for " + sizeName + " – keeping last-good cache");
            cleanupRender(webView, sizeName);
            applyLastGood(ctx, appWidgetId, compact);
            return;
        }

        webView.evaluateJavascript(
                "document.documentElement.getAttribute('data-widget-ready')",
                value -> {
                    Log.d(TAG, "data-widget-ready value for " + sizeName + ": " + value);
                    if ("\"true\"".equals(value) || "\"empty\"".equals(value)) {
                        Log.d(TAG, "widget ready: " + value + " for " + sizeName);
                        validateDomThenCapture(webView, ctx, appWidgetId, compact, sizeName, capW, capH);
                    } else if ("\"invalid\"".equals(value)) {
                        Log.w(TAG, "DOM validation failed in React for " + sizeName + " - keeping last-good cache");
                        cleanupRender(webView, sizeName);
                        applyLastGood(ctx, appWidgetId, compact);
                    } else {
                        handler.postDelayed(
                                () -> scheduleReadyPoll(webView, handler, startMs, ctx,
                                        appWidgetId, compact, sizeName, capW, capH),
                                POLL_INTERVAL_MS);
                    }
                });
    }

    private static void validateDomThenCapture(WebView webView, Context ctx, int appWidgetId,
                                                boolean compact, String sizeName,
                                                int capW, int capH) {
        webView.evaluateJavascript(DOM_VALIDATION_JS, value -> {
            try {
                JSONObject result = parseJsJsonObject(value);
                Log.d(TAG, "DOM validation result for " + sizeName + ": " + result);
                if (result.optBoolean("ok", false)) {
                    captureAndApply(webView, ctx, appWidgetId, compact, sizeName, capW, capH);
                } else {
                    Log.w(TAG, "capture rejected by DOM validation for " + sizeName
                            + " - keeping last-good cache");
                    cleanupRender(webView, sizeName);
                    applyLastGood(ctx, appWidgetId, compact);
                }
            } catch (JSONException e) {
                Log.e(TAG, "DOM validation parse failed for " + sizeName + ": " + e.getMessage());
                cleanupRender(webView, sizeName);
                applyLastGood(ctx, appWidgetId, compact);
            }
        });
    }

    private static void captureAndApply(WebView webView, Context ctx, int appWidgetId,
                                         boolean compact, String sizeName, int capW, int capH) {
        try {
            // Re-measure to ensure the size is still correct.
            webView.measure(
                    View.MeasureSpec.makeMeasureSpec(capW, View.MeasureSpec.EXACTLY),
                    View.MeasureSpec.makeMeasureSpec(capH, View.MeasureSpec.EXACTLY));
            webView.layout(0, 0, capW, capH);

            Bitmap bitmap = Bitmap.createBitmap(capW, capH, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            canvas.drawColor(Color.TRANSPARENT);
            Log.d(TAG, "capture draw start: " + sizeName + " " + capW + "x" + capH);
            webView.draw(canvas);
            Log.d(TAG, "capture draw done: " + sizeName);
            cleanupRender(webView, sizeName);

            // Atomic write: temp file → rename to final path.
            File dir = cacheDir(ctx);
            if (!dir.exists()) dir.mkdirs();
            File tempFile = new File(dir, "widget_" + sizeName + "_tmp.png");
            File finalFile = cacheFile(ctx, sizeName);

            try (FileOutputStream fos = new FileOutputStream(tempFile)) {
                bitmap.compress(Bitmap.CompressFormat.PNG, 95, fos);
            }
            bitmap.recycle();
            if (!tempFile.renameTo(finalFile)) {
                // renameTo can fail across filesystems – fall back to manual copy.
                try (java.io.FileInputStream in = new java.io.FileInputStream(tempFile);
                     FileOutputStream out2 = new FileOutputStream(finalFile)) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) > 0) out2.write(buf, 0, n);
                }
                //noinspection ResultOfMethodCallIgnored
                tempFile.delete();
            }
            Log.d(TAG, "PNG write success: " + sizeName + " -> " + finalFile.getPath()
                    + " size=" + finalFile.length() + " bytes");

        } catch (Exception e) {
            Log.e(TAG, "PNG write failed / capture error for " + sizeName + ": "
                    + e.getClass().getSimpleName() + ": " + e.getMessage(), e);
            cleanupRender(webView, sizeName);
        }

        // Apply cached PNG (or fall through to placeholder if save failed).
        applyLastGood(ctx, appWidgetId, compact);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private static void cleanupRender(WebView webView, String sizeName) {
        try {
            webView.destroy();
        } catch (Exception e) {
            Log.w(TAG, "render cleanup failed for " + sizeName + ": " + e.getMessage());
        } finally {
            activeRenders.remove(sizeName);
        }
    }

    private static File cacheDir(Context ctx) {
        return new File(ctx.getFilesDir(), "widgets");
    }

    private static File cacheFile(Context ctx, String sizeName) {
        return new File(cacheDir(ctx), "widget_" + sizeName + ".png");
    }

    /**
     * Decode a PNG from the cache; returns null on failure. Applies a safety
     * inSampleSize if the decoded bitmap would exceed the safe RemoteViews limit.
     */
    private static Bitmap decodeSafe(File file) {
        try {
            BitmapFactory.Options probe = new BitmapFactory.Options();
            probe.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(file.getPath(), probe);

            BitmapFactory.Options opts = new BitmapFactory.Options();
            // 900 KB safety margin (RemoteViews Binder limit is ~1 MB).
            long estimatedBytes = (long) probe.outWidth * probe.outHeight * 4;
            if (estimatedBytes > 900_000L) {
                opts.inSampleSize = 2;
            }
            return BitmapFactory.decodeFile(file.getPath(), opts);
        } catch (Exception e) {
            Log.w(TAG, "cache decode failed: " + e.getMessage());
            return null;
        }
    }

    static String readSnapshotJson(Context ctx) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String raw = prefs.getString(SNAPSHOT_KEY, null);
        raw = normalizeSnapshotJson(raw);
        if (raw == null || raw.trim().isEmpty()) {
            Log.w(TAG, "snapshot read: missing key=" + SNAPSHOT_KEY + " prefs=" + PREFS_NAME);
            return null;
        }
        try {
            JSONObject parsed = new JSONObject(raw);
            Log.d(TAG, "snapshot read: ok length=" + raw.length()
                    + " room=" + parsed.optString("roomName", "<missing>")
                    + " saved=" + parsed.optDouble("saved", -1)
                    + " goal=" + parsed.optDouble("goal", -1)
                    + " progress=" + parsed.optDouble("progressPct", -1));
        } catch (JSONException e) {
            Log.e(TAG, "snapshot read: invalid JSON length=" + raw.length()
                    + " error=" + e.getMessage());
        }
        return raw;
    }

    private static String normalizeSnapshotJson(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        if (trimmed.isEmpty() || "null".equalsIgnoreCase(trimmed)
                || "undefined".equalsIgnoreCase(trimmed)) {
            return null;
        }
        return trimmed;
    }

    private static Bitmap placeholderBitmap(boolean compact) {
        int width = compact ? MAX_PX_SMALL : MAX_PX_MEDIUM_W;
        int height = compact ? MAX_PX_SMALL : MAX_PX_MEDIUM_H;
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(Color.TRANSPARENT);
        canvas.drawColor(Color.TRANSPARENT);

        paint.setColor(Color.parseColor("#FBF1E7"));
        float radius = compact ? 28f : 30f;
        canvas.drawRoundRect(0, 0, width, height, radius, radius, paint);

        paint.setTextAlign(Paint.Align.CENTER);
        paint.setColor(Color.parseColor("#5F4636"));
        paint.setTypeface(android.graphics.Typeface.create(android.graphics.Typeface.MONOSPACE,
                android.graphics.Typeface.BOLD));
        paint.setTextSize(compact ? 18f : 22f);
        drawCenteredText(canvas, paint, "Open GO-OUT", width / 2f, height / 2f - 10f);

        paint.setColor(Color.parseColor("#8A6E5A"));
        paint.setTypeface(android.graphics.Typeface.create(android.graphics.Typeface.MONOSPACE,
                android.graphics.Typeface.NORMAL));
        paint.setTextSize(compact ? 13f : 16f);
        drawCenteredText(canvas, paint, "to sync widget", width / 2f, height / 2f + 18f);

        return bitmap;
    }

    private static void drawCenteredText(Canvas canvas, Paint paint, String text, float x, float y) {
        Rect bounds = new Rect();
        paint.getTextBounds(text, 0, text.length(), bounds);
        canvas.drawText(text, x, y - bounds.exactCenterY(), paint);
    }

    private static String decodeJsString(String value) {
        if (value == null || "null".equals(value)) return "";
        try {
            if (value.startsWith("\"")) {
                return new JSONArray("[" + value + "]").getString(0);
            }
        } catch (JSONException e) {
            Log.w(TAG, "JS string decode failed: " + e.getMessage());
        }
        return value;
    }

    private static JSONObject parseJsJsonObject(String value) throws JSONException {
        String decoded = decodeJsString(value);
        if (decoded == null || decoded.isEmpty()) {
            return new JSONObject();
        }
        return new JSONObject(decoded);
    }

    private static PendingIntent dashboardIntent(Context ctx) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("goout://dashboard"));
        intent.setPackage(ctx.getPackageName());
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, 3, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // -------------------------------------------------------------------------
    // PathHandler: maps every request → assets/public/<path>
    // -------------------------------------------------------------------------

    /**
     * Serves the bundled web assets from assets/public/. All Vite-emitted
     * absolute /assets/ paths (e.g. /assets/index-abc.js) resolve to
     * assets/public/assets/index-abc.js. Unknown SPA paths fall back to
     * assets/public/index.html so React Router can handle them.
     */
    static class PublicAssetsPathHandler implements WebViewAssetLoader.PathHandler {

        private final AssetManager assets;

        PublicAssetsPathHandler(Context ctx) {
            this.assets = ctx.getAssets();
        }

        @Override
        public WebResourceResponse handle(String path) {
            if (path == null || path.isEmpty()) path = "index.html";
            String assetPath = "public/" + path;
            try {
                InputStream is = assets.open(assetPath);
                if ("index.html".equals(path) || path.startsWith("assets/")) {
                    Log.d(TAG, "asset served: " + path + " mime=" + mimeType(path));
                }
                return new WebResourceResponse(mimeType(path), "utf-8", is);
            } catch (IOException e) {
                // SPA fallback: serve index.html for non-file routes (no extension or
                // unknown extension), so React Router matches /widget/small etc.
                if (!isKnownFileRequest(path)) {
                    try {
                        InputStream is = assets.open("public/index.html");
                        Log.d(TAG, "asset fallback to index.html for route: " + path);
                        return new WebResourceResponse("text/html", "utf-8", is);
                    } catch (IOException ignored) {
                        Log.e(TAG, "asset fallback failed for route: " + path);
                    }
                }
                Log.e(TAG, "asset missing: " + path);
                return null;
            }
        }

        private static boolean isKnownFileRequest(String path) {
            int dot = path.lastIndexOf('.');
            if (dot < 0) return false;
            String ext = path.substring(dot).toLowerCase();
            return ext.equals(".js") || ext.equals(".mjs") || ext.equals(".css")
                    || ext.equals(".html") || ext.equals(".json") || ext.equals(".png")
                    || ext.equals(".jpg") || ext.equals(".jpeg") || ext.equals(".svg")
                    || ext.equals(".woff") || ext.equals(".woff2") || ext.equals(".ttf")
                    || ext.equals(".ico") || ext.equals(".webmanifest")
                    || ext.equals(".txt") || ext.equals(".map");
        }

        private static String mimeType(String path) {
            String p = path.toLowerCase();
            if (p.endsWith(".js") || p.endsWith(".mjs")) return "application/javascript";
            if (p.endsWith(".css")) return "text/css";
            if (p.endsWith(".html")) return "text/html";
            if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json";
            if (p.endsWith(".png")) return "image/png";
            if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
            if (p.endsWith(".svg")) return "image/svg+xml";
            if (p.endsWith(".woff2")) return "font/woff2";
            if (p.endsWith(".woff")) return "font/woff";
            if (p.endsWith(".ttf")) return "font/truetype";
            if (p.endsWith(".ico")) return "image/x-icon";
            return "application/octet-stream";
        }
    }
}
