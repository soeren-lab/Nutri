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
 * Startbildschirm-Widget: Kalorien, Protein und Wasser von heute.
 *
 * Die Werte schreibt die App (WidgetBridgePlugin) in SharedPreferences; das Widget liest sie nur.
 * Gehören die gespeicherten Werte zu einem anderen Tag, zeigt das Widget keine alten Zahlen,
 * sondern den Hinweis, die App zu öffnen.
 */
public class NutriWidgetProvider extends AppWidgetProvider {
    static final String PREFS = "nutri_widget";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, build(context));
        }
    }

    /** Alle platzierten Widgets neu zeichnen (nach neuen Werten aus der App). */
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, NutriWidgetProvider.class));
        for (int id : ids) {
            manager.updateAppWidget(id, build(context));
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

    static RemoteViews build(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.nutri_widget);
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        boolean fresh = today().equals(p.getString("date", ""));
        if (fresh) {
            int kcal = p.getInt("kcal", 0);
            int kcalTarget = p.getInt("kcalTarget", 0);
            int protein = p.getInt("protein", 0);
            int proteinTarget = p.getInt("proteinTarget", 0);
            int water = p.getInt("water", 0);
            int waterTarget = p.getInt("waterTarget", 0);

            views.setTextViewText(R.id.widget_kcal,
                    kcalTarget > 0 ? number(kcal) + " / " + number(kcalTarget) + " kcal" : number(kcal) + " kcal");
            views.setProgressBar(R.id.widget_kcal_bar, 100, percent(kcal, kcalTarget), false);

            views.setTextViewText(R.id.widget_protein,
                    proteinTarget > 0 ? protein + " / " + proteinTarget + " g" : protein + " g");
            views.setProgressBar(R.id.widget_protein_bar, 100, percent(protein, proteinTarget), false);

            views.setTextViewText(R.id.widget_water,
                    waterTarget > 0 ? liters(water) + " / " + liters(waterTarget) : liters(water));
            views.setProgressBar(R.id.widget_water_bar, 100, percent(water, waterTarget), false);

            views.setViewVisibility(R.id.widget_hint, View.GONE);
        } else {
            views.setTextViewText(R.id.widget_kcal, "–");
            views.setProgressBar(R.id.widget_kcal_bar, 100, 0, false);
            views.setTextViewText(R.id.widget_protein, "–");
            views.setProgressBar(R.id.widget_protein_bar, 100, 0, false);
            views.setTextViewText(R.id.widget_water, "–");
            views.setProgressBar(R.id.widget_water_bar, 100, 0, false);
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
