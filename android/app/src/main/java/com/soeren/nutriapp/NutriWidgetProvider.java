package com.soeren.nutriapp;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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
 */
public class NutriWidgetProvider extends AppWidgetProvider {
    static final String PREFS = "nutri_widget";

    /** Layout dieser Widget-Größe; Unterklassen überschreiben es. */
    protected int layoutRes() {
        return R.layout.nutri_widget;
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, build(context, layoutRes()));
        }
    }

    /** Alle platzierten Widgets aller Größen neu zeichnen (nach neuen Werten aus der App). */
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        refresh(context, manager, NutriWidgetSmallProvider.class, R.layout.nutri_widget_small);
        refresh(context, manager, NutriWidgetProvider.class, R.layout.nutri_widget);
        refresh(context, manager, NutriWidgetLargeProvider.class, R.layout.nutri_widget_large);
    }

    private static void refresh(Context context, AppWidgetManager manager, Class<?> provider, int layout) {
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, provider));
        for (int id : ids) {
            manager.updateAppWidget(id, build(context, layout));
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

    static RemoteViews build(Context context, int layout) {
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

        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch != null) {
            PendingIntent pending = PendingIntent.getActivity(
                    context, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_root, pending);
        }
        return views;
    }
}
