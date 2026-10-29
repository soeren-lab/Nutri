package com.soeren.nutriapp;

import android.graphics.Bitmap;

/**
 * Zeichnet den Glas-Stil der Widgets als Hintergrundbild.
 *
 * Widgets (RemoteViews) dürfen weder weichzeichnen noch Shader nutzen. Deshalb entsteht das Glas
 * hier vorab als halbtransparentes Bild: Tönung, feine helle Linie rundum und eine Lichtkante oben
 * und unten (Formeln aus dem Liquid-Glass-Kit). Das Hintergrundbild des Handys schimmert durch.
 * Dieselben Formeln stehen in scripts/glass-widget-preview.py (Entwurf der Vorschau).
 */
final class GlassBackground {
    private GlassBackground() {}

    /** Eckenradius des Widgets in dp. */
    static final float CORNER_DP = 22f;

    /** Tönungsstärke je nach Regler "Transparenz" (0..100): 0 = dicht (0,60), 100 = sehr klar (0,15). */
    static float tintAlpha(int transparencyPercent) {
        float t = Math.max(0, Math.min(100, transparencyPercent)) / 100f;
        return 0.60f - 0.45f * t;
    }

    static Bitmap render(int width, int height, float density, boolean dark, int transparencyPercent) {
        int[] px = renderPixels(width, height, density, dark, tintAlpha(transparencyPercent));
        return Bitmap.createBitmap(px, width, height, Bitmap.Config.ARGB_8888);
    }

    private static float clamp01(float v) {
        return v < 0f ? 0f : (v > 1f ? 1f : v);
    }

    private static float smoothstep(float a, float b, float x) {
        float t = clamp01((x - a) / (b - a));
        return t * t * (3f - 2f * t);
    }

    private static float sd(float px, float py, float halfW, float halfH, float r) {
        float dx = Math.abs(px) - halfW + r;
        float dy = Math.abs(py) - halfH + r;
        float outside = (float) Math.hypot(Math.max(dx, 0f), Math.max(dy, 0f));
        return outside + Math.min(Math.max(dx, dy), 0f) - r;
    }

    /** Nicht vorvervielfachte ARGB-Pixel, zeilenweise. Ohne Android-Klassen, damit testbar. */
    static int[] renderPixels(int w, int h, float density, boolean dark, float alpha) {
        int[] out = new int[w * h];
        float halfW = w / 2f;
        float halfH = h / 2f;
        float radius = CORNER_DP * density;
        float edgeBand = 14f * density;
        float dp = density;
        float tintR = dark ? 24f : 255f;
        float tintG = dark ? 20f : 255f;
        float tintB = dark ? 40f : 255f;
        float shineStrength = dark ? 0.7f : 0.85f;
        float vFade = dark ? 0.25f : 0.30f;

        for (int y = 0; y < h; y++) {
            float cy = y + 0.5f - halfH;
            float vy = h > 1 ? y / (float) (h - 1) : 0f;
            for (int x = 0; x < w; x++) {
                float cx = x + 0.5f - halfW;
                float dist = sd(cx, cy, halfW, halfH, radius);
                float cover = clamp01(0.5f - dist);
                if (cover <= 0f) continue;

                float gx = sd(cx + 1f, cy, halfW, halfH, radius) - sd(cx - 1f, cy, halfW, halfH, radius);
                float gy = sd(cx, cy + 1f, halfW, halfH, radius) - sd(cx, cy - 1f, halfW, halfH, radius);
                float gl = Math.max((float) Math.hypot(gx, gy), 1e-4f);
                float ny = gy / gl;

                float depth = clamp01(-dist / edgeBand);
                float edgeT = 1f - (float) Math.sin(depth * Math.PI / 2.0);

                float lightAlign = Math.abs(ny) * (1f - smoothstep(0.35f, 0.75f, Math.abs(cx) / halfW));
                float sharp = smoothstep(0f, 2f * dp, -dist)
                        * (1f - smoothstep(2f * dp, 4f * dp, -dist))
                        * Math.max(0f, lightAlign + 0.2f);
                float soft = smoothstep(0.1f, 1f, lightAlign) * (float) Math.pow(edgeT, 1.8);
                float hair = dist <= 0f ? 1f - smoothstep(0f, 1.2f * dp, -dist) : 0f;

                float shine = clamp01(sharp * 0.55f + soft * 0.45f + hair * 0.30f
                        + (float) Math.pow(edgeT, 3.0) * 0.10f) * cover;
                float a2 = shine * shineStrength; // weiße Lichter
                float a1 = alpha * (1f - vFade * vy) * cover; // Tönung

                float outA = a2 + a1 * (1f - a2);
                if (outA <= 0.002f) continue;
                float r = (255f * a2 + tintR * a1 * (1f - a2)) / outA;
                float g = (255f * a2 + tintG * a1 * (1f - a2)) / outA;
                float b = (255f * a2 + tintB * a1 * (1f - a2)) / outA;
                int ia = Math.round(clamp01(outA) * 255f);
                out[y * w + x] = (ia << 24)
                        | (Math.round(Math.min(r, 255f)) << 16)
                        | (Math.round(Math.min(g, 255f)) << 8)
                        | Math.round(Math.min(b, 255f));
            }
        }
        return out;
    }
}
