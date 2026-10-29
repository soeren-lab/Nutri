package com.soeren.nutriapp;

/** Widget-Größe mit eigenem Layout, sonst identisch zum mittleren Widget. */
public class NutriWidgetSmallProvider extends NutriWidgetProvider {
    @Override
    protected int layoutRes() {
        return R.layout.nutri_widget_small;
    }
}
