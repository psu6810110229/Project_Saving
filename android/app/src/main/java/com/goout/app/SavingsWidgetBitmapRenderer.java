package com.goout.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.text.TextPaint;
import android.text.TextUtils;
import android.util.TypedValue;

import androidx.core.content.ContextCompat;
import androidx.core.content.res.ResourcesCompat;

final class SavingsWidgetBitmapRenderer {

    private static Typeface sansRegular;
    private static Typeface sansSemibold;

    private SavingsWidgetBitmapRenderer() {}

    static Bitmap render(Context context, SavingsWidget.Snapshot snap, boolean compact,
                         int widthDp, int heightDp) {
        int widthPx = Math.max(1, Math.round(dp(context, widthDp)));
        int heightPx = Math.max(1, Math.round(dp(context, heightDp)));
        Bitmap bitmap = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        if (compact) {
            drawCompact(context, canvas, snap, widthPx, heightPx);
        } else {
            drawLarge(context, canvas, snap, widthPx, heightPx);
        }

        return bitmap;
    }

    private static void drawLarge(Context context, Canvas canvas, SavingsWidget.Snapshot snap,
                                  int width, int height) {
        float scale = Math.min(1f, height / dp(context, 110f));
        LargeLayout layout = createLargeLayout(context, scale);
        float targetHeight = height - dp(context, 1f);

        for (int pass = 0; pass < 4; pass++) {
            float requiredHeight = requiredLargeHeight(layout);
            if (requiredHeight <= targetHeight) break;
            float shrink = targetHeight / requiredHeight;
            scale = Math.max(0.58f, scale * shrink);
            layout = createLargeLayout(context, scale);
        }

        drawBackground(canvas, width, height, layout.outerRadius);

        String room = snap == null ? context.getString(R.string.app_name) : snap.roomName;
        String chip = snap == null ? "" : SavingsWidget.streakLabel(snap);
        String hero = snap == null ? context.getString(R.string.widget_empty) : SavingsWidget.heroText(context, snap);
        String sub = snap == null ? "" : SavingsWidget.dueLabel(context, snap);
        String savedLabel = snap == null
                ? ""
                : ("no_plan".equals(snap.todayState)
                    ? context.getString(R.string.widget_current_progress)
                    : context.getString(R.string.widget_overall_progress));
        String saved = snap == null ? "" : SavingsWidget.savedLine(context, snap);
        String pct = snap == null ? "" : snap.progressPct + "%";
        String support = snap == null ? "" : SavingsWidget.supportLine(context, snap);
        int progress = snap == null ? 0 : SavingsWidget.clampPct(snap.progressPct);

        float top = layout.pad;
        float contentWidth = width - (layout.pad * 2f);
        layout.roomPaint.setLetterSpacing(shouldTrack(room) ? 0.12f : 0f);

        float chipWidth = chip.isEmpty() ? 0f : measureStreakChipWidth(layout, chip);
        float gap = chip.isEmpty() ? 0f : layout.roomChipGap;
        float roomMaxWidth = contentWidth - chipWidth - gap;
        drawText(canvas, ellipsize(layout.roomPaint, room, roomMaxWidth).toString(), layout.pad, top, layout.roomPaint);

        if (!chip.isEmpty()) {
            float chipX = width - layout.pad - chipWidth;
            float chipY = top;
            drawStreakChip(canvas, chipX, chipY, chipWidth, layout.chipHeight, layout, chip);
        }

        float roomRowHeight = Math.max(textHeight(layout.roomPaint), chip.isEmpty() ? 0f : layout.chipHeight);
        float roomBottom = top + roomRowHeight;
        float heroTop = roomBottom + layout.roomHeroGap;
        float heroBaseline = baselineFromTop(heroTop, layout.heroPaint);
        float heroMaxWidth = contentWidth - layout.heroReservedRight;
        String heroText = ellipsize(layout.heroPaint, hero, heroMaxWidth).toString();
        canvas.drawText(heroText, layout.pad, heroBaseline, layout.heroPaint);

        float heroWidth = layout.heroPaint.measureText(heroText);
        float subX = layout.pad + heroWidth + layout.heroSubGap;
        float subBaseline = heroBaseline - layout.heroPaint.descent() + layout.subPaint.descent();
        float subMaxWidth = width - layout.pad - subX;
        if (subMaxWidth > 0f && !sub.isEmpty()) {
            canvas.drawText(ellipsize(layout.subPaint, sub, subMaxWidth).toString(), subX, subBaseline, layout.subPaint);
        }

        float topBlockBottom = heroTop + textHeight(layout.heroPaint);
        float buttonTop = height - layout.pad - layout.buttonHeight;
        float panelSlotTop = topBlockBottom + layout.heroPanelGap;
        float panelSlotBottom = buttonTop - layout.panelButtonsGap;
        float panelSlotHeight = Math.max(0f, panelSlotBottom - panelSlotTop);
        float panelHeight = Math.min(layout.preferredPanelHeight(), panelSlotHeight);
        float panelTop = panelSlotTop + Math.max(0f, (panelSlotHeight - panelHeight) / 2f);
        float panelBottom = panelTop + panelHeight;
        RectF panelRect = new RectF(layout.pad, panelTop, width - layout.pad, panelBottom);
        if (panelRect.height() > 0f) {
            drawPanel(canvas, panelRect, Math.min(layout.panelRadius, panelRect.height() / 2f));
        }

        if (panelRect.height() > (layout.panelPadY * 2f) + layout.progressHeight) {
            float panelInnerLeft = panelRect.left + layout.panelPadX;
            float panelInnerRight = panelRect.right - layout.panelPadX;
            float panelInnerTop = panelRect.top + layout.panelPadY;

            float rightColWidth = Math.min(layout.rightColWidth, contentWidth * 0.24f);
            float labelRightGap = layout.labelRightGap;
            float leftColWidth = panelInnerRight - panelInnerLeft - rightColWidth - labelRightGap;

            float progressTop = panelRect.bottom - layout.panelPadY - layout.progressHeight;
            float infoBottom = progressTop - layout.infoProgressGap;
            float leftFullHeight = textHeight(layout.labelPaint) + layout.labelSavedGap + textHeight(layout.savedPaint);
            boolean showLabel = infoBottom - panelInnerTop >= leftFullHeight;
            float savedTop = showLabel
                    ? panelInnerTop + textHeight(layout.labelPaint) + layout.labelSavedGap
                    : panelInnerTop;

            if (showLabel) {
                drawText(canvas,
                        ellipsize(layout.labelPaint, savedLabel, leftColWidth).toString(),
                        panelInnerLeft,
                        panelInnerTop,
                        layout.labelPaint);
            }

            drawText(canvas,
                    ellipsize(layout.savedPaint, saved, leftColWidth).toString(),
                    panelInnerLeft,
                    savedTop,
                    layout.savedPaint);

            drawTextRight(canvas,
                    ellipsize(layout.pctPaint, pct, rightColWidth).toString(),
                    panelInnerRight,
                    panelInnerTop,
                    layout.pctPaint);

            float supportTop = panelInnerTop + textHeight(layout.pctPaint) + layout.pctSupportGap;
            boolean showSupport = infoBottom - supportTop >= textHeight(layout.supportPaint);
            if (showSupport) {
                drawTextRight(canvas,
                        ellipsize(layout.supportPaint, support, rightColWidth).toString(),
                        panelInnerRight,
                        supportTop,
                        layout.supportPaint);
            }

            drawProgress(canvas,
                    panelInnerLeft,
                    progressTop,
                    panelInnerRight - panelInnerLeft,
                    layout.progressHeight,
                    progress,
                    true);
        }

        float buttonWidth = (contentWidth - layout.buttonGap) / 2f;
        drawButton(canvas, layout.pad, buttonTop, buttonWidth, layout.buttonHeight, layout.buttonRadius, true, true, actionLabel(context, R.string.widget_add, "+"), layout.buttonPrimaryPaint);
        drawButton(canvas, layout.pad + buttonWidth + layout.buttonGap, buttonTop, buttonWidth, layout.buttonHeight, layout.buttonRadius, false, true, actionLabel(context, R.string.widget_check, "\u2713"), layout.buttonSecondaryPaint);
    }

