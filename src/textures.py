# Deterministic paper + grain textures (seeded). Run: python3 src/textures.py
import numpy as np
from PIL import Image, ImageFilter
rng = np.random.default_rng(1837)
W, H = 1080, 1920

def octave(w, h, cell, blur):
    small = rng.random((max(2, h // cell), max(2, w // cell))).astype(np.float32)
    img = Image.fromarray((small * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    return np.asarray(img.filter(ImageFilter.GaussianBlur(blur)), dtype=np.float32) / 255

# cloudy foxing: several octaves
n = sum(a * octave(W, H, c, b) for a, c, b in [(0.5, 240, 60), (0.28, 90, 22), (0.14, 30, 6), (0.08, 8, 1.5)])
n = (n - n.min()) / (n.max() - n.min())
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
edge = np.clip(((xx / W - .5) ** 2 / .30 + (yy / H - .5) ** 2 / .32) - .35, 0, 1)  # darker toward edges
base = np.array([227, 210, 173], np.float32)
stain = np.array([150, 108, 58], np.float32)
k = np.clip((n - .45) * 1.1, 0, 1) * .45 + edge * .30
k = np.clip(k, 0, 1)[..., None]
fibers = octave(W, H, 2, 0.6)[..., None] * 10 - 5
rgb = base * (1 - k) + stain * k + fibers
Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).save("assets/tex/paper.jpg", quality=90)

# film grain tile: neutral noise with alpha (normal blend)
g = rng.normal(0, 1, (512, 512)).astype(np.float32)
g = np.asarray(Image.fromarray(np.clip(g * 40 + 128, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)), np.float32)
lum = np.where(g > 128, 255, 0).astype(np.uint8)
alpha = np.clip(np.abs(g - 128) * 4, 0, 255).astype(np.uint8)
Image.fromarray(np.dstack([lum, lum, lum, alpha])).save("assets/tex/grain.png", optimize=True)
print("ok")
