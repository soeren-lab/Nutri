package com.soeren.nutriapp;

/** Widget-Größe mit eigenem Layout, sonst identisch zum mittleren Widget. */
public class NutriWidgetLargeProvider extends NutriWidgetProvider {
    @Override
    protected int layoutRes() {
        return R.layout.nutri_widget_large;
    }
}