    private static void drawCompact(Context context, Canvas canvas, SavingsWidget.Snapshot snap,
                                    int width, int height) {
        float pad = dp(context, 10f);
        float buttonHeight = dp(context, 34f);
        float outerRadius = dp(context, 28f);

        drawBackground(canvas, width, height, outerRadius);

        TextPaint roomPaint = newPaint(context, true, 10f, ContextCompat.getColor(context, R.color.widget_ink_muted));
        roomPaint.setLetterSpacing(0.12f);
        TextPaint heroPaint = newPaint(context, true, 23f, ContextCompat.getColor(context, R.color.widget_ink));
        TextPaint subPaint = newPaint(context, true, 10f, ContextCompat.getColor(context, R.color.widget_brand_deep));
        TextPaint supportPaint = newPaint(context, false, 9f, ContextCompat.getColor(context, R.color.widget_ink_muted));
        TextPaint buttonPaint = newPaint(context, true, 12f, ContextCompat.getColor(context, R.color.widget_surface));

        String room = snap == null ? context.getString(R.string.app_name) : snap.roomName;
        String hero = snap == null ? context.getString(R.string.widget_empty) : SavingsWidget.heroText(context, snap);
        String sub = snap == null ? "" : SavingsWidget.compactLabel(context, snap);
        String support = snap == null ? "" : SavingsWidget.compactSupportLine(context, snap);
        int progress = snap == null ? 0 : SavingsWidget.clampPct(snap.progressPct);

        float contentWidth = width - (pad * 2f);
        roomPaint.setLetterSpacing(shouldTrack(room) ? 0.12f : 0f);
        drawText(canvas, ellipsize(roomPaint, room, contentWidth).toString(), pad, pad, roomPaint);

        float heroTop = pad + textHeight(roomPaint) + dp(context, 8f);
        float heroBaseline = baselineFromTop(heroTop, heroPaint);
        float heroMaxWidth = contentWidth - dp(context, 42f);
        String heroText = ellipsize(heroPaint, hero, heroMaxWidth).toString();
        canvas.drawText(heroText, pad, heroBaseline, heroPaint);

        float heroWidth = heroPaint.measureText(heroText);
        float subX = pad + heroWidth + dp(context, 6f);
        float subBaseline = heroBaseline - heroPaint.descent() + subPaint.descent();
        float subMaxWidth = width - pad - subX;
        if (subMaxWidth > 0f && !sub.isEmpty()) {
            canvas.drawText(ellipsize(subPaint, sub, subMaxWidth).toString(), subX, subBaseline, subPaint);
        }

        float supportTop = heroTop + textHeight(heroPaint) + dp(context, 5f);
        drawText(canvas, ellipsize(supportPaint, support, contentWidth).toString(), pad, supportTop, supportPaint);

        float progressTop = supportTop + textHeight(supportPaint) + dp(context, 8f);
        drawProgress(
                canvas,
                pad,
                progressTop,
                contentWidth,
                dp(context, 4f),
                progress,
                false
        );

        drawButton(canvas, pad, height - pad - buttonHeight, contentWidth, buttonHeight, dp(context, 14f), true, true, actionLabel(context, R.string.widget_add, "+"), buttonPaint);
    }

