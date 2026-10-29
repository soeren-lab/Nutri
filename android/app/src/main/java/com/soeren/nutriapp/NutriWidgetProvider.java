package com.soeren.nutriapp;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Startbildschirm-Widget (mittlere Größe, 4x2): Kalorien, Protein und Wasser von heute.
 * Die Varianten klein (2x1) und groß (4x3) erben davon und ändern nur das Layout.
 *
 * Die Werte schreibt die App (WidgetBridgePlugin) in SharedPreferences; das Widget liest sie nur.
 * Gehören die gespeicherten Werte zu einem anderen Tag, zeigt das Widget keine alten Zahlen,
 * sondern den Hinweis, die App zu öffnen.
 *
 * Der Stil (Farbe oder Glas, Transparenz) wird pro Widget in WidgetConfigActivity gewählt.
 */
public class NutriWidgetProvider extends AppWidgetProvider {
    static final String PREFS = "nutri_widget";
    static final String STYLE_COLOR = "color";
    static final String STYLE_GLASS = "glass";
    static final int DEFAULT_TRANSPARENCY = 50;

    /** Layout dieser Widget-Größe; Unterklassen überschreiben es. */
    protected int layoutRes() {
        return R.layout.nutri_widget;
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, build(context, manager, id, layoutRes()));
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int appWidgetId, Bundle newOptions) {
        manager.updateAppWidget(appWidgetId, build(context, manager, appWidgetId, layoutRes()));
    }

    @Override
    public void onDeleted(Context context, int[] appWidgetIds) {
        SharedPreferences.Editor e = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        for (int id : appWidgetIds) {
            e.remove("style_" + id).remove("transparency_" + id);
        }
        e.apply();
    }

    /** Alle platzierten Widgets aller Größen neu zeichnen (nach neuen Werten aus der App). */
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        refresh(context, manager, NutriWidgetSmallProvider.class, R.layout.nutri_widget_small);
        refresh(context, manager, NutriWidgetProvider.class, R.layout.nutri_widget);
        refresh(context, manager, NutriWidgetLargeProvider.class, R.layout.nutri_widget_large);
    }

    /** Ein einzelnes Widget neu zeichnen (nach dem Ändern des Stils). */
    static void refreshOne(Context context, int appWidgetId) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        manager.updateAppWidget(appWidgetId, build(context, manager, appWidgetId, layoutFor(manager, appWidgetId)));
    }

    /** Layout passend zur Größe, in der das Widget platziert wurde. */
    static int layoutFor(AppWidgetManager manager, int appWidgetId) {
        android.appwidget.AppWidgetProviderInfo info = manager.getAppWidgetInfo(appWidgetId);
        String cls = info != null && info.provider != null ? info.provider.getClassName() : "";
        if (cls.endsWith("NutriWidgetSmallProvider")) return R.layout.nutri_widget_small;
        if (cls.endsWith("NutriWidgetLargeProvider")) return R.layout.nutri_widget_large;
        return R.layout.nutri_widget;
    }

    private static void refresh(Context context, AppWidgetManager manager, Class<?> provider, int layout) {
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, provider));
        for (int id : ids) {
            manager.updateAppWidget(id, build(context, manager, id, layout));
        }
    }

    private static String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    private static String number(int value) {
        return String.format(Locale.GERMANY, "%,d", value);
    }

    private static int percent(int value, int target) {
        if (target <= 0) return 0;
        return Math.max(0, Math.min(100, Math.round(value * 100f / target)));
    }

    private static String liters(int ml) {
        if (ml >= 1000) {
            return String.format(Locale.GERMANY, "%.2f", ml / 1000f).replaceAll(",?0+$", "") + " l";
        }
        return ml + " ml";
    }

    static boolean isDark(Context context) {
        int mode = context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return mode == Configuration.UI_MODE_NIGHT_YES;
    }

    /** Größe des Widgets in Pixeln (für das Glas-Bild), sonst eine sinnvolle Standardgröße. */
    private static int[] sizePx(Context context, AppWidgetManager manager, int appWidgetId, int layout) {
        float density = context.getResources().getDisplayMetrics().density;
        Bundle o = manager.getAppWidgetOptions(appWidgetId);
        boolean landscape = context.getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;
        int wDp = o.getInt(landscape ? AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH : AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int hDp = o.getInt(landscape ? AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT : AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        if (wDp <= 0 || hDp <= 0) {
            wDp = layout == R.layout.nutri_widget_small ? 160 : 280;
            hDp = layout == R.layout.nutri_widget_small ? 72 : (layout == R.layout.nutri_widget_large ? 200 : 120);
        }
        float scale = density;
        // Widget-Bilder dürfen nicht zu groß werden (Speichergrenze der Widgets).
        float maxSide = 900f;
        float longest = Math.max(wDp, hDp) * scale;
        if (longest > maxSide) scale = scale * maxSide / longest;
        return new int[] {Math.max(1, Math.round(wDp * scale)), Math.max(1, Math.round(hDp * scale)), Math.round(scale * 1000)};
    }

    static RemoteViews build(Context context, AppWidgetManager manager, int appWidgetId, int layout) {
        RemoteViews views = new RemoteViews(context.getPackageName(), layout);
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        boolean fresh = today().equals(p.getString("date", ""));
        if (fresh) {
            int kcal = p.getInt("kcal", 0);
            int kcalTarget = p.getInt("kcalTarget", 0);
            int protein = p.getInt("protein", 0);
            int proteinTarget = p.getInt("proteinTarget", 0);
            int water = p.getInt("water", 0);
            int waterTarget = p.getInt("waterTarget", 0);
            int carbs = p.getInt("carbs", 0);
            int carbsTarget = p.getInt("carbsTarget", 0);
            int fat = p.getInt("fat", 0);
            int fatTarget = p.getInt("fatTarget", 0);

            views.setTextViewText(R.id.widget_kcal,
                    kcalTarget > 0 ? number(kcal) + " / " + number(kcalTarget) + " kcal" : number(kcal) + " kcal");
            views.setProgressBar(R.id.widget_kcal_bar, 100, percent(kcal, kcalTarget), false);

            views.setTextViewText(R.id.widget_protein,
                    proteinTarget > 0 ? protein + " / " + proteinTarget + " g" : protein + " g");
            views.setProgressBar(R.id.widget_protein_bar, 100, percent(protein, proteinTarget), false);

            views.setTextViewText(R.id.widget_water,
                    waterTarget > 0 ? liters(water) + " / " + liters(waterTarget) : liters(water));
            views.setProgressBar(R.id.widget_water_bar, 100, percent(water, waterTarget), false);

            // Nur im großen Layout vorhanden; fehlende Views ignoriert RemoteViews.
            views.setTextViewText(R.id.widget_carbs,
                    carbsTarget > 0 ? carbs + " / " + carbsTarget + " g" : carbs + " g");
            views.setProgressBar(R.id.widget_carbs_bar, 100, percent(carbs, carbsTarget), false);
            views.setTextViewText(R.id.widget_fat,
                    fatTarget > 0 ? fat + " / " + fatTarget + " g" : fat + " g");
            views.setProgressBar(R.id.widget_fat_bar, 100, percent(fat, fatTarget), false);

            views.setViewVisibility(R.id.widget_hint, View.GONE);
        } else {
            views.setTextViewText(R.id.widget_kcal, "–");
            views.setProgressBar(R.id.widget_kcal_bar, 100, 0, false);
            views.setTextViewText(R.id.widget_protein, "–");
            views.setProgressBar(R.id.widget_protein_bar, 100, 0, false);
            views.setTextViewText(R.id.widget_water, "–");
            views.setProgressBar(R.id.widget_water_bar, 100, 0, false);
            views.setTextViewText(R.id.widget_carbs, "–");
            views.setProgressBar(R.id.widget_carbs_bar, 100, 0, false);
            views.setTextViewText(R.id.widget_fat, "–");
            views.setProgressBar(R.id.widget_fat_bar, 100, 0, false);
            views.setViewVisibility(R.id.widget_hint, View.VISIBLE);
        }

        applyStyle(context, manager, appWidgetId, layout, views, p);

        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch != null) {
            PendingIntent pending = PendingIntent.getActivity(
                    context, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_root, pending);
        }
        return views;
    }

    /** Setzt Hintergrund und, beim Glas-Stil, passende Textfarben (Glas zeichnet das Bild fest hell oder dunkel). */
    static void applyStyle(Context context, AppWidgetManager manager, int appWidgetId, int layout,
                           RemoteViews views, SharedPreferences p) {
        String style = p.getString("style_" + appWidgetId, STYLE_COLOR);
        if (!STYLE_GLASS.equals(style)) {
            views.setImageViewResource(R.id.widget_bg, R.drawable.nutri_widget_bg);
            return;
        }
        boolean dark = isDark(context);
        int transparency = p.getInt("transparency_" + appWidgetId, DEFAULT_TRANSPARENCY);
        int[] size = sizePx(context, manager, appWidgetId, layout);
        views.setImageViewBitmap(R.id.widget_bg,
                GlassBackground.render(size[0], size[1], size[2] / 1000f, dark, transparency));

        int text = dark ? Color.rgb(246, 244, 255) : Color.rgb(31, 27, 46);
        int sub = dark ? Color.rgb(205, 200, 228) : Color.rgb(70, 66, 92);
        int[] strong = {R.id.widget_kcal, R.id.widget_protein, R.id.widget_water, R.id.widget_carbs, R.id.widget_fat};
        int[] weak = {R.id.widget_title, R.id.widget_l_protein, R.id.widget_l_water, R.id.widget_l_carbs,
                R.id.widget_l_fat, R.id.widget_hint};
        for (int id : strong) views.setTextColor(id, text);
        for (int id : weak) views.setTextColor(id, sub);
    }
}
