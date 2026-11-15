"""Crop the app screenshots in deck/shots/ (1600x900 CSS px at 2x) into slide images in deck/img/.

Run: python3 deck/crop.py   (after node deck/capture.mjs)
Boxes are in CSS px of the 1600x900 viewport; the PNGs are 2x.
"""
from pathlib import Path
from PIL import Image

D = Path(__file__).resolve().parent
SHOTS, IMG = D / "shots", D / "img"
IMG.mkdir(exist_ok=True)

CROPS = {
    # name: (shot, (left, top, right, bottom) in CSS px, max output width px)
    "terrain": ("05a-terrain", (470, 92, 990, 690), 1200),
    "terrain-sunk": ("05b-terrain-sunk", (470, 92, 990, 690), 1200),
    "finland": ("01-finland", (556, 96, 960, 806), 1000),
    "card-breast": ("03-breast-lever", (1242, 53, 1600, 531), 900),
    "card-bone": ("04-bone-lever", (1242, 53, 1600, 720), 900),
    "app-breast": ("03-breast-lever", (0, 0, 1600, 900), 2400),
    "units": ("06-units", (200, 76, 1400, 560), 2000),
    "memo": ("07-memo-lapland", (515, 180, 1395, 810), 1800),
    "provenance": ("11-provenance", (1160, 180, 1588, 830), 900),
    "assumptions": ("05d-assumptions", (272, 52, 647, 864), 800),
}

for name, (shot, box, maxw) in CROPS.items():
    im = Image.open(SHOTS / f"{shot}.png").convert("RGB")
    sx = im.width / 1600
    l, t, r, b = box
    # clamp to the viewport
    l, t, r, b = max(0, l), max(0, t), min(1600, r), min(900, b)
    c = im.crop((round(l * sx), round(t * sx), round(r * sx), round(b * sx)))
    if c.width > maxw:
        c = c.resize((maxw, round(c.height * maxw / c.width)), Image.LANCZOS)
    out = IMG / f"{name}.jpg"
    c.save(out, "JPEG", quality=88, optimize=True, progressive=True)
    print(f"{out.name}: {c.width}x{c.height}, {out.stat().st_size // 1024} kB")