    private static LargeLayout createLargeLayout(Context context, float scale) {
        TextPaint roomPaint = newPaint(context, true, 8f * scale, ContextCompat.getColor(context, R.color.widget_ink_muted));
        roomPaint.setLetterSpacing(0.12f);

        TextPaint heroPaint = newPaint(context, true, 18f * scale, ContextCompat.getColor(context, R.color.widget_ink));
        TextPaint subPaint = newPaint(context, true, 8f * scale, ContextCompat.getColor(context, R.color.widget_brand_deep));
        TextPaint chipPaint = newPaint(context, true, 7.5f * scale, ContextCompat.getColor(context, R.color.widget_brand_deep));

        TextPaint labelPaint = newPaint(context, true, 7.5f * scale, ContextCompat.getColor(context, R.color.widget_ink_muted));
        labelPaint.setLetterSpacing(0.08f);

        TextPaint savedPaint = newPaint(context, true, 11.5f * scale, ContextCompat.getColor(context, R.color.widget_ink));
        TextPaint pctPaint = newPaint(context, true, 7.5f * scale, ContextCompat.getColor(context, R.color.widget_brand_deep));
        TextPaint supportPaint = newPaint(context, false, 7f * scale, ContextCompat.getColor(context, R.color.widget_ink_muted));
        TextPaint buttonPrimaryPaint = newPaint(context, true, 10f * scale, ContextCompat.getColor(context, R.color.widget_surface));
        TextPaint buttonSecondaryPaint = newPaint(context, true, 10f * scale, ContextCompat.getColor(context, R.color.widget_ink));

        return new LargeLayout(
                dp(context, 10f * scale),
                dp(context, 24f * scale),
                dp(context, 8f * scale),
                dp(context, 28f),
                dp(context, 20f * scale),
                dp(context, 8f * scale),
                dp(context, 8f * scale),
                dp(context, 3f * scale),
                dp(context, 52f * scale),
                dp(context, 6f * scale),
                dp(context, 5f * scale),
                dp(context, 7f * scale),
                dp(context, 10f * scale),
                dp(context, 7f * scale),
                dp(context, 16f * scale),
                dp(context, 34f * scale),
                dp(context, 6f * scale),
                dp(context, 1f * scale),
                dp(context, 1f * scale),
                dp(context, 3f * scale),
                dp(context, 4f * scale),
                dp(context, 12f * scale),
                roomPaint,
                heroPaint,
                subPaint,
                chipPaint,
                labelPaint,
                savedPaint,
                pctPaint,
                supportPaint,
                buttonPrimaryPaint,
                buttonSecondaryPaint
        );
    }

