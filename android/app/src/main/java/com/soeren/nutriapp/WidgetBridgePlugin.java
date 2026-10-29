package com.soeren.nutriapp;

import android.content.Context;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Brücke App -> Widget: die Web-App meldet die heutigen Werte, das Widget zeichnet sich neu. */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        Context context = getContext();
        context.getSharedPreferences(NutriWidgetProvider.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString("date", call.getString("date", ""))
                .putInt("kcal", call.getInt("kcal", 0))
                .putInt("kcalTarget", call.getInt("kcalTarget", 0))
                .putInt("protein", call.getInt("protein", 0))
                .putInt("proteinTarget", call.getInt("proteinTarget", 0))
                .putInt("water", call.getInt("water", 0))
                .putInt("waterTarget", call.getInt("waterTarget", 0))
                .apply();
        NutriWidgetProvider.refreshAll(context);
        call.resolve();
    }
}
