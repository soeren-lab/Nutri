# Erzeugt alle App-Icons (Android-Launcher + Web/PWA) aus design/app-icon.png.
# Aufruf im Projektordner: python scripts/make-app-icons.py   (benötigt Pillow)
from PIL import Image, ImageDraw
import os
SRC = "design/app-icon.png"
RES = "android/app/src/main/res"
BG = (18, 18, 18)          # #121212, passt zum fast schwarzen Rand der Platte
SAFE = 0.66                # Anteil der Kantenlänge des Vordergrunds, den das Icon einnimmt (Sicherheitszone)

im = Image.open(SRC).convert("RGBA")
bb = im.split()[3].point(lambda v: 255 if v > 128 else 0).getbbox()
l, t, r, b = bb
side = b - t
x0 = l + ((r - l) - side) // 2
plate = im.crop((x0, t, x0 + side, t + side))          # quadratisch, mit transparenten Ecken
plate_flat = Image.new("RGBA", plate.size, BG + (255,))
plate_flat.alpha_composite(plate)                      # Ecken mit Hintergrundfarbe füllen

def fg(size):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    a = round(size * SAFE)
    art = plate_flat.resize((a, a), Image.LANCZOS)
    canvas.paste(art, ((size - a) // 2, (size - a) // 2))
    return canvas

def legacy(size):                                      # alte Android-Versionen: Platte mit Rundung
    return plate.resize((size, size), Image.LANCZOS)

def legacy_round(size):
    inner = round(size * 0.92)
    art = plate_flat.resize((inner, inner), Image.LANCZOS)
    c = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    m = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    m = m.resize((size, size), Image.LANCZOS)
    full = Image.new("RGBA", (size, size), BG + (255,))
    full.paste(art, ((size - inner) // 2, (size - inner) // 2))
    c.paste(full, (0, 0), m)
    return c

fg_sizes = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
lg_sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for d in fg_sizes:
    p = f"{RES}/mipmap-{d}"
    fg(fg_sizes[d]).save(f"{p}/ic_launcher_foreground.png")
    legacy(lg_sizes[d]).save(f"{p}/ic_launcher.png")
    legacy_round(lg_sizes[d]).save(f"{p}/ic_launcher_round.png")

open(f"{RES}/values/ic_launcher_background.xml", "w", encoding="utf-8").write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#121212</color>\n</resources>\n')

# Vorschau: Vordergrund über Hintergrund mit verschiedenen Masken
S = 432
def masked(shape):
    base = Image.new("RGBA", (S, S), BG + (255,)); base.alpha_composite(fg(S))
    vis = round(S * 72 / 108); off = (S - vis) // 2
    m = Image.new("L", (S, S), 0); d = ImageDraw.Draw(m)
    box = (off, off, off + vis, off + vis)
    if shape == "kreis": d.ellipse(box, fill=255)
    elif shape == "squircle": d.rounded_rectangle(box, radius=int(vis * 0.30), fill=255)
    else: d.rounded_rectangle(box, radius=int(vis * 0.12), fill=255)
    out = Image.new("RGBA", (S, S), (235, 235, 240, 255)); out.paste(base, (0, 0), m)
    return out.crop((off - 20, off - 20, off + vis + 20, off + vis + 20))
tiles = [masked(s) for s in ("squircle", "kreis", "eckig")]
w, h = tiles[0].size
sheet = Image.new("RGB", (w * 3 + 40, h + 20), (235, 235, 240))
for i, tl in enumerate(tiles): sheet.paste(tl, (10 + i * (w + 10), 10))
sheet.save("design/app-icon-vorschau.png")
print("fertig", sheet.size)

# ---- Web/PWA-Icons (public/) ----
PUB = "public"
def flat(size):  # ohne Transparenz, Platte füllt alles (Plattformen runden selbst)
    return plate_flat.resize((size, size), Image.LANCZOS).convert("RGB")
def maskable(size):  # Inhalt in der inneren 72 % (Sicherheitszone), Rand in Hintergrundfarbe
    c = Image.new("RGBA", (size, size), BG + (255,))
    a = round(size * 0.72)
    c.paste(plate_flat.resize((a, a), Image.LANCZOS), ((size - a) // 2, (size - a) // 2))
    return c
for size in (192, 512):
    plate.resize((size, size), Image.LANCZOS).save(f"{PUB}/pwa-{size}.png")      # "any": mit Rundung
    maskable(size).save(f"{PUB}/pwa-maskable-{size}.png")
flat(180).save(f"{PUB}/apple-touch-icon.png")
plate.resize((64, 64), Image.LANCZOS).save(f"{PUB}/favicon.png")
print("web fertig")