    private static float requiredLargeHeight(LargeLayout layout) {
        float roomRowHeight = Math.max(textHeight(layout.roomPaint), layout.chipHeight);
        float heroRowHeight = textHeight(layout.heroPaint);
        return layout.pad
                + roomRowHeight
                + layout.roomHeroGap
                + heroRowHeight
                + layout.heroPanelGap
                + layout.minimumPanelHeight()
                + layout.panelButtonsGap
                + layout.buttonHeight
                + layout.pad;
    }

    private static void drawBackground(Canvas canvas, int width, int height, float radius) {
        Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        bgPaint.setShader(new LinearGradient(
                0f, 0f, width, height,
                new int[] {
                        Color.parseColor("#FBF1E7"),
                        Color.parseColor("#F7EBDD"),
                        Color.parseColor("#EFDCC8")
                },
                new float[] { 0f, 0.56f, 1f },
                Shader.TileMode.CLAMP
        ));
        canvas.drawRoundRect(new RectF(0f, 0f, width, height), radius, radius, bgPaint);
    }

    private static void drawPanel(Canvas canvas, RectF rect, float radius) {
        Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        fill.setColor(Color.parseColor("#CCFFFFFF"));
        canvas.drawRoundRect(rect, radius, radius, fill);

        Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeWidth(1f);
        stroke.setColor(Color.parseColor("#EDE1D4"));
        canvas.drawRoundRect(rect, radius, radius, stroke);
    }

