# Erzeugt die Vorschaubilder der Widgets (Widget-Auswahl auf dem Startbildschirm, Android < 12).
# Aufruf im Projektordner: python scripts/make-widget-previews.py   (benötigt Pillow)
from PIL import Image, ImageDraw, ImageFont

OUT = "android/app/src/main/res/drawable-nodpi"
BG, TEXT, SUB, TRACK = (246, 243, 255), (31, 27, 46), (107, 104, 128), (221, 216, 242)
KCAL, PROTEIN, WATER = (124, 58, 237), (37, 99, 235), (6, 182, 212)
CARBS, FAT = (245, 158, 11), (236, 72, 153)
S = 3  # Pixel pro dp


def font(size, bold=False):
    return ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf", int(size * S))


def bar(d, x, y, w, h, frac, color):
    d.rounded_rectangle((x, y, x + w, y + h), radius=h // 2, fill=TRACK)
    d.rounded_rectangle((x, y, x + int(w * frac), y + h), radius=h // 2, fill=color)


def card(w_dp, h_dp):
    im = Image.new("RGBA", (w_dp * S, h_dp * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w_dp * S - 1, h_dp * S - 1), radius=22 * S, fill=BG)
    return im, d


def block(d, x, y, w, label, value, frac, color):
    d.text((x, y), label, font=font(11), fill=SUB)
    d.text((x, y + 15 * S), value, font=font(13, True), fill=TEXT)
    bar(d, x, y + 34 * S, w, 5 * S, frac, color)


def small():
    im, d = card(160, 72)
    p = 12 * S
    d.text((p, p), "NUTRI · heute", font=font(11, True), fill=SUB)
    d.text((p, p + 16 * S), "1.450 / 2.200 kcal", font=font(16, True), fill=TEXT)
    bar(d, p, p + 42 * S, 160 * S - 2 * p, 6 * S, 0.66, KCAL)
    return im


def medium():
    im, d = card(280, 120)
    p = 14 * S
    w = 280 * S - 2 * p
    d.text((p, p), "NUTRI · heute", font=font(11, True), fill=SUB)
    d.text((p, p + 16 * S), "1.450 / 2.200 kcal", font=font(18, True), fill=TEXT)
    bar(d, p, p + 42 * S, w, 6 * S, 0.66, KCAL)
    half = (w - 12 * S) // 2
    block(d, p, p + 58 * S, half, "Protein", "98 / 150 g", 0.65, PROTEIN)
    block(d, p + half + 12 * S, p + 58 * S, half, "Wasser", "1,5 l / 2,5 l", 0.60, WATER)
    return im


def large():
    im, d = card(280, 200)
    p = 16 * S
    w = 280 * S - 2 * p
    d.text((p, p), "NUTRI · heute", font=font(11, True), fill=SUB)
    d.text((p, p + 16 * S), "1.450 / 2.200 kcal", font=font(24, True), fill=TEXT)
    bar(d, p, p + 50 * S, w, 8 * S, 0.66, KCAL)
    half = (w - 12 * S) // 2
    block(d, p, p + 72 * S, half, "Protein", "98 / 150 g", 0.65, PROTEIN)
    block(d, p + half + 12 * S, p + 72 * S, half, "Wasser", "1,5 l / 2,5 l", 0.60, WATER)
    block(d, p, p + 124 * S, half, "Kohlenhydrate", "160 / 240 g", 0.67, CARBS)
    block(d, p + half + 12 * S, p + 124 * S, half, "Fett", "45 / 70 g", 0.64, FAT)
    return im


small().save(f"{OUT}/widget_preview_small.png")
medium().save(f"{OUT}/widget_preview_medium.png")
large().save(f"{OUT}/widget_preview_large.png")
print("Vorschaubilder geschrieben")
