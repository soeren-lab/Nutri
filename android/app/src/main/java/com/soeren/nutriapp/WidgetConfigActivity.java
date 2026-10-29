package com.soeren.nutriapp;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

/**
 * Einstellungen eines einzelnen Widgets: Stil Farbe oder Liquid Glass, beim Glas die Transparenz.
 * Öffnet sich beim Platzieren des Widgets und über "Einstellungen" im Menü des Widgets.
 * Die Vorschau ist das echte Widget-Layout, also genau das, was auf dem Startbildschirm erscheint.
 */
public class WidgetConfigActivity extends AppCompatActivity {
    private int appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    private int layout;
    private String style = NutriWidgetProvider.STYLE_COLOR;
    private int transparency = NutriWidgetProvider.DEFAULT_TRANSPARENCY;

    private View preview;
    private TextView transparencyLabel;
    private SeekBar transparencyBar;

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Abbrechen (Zurück) darf das Widget nicht hinzufügen.
        setResult(RESULT_CANCELED);

        Intent intent = getIntent();
        if (intent != null && intent.getExtras() != null) {
            appWidgetId = intent.getExtras().getInt(
                    AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        }
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }
        setResult(RESULT_CANCELED, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId));

        AppWidgetManager manager = AppWidgetManager.getInstance(this);
        layout = NutriWidgetProvider.layoutFor(manager, appWidgetId);
        SharedPreferences p = getSharedPreferences(NutriWidgetProvider.PREFS, Context.MODE_PRIVATE);
        style = p.getString("style_" + appWidgetId, NutriWidgetProvider.STYLE_COLOR);
        transparency = p.getInt("transparency_" + appWidgetId, NutriWidgetProvider.DEFAULT_TRANSPARENCY);

        buildUi();
        updatePreview();
    }

    private void buildUi() {
        TypedValue bg = new TypedValue();
        getTheme().resolveAttribute(android.R.attr.colorBackground, bg, true);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(bg.data);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(dp(20), dp(28), dp(20), dp(24));
        scroll.addView(col);

        TextView title = new TextView(this);
        title.setText("Widget-Stil");
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        col.addView(title);

        // Vorschau auf einem bunten Hintergrund, damit man das Glas erkennt
        int panelH = layout == R.layout.nutri_widget_small ? 140 : (layout == R.layout.nutri_widget_large ? 260 : 190);
        FrameLayout panel = new FrameLayout(this);
        GradientDrawable wall = new GradientDrawable(GradientDrawable.Orientation.TL_BR,
                new int[] {Color.rgb(76, 29, 149), Color.rgb(190, 60, 140), Color.rgb(249, 145, 80)});
        wall.setCornerRadius(dp(20));
        panel.setBackground(wall);
        LinearLayout.LayoutParams panelLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(panelH));
        panelLp.topMargin = dp(18);
        col.addView(panel, panelLp);

        int wDp = layout == R.layout.nutri_widget_small ? 160 : 280;
        int hDp = layout == R.layout.nutri_widget_small ? 72 : (layout == R.layout.nutri_widget_large ? 200 : 120);
        preview = LayoutInflater.from(this).inflate(layout, panel, false);
        FrameLayout.LayoutParams pv = new FrameLayout.LayoutParams(dp(wDp), dp(hDp), Gravity.CENTER);
        panel.addView(preview, pv);

        TextView styleLabel = new TextView(this);
        styleLabel.setText("Stil");
        styleLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        styleLabel.setTypeface(null, android.graphics.Typeface.BOLD);
        LinearLayout.LayoutParams sl = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        sl.topMargin = dp(22);
        col.addView(styleLabel, sl);

        RadioGroup group = new RadioGroup(this);
        group.setOrientation(RadioGroup.VERTICAL);
        RadioButton colorBtn = new RadioButton(this);
        colorBtn.setId(View.generateViewId());
        colorBtn.setText("Farbe – ruhige, deckende Fläche");
        RadioButton glassBtn = new RadioButton(this);
        glassBtn.setId(View.generateViewId());
        glassBtn.setText("Liquid Glass – durchscheinend mit Lichtkante");
        group.addView(colorBtn);
        group.addView(glassBtn);
        col.addView(group);
        group.check(NutriWidgetProvider.STYLE_GLASS.equals(style) ? glassBtn.getId() : colorBtn.getId());

        transparencyLabel = new TextView(this);
        transparencyLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        LinearLayout.LayoutParams tl = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        tl.topMargin = dp(14);
        col.addView(transparencyLabel, tl);

        transparencyBar = new SeekBar(this);
        transparencyBar.setMax(100);
        transparencyBar.setProgress(transparency);
        col.addView(transparencyBar);

        group.setOnCheckedChangeListener((g, checkedId) -> {
            style = checkedId == glassBtn.getId() ? NutriWidgetProvider.STYLE_GLASS : NutriWidgetProvider.STYLE_COLOR;
            updatePreview();
        });
        transparencyBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar bar, int progress, boolean fromUser) {
                transparency = progress;
                updatePreview();
            }

            @Override
            public void onStartTrackingTouch(SeekBar bar) {}

            @Override
            public void onStopTrackingTouch(SeekBar bar) {}
        });

        Button done = new Button(this);
        done.setText("Fertig");
        done.setOnClickListener(v -> save());
        LinearLayout.LayoutParams dl = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        dl.topMargin = dp(24);
        col.addView(done, dl);

        setContentView(scroll);
    }

    private void setColor(int id, int color) {
        View v = preview.findViewById(id);
        if (v instanceof TextView) ((TextView) v).setTextColor(color);
    }

    private void updatePreview() {
        boolean glass = NutriWidgetProvider.STYLE_GLASS.equals(style);
        transparencyLabel.setVisibility(glass ? View.VISIBLE : View.GONE);
        transparencyBar.setVisibility(glass ? View.VISIBLE : View.GONE);
        transparencyLabel.setText("Transparenz: " + transparency + " %");

        ImageView bg = preview.findViewById(R.id.widget_bg);
        boolean dark = NutriWidgetProvider.isDark(this);
        int[] strong = {R.id.widget_kcal, R.id.widget_protein, R.id.widget_water, R.id.widget_carbs, R.id.widget_fat};
        int[] weak = {R.id.widget_title, R.id.widget_l_protein, R.id.widget_l_water, R.id.widget_l_carbs,
                R.id.widget_l_fat, R.id.widget_hint};
        if (glass) {
            float density = getResources().getDisplayMetrics().density;
            int wDp = layout == R.layout.nutri_widget_small ? 160 : 280;
            int hDp = layout == R.layout.nutri_widget_small ? 72 : (layout == R.layout.nutri_widget_large ? 200 : 120);
            bg.setImageBitmap(GlassBackground.render(Math.round(wDp * density), Math.round(hDp * density),
                    density, dark, transparency));
            int text = dark ? Color.rgb(246, 244, 255) : Color.rgb(31, 27, 46);
            int sub = dark ? Color.rgb(205, 200, 228) : Color.rgb(70, 66, 92);
            for (int id : strong) setColor(id, text);
            for (int id : weak) setColor(id, sub);
        } else {
            bg.setImageResource(R.drawable.nutri_widget_bg);
            for (int id : strong) setColor(id, getColor(R.color.nutri_widget_text));
            for (int id : weak) setColor(id, getColor(R.color.nutri_widget_text_secondary));
        }
    }

    private void save() {
        getSharedPreferences(NutriWidgetProvider.PREFS, Context.MODE_PRIVATE).edit()
                .putString("style_" + appWidgetId, style)
                .putInt("transparency_" + appWidgetId, transparency)
                .apply();
        NutriWidgetProvider.refreshOne(this, appWidgetId);
        setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId));
        finish();
    }
}