    private static void drawChip(Canvas canvas, float x, float y, float width, float height,
                                 float horizontalPadding, String text, TextPaint textPaint) {
        Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        fill.setColor(Color.parseColor("#CCFFFFFF"));
        RectF rect = new RectF(x, y, x + width, y + height);
        canvas.drawRoundRect(rect, height / 2f, height / 2f, fill);

        float textX = x + horizontalPadding;
        float textY = y + ((height - textHeight(textPaint)) / 2f);
        drawText(canvas, text, textX, textY, textPaint);
    }

    private static void drawStreakChip(Canvas canvas, float x, float y, float width, float height,
                                       LargeLayout layout, String text) {
        Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        fill.setColor(Color.parseColor("#CCFFFFFF"));
        RectF rect = new RectF(x, y, x + width, y + height);
        canvas.drawRoundRect(rect, height / 2f, height / 2f, fill);

        float iconSize = height * 0.46f;
        float iconLeft = x + layout.chipHorizontalPadding;
        float iconTop = y + ((height - iconSize) / 2f);
        drawFlameMark(canvas, iconLeft, iconTop, iconSize);

        float textX = iconLeft + iconSize + (height * 0.2f);
        float textY = y + ((height - textHeight(layout.chipPaint)) / 2f);
        drawText(canvas, text, textX, textY, layout.chipPaint);
    }

    private static void drawFlameMark(Canvas canvas, float x, float y, float size) {
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(Color.parseColor("#F26B1A"));

        Path flame = new Path();
        flame.moveTo(x + size * 0.5f, y + size * 0.05f);
        flame.cubicTo(x + size * 0.9f, y + size * 0.34f, x + size * 0.78f, y + size * 0.92f, x + size * 0.5f, y + size);
        flame.cubicTo(x + size * 0.18f, y + size * 0.88f, x + size * 0.08f, y + size * 0.46f, x + size * 0.36f, y + size * 0.25f);
        flame.cubicTo(x + size * 0.38f, y + size * 0.44f, x + size * 0.55f, y + size * 0.42f, x + size * 0.5f, y + size * 0.05f);
        flame.close();
        canvas.drawPath(flame, paint);

        paint.setColor(Color.parseColor("#FFE0BC"));
        canvas.drawCircle(x + size * 0.5f, y + size * 0.68f, size * 0.17f, paint);
    }

    private static void drawProgress(Canvas canvas, float x, float y, float width, float height,
                                     int progressPct, boolean enforceMinimumFill) {
        Paint track = new Paint(Paint.ANTI_ALIAS_FLAG);
        track.setColor(Color.parseColor("#E8D6C6"));
        RectF trackRect = new RectF(x, y, x + width, y + height);
        canvas.drawRoundRect(trackRect, height / 2f, height / 2f, track);

        float pct = Math.max(0f, Math.min(100f, progressPct));
        float fillPct = enforceMinimumFill && pct > 0f ? Math.max(pct, 6f) : pct;
        if (fillPct <= 0f) return;

        Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        fill.setColor(Color.parseColor("#F26B1A"));
        RectF fillRect = new RectF(x, y, x + (width * (fillPct / 100f)), y + height);
        canvas.drawRoundRect(fillRect, height / 2f, height / 2f, fill);
    }

