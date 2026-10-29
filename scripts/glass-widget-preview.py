# Vorschau des Glas-Stils für die Widgets (Entwurf, bevor er nach Android übernommen wird).
# Aufruf im Projektordner: python scripts/glass-widget-preview.py [Ausgabedatei]   (benötigt Pillow + numpy)
#
# Zeichnet dieselben Formeln wie das spätere Android-Bild: halbtransparente Tönung, heller Rand mit
# Lichtkante oben und unten (aus dem Liquid-Glass-Kit), Hintergrund bleibt unverändert sichtbar.
# Echte Unschärfe/Lichtbrechung gibt es in Widgets nicht.
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

S = 2  # Pixel pro dp
OUT = sys.argv[1] if len(sys.argv) > 1 else "glass-widget-preview.png"


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def wallpaper(w, h, seed):
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    u, v = xs / w, ys / h
    base = np.stack(
        [60 + 190 * (0.55 * u + 0.45 * v), 25 + 110 * v, 130 - 60 * u + 40 * (1 - v)], axis=-1
    )
    rng = np.random.default_rng(seed)
    for _ in range(7):
        cx, cy = rng.uniform(0, w), rng.uniform(0, h)
        r = rng.uniform(0.18, 0.4) * w
        col = rng.uniform(40, 255, 3)
        m = np.exp(-(((xs - cx) ** 2 + (ys - cy) ** 2) / (2 * (r / 2) ** 2)))[..., None]
        base = base * (1 - 0.55 * m) + col * 0.55 * m
    return np.clip(base, 0, 255)


def glass(bg, x0, y0, w, h, radius, dark, alpha):
    """Legt eine Glasfläche (Position/Größe in Pixeln) über bg und gibt bg zurück."""
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    px, py = xs - w / 2 + 0.5, ys - h / 2 + 0.5
    half = np.array([w / 2, h / 2], dtype=np.float32)
    dx = np.abs(px) - half[0] + radius
    dy = np.abs(py) - half[1] + radius
    sd = np.hypot(np.maximum(dx, 0), np.maximum(dy, 0)) + np.minimum(np.maximum(dx, dy), 0) - radius
    inside = sd <= 0
    cover = np.clip(0.5 - sd, 0, 1)  # weiche Kante

    # Normale (aus dem Gefälle der Abstandsfunktion)
    gy, gx = np.gradient(sd)
    gl = np.maximum(np.hypot(gx, gy), 1e-4)
    ny = gy / gl

    edge_band = 14 * S
    depth = np.clip(-sd / edge_band, 0, 1)
    edge_t = 1 - np.sin(depth * np.pi / 2)

    # Lichtkante nur oben und unten, in der Mitte am hellsten (wie im Kit)
    light_align = np.abs(ny) * (1 - smoothstep(0.35, 0.75, np.abs(px) / half[0]))
    sharp = smoothstep(0, 2 * S, -sd) * (1 - smoothstep(2 * S, 4 * S, -sd)) * np.maximum(0, light_align + 0.2)
    soft = smoothstep(0.1, 1.0, light_align) * edge_t**1.8
    hair = (1 - smoothstep(0, 1.2 * S, -sd)) * inside  # feine Linie rundum

    # Tönung: oben etwas heller/dichter als unten
    vy = (ys / max(h - 1, 1)).astype(np.float32)
    if dark:
        tint = np.array([24, 20, 40], dtype=np.float32)
        a = alpha * (1.0 - 0.25 * vy)
    else:
        tint = np.array([255, 255, 255], dtype=np.float32)
        a = alpha * (1.0 - 0.30 * vy)
    a = a * cover

    region = bg[y0 : y0 + h, x0 : x0 + w]
    out = region * (1 - a[..., None]) + tint * a[..., None]

    # Lichter (additiv, weiß)
    shine = np.clip(sharp * 0.55 + soft * 0.45 + hair * 0.30 + edge_t**3 * 0.10, 0, 1) * cover
    out = out + (255 - out) * shine[..., None] * (0.85 if not dark else 0.7)
    bg[y0 : y0 + h, x0 : x0 + w] = out
    return bg