    private static void drawButton(Canvas canvas, float x, float y, float width, float height,
                                   float radius, boolean primary, boolean shadow, String text, TextPaint textPaint) {
        Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        fill.setColor(primary ? Color.parseColor("#F26B1A") : Color.parseColor("#CCFFFFFF"));
        if (shadow) {
            fill.setShadowLayer(height * 0.18f, 0f, height * 0.08f, Color.parseColor("#26000000"));
            canvas.save();
            canvas.clipRect(x - height, y - height, x + width + height, y + height + height);
        }
        RectF rect = new RectF(x, y, x + width, y + height);
        canvas.drawRoundRect(rect, radius, radius, fill);
        if (shadow) {
            canvas.restore();
        }

        if (!primary) {
            Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
            stroke.setStyle(Paint.Style.STROKE);
            stroke.setStrokeWidth(1f);
            stroke.setColor(Color.parseColor("#EFE3D6"));
            canvas.drawRoundRect(rect, radius, radius, stroke);
        }

        CharSequence label = ellipsize(textPaint, text, width - (height * 0.55f));
        float textWidth = textPaint.measureText(label, 0, label.length());
        float textTop = y + ((height - textHeight(textPaint)) / 2f);
        float textX = x + ((width - textWidth) / 2f);
        drawText(canvas, label.toString(), textX, textTop, textPaint);
    }

    private static TextPaint newPaint(Context context, boolean semibold, float sizeSp, int color) {
        TextPaint paint = new TextPaint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG | Paint.DITHER_FLAG);
        paint.setColor(color);
        paint.setTextSize(sp(context, sizeSp));
        paint.setTypeface(getTypeface(context, semibold));
        return paint;
    }

    private static Typeface getTypeface(Context context, boolean semibold) {
        if (semibold) {
            if (sansSemibold == null) {
                sansSemibold = ResourcesCompat.getFont(context, R.font.ibm_plex_sans_thai_semibold);
            }
            return sansSemibold != null ? sansSemibold : Typeface.DEFAULT_BOLD;
        }
        if (sansRegular == null) {
            sansRegular = ResourcesCompat.getFont(context, R.font.ibm_plex_sans_thai_regular);
        }
        return sansRegular != null ? sansRegular : Typeface.DEFAULT;
    }

    private static CharSequence ellipsize(TextPaint paint, String text, float maxWidth) {
        if (text == null) return "";
        return TextUtils.ellipsize(text, paint, Math.max(0f, maxWidth), TextUtils.TruncateAt.END);
    }

    private static String actionLabel(Context context, int stringId, String icon) {
        String label = context.getString(stringId).trim();
        while (label.startsWith("+")
                || label.startsWith("\uFF0B")
                || label.startsWith("\u2713")
                || label.startsWith("\u2714")
                || label.startsWith(" ")) {
            label = label.substring(1).trim();
        }
        return icon + " " + label;
    }

    private static boolean shouldTrack(String text) {
        if (text == null || text.isEmpty()) return false;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c > 127) return false;
        }
        return true;
    }

    private static void drawText(Canvas canvas, String text, float x, float top, TextPaint paint) {
        canvas.drawText(text, x, baselineFromTop(top, paint), paint);
    }

    private static void drawTextRight(Canvas canvas, String text, float right, float top, TextPaint paint) {
        float width = paint.measureText(text);
        drawText(canvas, text, right - width, top, paint);
    }

    private static float baselineFromTop(float top, Paint paint) {
        return top - paint.getFontMetrics().ascent;
    }

    private static float textHeight(Paint paint) {
        Paint.FontMetrics metrics = paint.getFontMetrics();
        return metrics.descent - metrics.ascent;
    }

    private static float measureChipWidth(TextPaint paint, String text, float horizontalPadding) {
        return (horizontalPadding * 2f) + paint.measureText(text);
    }

    private static float measureStreakChipWidth(LargeLayout layout, String text) {
        return (layout.chipHorizontalPadding * 2f)
                + (layout.chipHeight * 0.46f)
                + (layout.chipHeight * 0.2f)
                + layout.chipPaint.measureText(text);
    }

    private static float dp(Context context, float value) {
        return TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                value,
                context.getResources().getDisplayMetrics()
        );
    }

    private static float sp(Context context, float value) {
        return TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_SP,
                value,
                context.getResources().getDisplayMetrics()
        );
    }

    private static final class LargeLayout {
        final float pad;
        final float buttonHeight;
        final float buttonGap;
        final float outerRadius;
        final float chipHeight;
        final float chipHorizontalPadding;
        final float roomChipGap;
        final float roomHeroGap;
        final float heroReservedRight;
        final float heroSubGap;
        final float heroPanelGap;
        final float panelButtonsGap;
        final float panelPadX;
        final float panelPadY;
        final float panelRadius;
        final float rightColWidth;
        final float labelRightGap;
        final float labelSavedGap;
        final float pctSupportGap;
        final float infoProgressGap;
        final float progressHeight;
        final float buttonRadius;
        final TextPaint roomPaint;
        final TextPaint heroPaint;
        final TextPaint subPaint;
        final TextPaint chipPaint;
        final TextPaint labelPaint;
        final TextPaint savedPaint;
        final TextPaint pctPaint;
        final TextPaint supportPaint;
        final TextPaint buttonPrimaryPaint;
        final TextPaint buttonSecondaryPaint;

        LargeLayout(
                float pad,
                float buttonHeight,
                float buttonGap,
                float outerRadius,
                float chipHeight,
                float chipHorizontalPadding,
                float roomChipGap,
                float roomHeroGap,
                float heroReservedRight,
                float heroSubGap,
                float heroPanelGap,
                float panelButtonsGap,
                float panelPadX,
                float panelPadY,
                float panelRadius,
                float rightColWidth,
                float labelRightGap,
                float labelSavedGap,
                float pctSupportGap,
                float infoProgressGap,
                float progressHeight,
                float buttonRadius,
                TextPaint roomPaint,
                TextPaint heroPaint,
                TextPaint subPaint,
                TextPaint chipPaint,
                TextPaint labelPaint,
                TextPaint savedPaint,
                TextPaint pctPaint,
                TextPaint supportPaint,
                TextPaint buttonPrimaryPaint,
                TextPaint buttonSecondaryPaint
        ) {
            this.pad = pad;
            this.buttonHeight = buttonHeight;
            this.buttonGap = buttonGap;
            this.outerRadius = outerRadius;
            this.chipHeight = chipHeight;
            this.chipHorizontalPadding = chipHorizontalPadding;
            this.roomChipGap = roomChipGap;
            this.roomHeroGap = roomHeroGap;
            this.heroReservedRight = heroReservedRight;
            this.heroSubGap = heroSubGap;
            this.heroPanelGap = heroPanelGap;
            this.panelButtonsGap = panelButtonsGap;
            this.panelPadX = panelPadX;
            this.panelPadY = panelPadY;
            this.panelRadius = panelRadius;
            this.rightColWidth = rightColWidth;
            this.labelRightGap = labelRightGap;
            this.labelSavedGap = labelSavedGap;
            this.pctSupportGap = pctSupportGap;
            this.infoProgressGap = infoProgressGap;
            this.progressHeight = progressHeight;
            this.buttonRadius = buttonRadius;
            this.roomPaint = roomPaint;
            this.heroPaint = heroPaint;
            this.subPaint = subPaint;
            this.chipPaint = chipPaint;
            this.labelPaint = labelPaint;
            this.savedPaint = savedPaint;
            this.pctPaint = pctPaint;
            this.supportPaint = supportPaint;
            this.buttonPrimaryPaint = buttonPrimaryPaint;
            this.buttonSecondaryPaint = buttonSecondaryPaint;
        }

        float minimumPanelHeight() {
            float leftBlockHeight = textHeight(labelPaint) + labelSavedGap + textHeight(savedPaint);
            float rightBlockHeight = textHeight(pctPaint) + pctSupportGap + textHeight(supportPaint);
            float infoHeight = Math.max(leftBlockHeight, rightBlockHeight);
            return (panelPadY * 2f) + infoHeight + infoProgressGap + progressHeight;
        }

        float preferredPanelHeight() {
            return minimumPanelHeight() + panelPadY;
        }
    }
}