def font(size, bold=False):
    path = "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"
    return ImageFont.truetype(path, int(size * S))


PAL = {
    False: dict(text=(31, 27, 46), sub=(70, 66, 92), track=(255, 255, 255, 150),
                kcal=(124, 58, 237), protein=(37, 99, 235), water=(6, 150, 190),
                carbs=(217, 119, 6), fat=(219, 39, 119)),
    True: dict(text=(246, 244, 255), sub=(205, 200, 228), track=(255, 255, 255, 60),
               kcal=(167, 139, 250), protein=(96, 165, 250), water=(34, 211, 238),
               carbs=(251, 191, 36), fat=(244, 114, 182)),
}


def draw_bar(img, x, y, w, h, frac, color, track):
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.rounded_rectangle((x, y, x + w, y + h), radius=h // 2, fill=track)
    d.rounded_rectangle((x, y, x + max(int(w * frac), h), y + h), radius=h // 2, fill=color + (255,))
    img.alpha_composite(ov)


def content(img, x0, y0, w_dp, kind, dark):
    p = PAL[dark]
    d = ImageDraw.Draw(img)
    pad = {"small": 12, "medium": 14, "large": 16}[kind] * S
    x, y = x0 + pad, y0 + pad
    w = w_dp * S - 2 * pad
    d.text((x, y), "NUTRI · heute", font=font(11, True), fill=p["sub"])
    size = {"small": 16, "medium": 18, "large": 24}[kind]
    d.text((x, y + 15 * S), "1.450 / 2.200 kcal", font=font(size, True), fill=p["text"])
    by = y + {"small": 41, "medium": 42, "large": 49}[kind] * S
    bh = {"small": 6, "medium": 6, "large": 8}[kind] * S
    draw_bar(img, x, by, w, bh, 0.66, p["kcal"], p["track"])
    if kind == "small":
        return
    half = (w - 12 * S) // 2

    def block(bx, byy, label, val, frac, col):
        d.text((bx, byy), label, font=font(11), fill=p["sub"])
        d.text((bx, byy + 15 * S), val, font=font(13, True), fill=p["text"])
        draw_bar(img, bx, byy + 34 * S, half, 5 * S, frac, col, p["track"])

    r1 = y + (58 if kind == "medium" else 72) * S
    block(x, r1, "Protein", "98 / 150 g", 0.65, p["protein"])
    block(x + half + 12 * S, r1, "Wasser", "1,5 l / 2,5 l", 0.60, p["water"])
    if kind == "large":
        r2 = y + 124 * S
        block(x, r2, "Kohlenhydrate", "160 / 240 g", 0.67, p["carbs"])
        block(x + half + 12 * S, r2, "Fett", "45 / 70 g", 0.64, p["fat"])


SIZES = {"small": (160, 72), "medium": (280, 120), "large": (280, 200)}


def render(dark, alpha, seed):
    W, H = 340 * S, 470 * S
    bg = wallpaper(W, H, seed)
    placed = []
    y = 24 * S
    for kind, (wd, hd) in SIZES.items():
        x = (340 - wd) // 2 * S
        bg = glass(bg, x, y, wd * S, hd * S, 22 * S, dark, alpha)
        placed.append((kind, x, y, wd))
        y += (hd + 22) * S
    img = Image.fromarray(bg.astype(np.uint8), "RGB").convert("RGBA")
    for kind, x, yy, wd in placed:
        content(img, x, yy, wd, kind, dark)
    return img.convert("RGB")


light = render(False, 0.36, 3)
dark = render(True, 0.42, 3)
sheet = Image.new("RGB", (light.width * 2 + 12 * S, light.height), (20, 20, 24))
sheet.paste(light, (0, 0))
sheet.paste(dark, (light.width + 12 * S, 0))
sheet.save(OUT)
print("geschrieben:", OUT, sheet.size)
