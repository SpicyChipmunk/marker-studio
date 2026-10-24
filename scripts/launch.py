# v321 launch screens: the app's ground (#0b0b0e) with its icon in the middle, as iOS shows them while a Home Screen
# web app starts. One per screen size (and, on an iPad, per orientation): iOS uses one only on an exact match.
#   python3 scripts/launch.py            writes launch/*.png from src/assets/intro/plain.png (v322: the drop not yet
#                                        coloured, the opening animation's first picture) and prints the <link> tags for
#                                        src/index.template.html (needs Pillow: pip install pillow)
import sys, os
from PIL import Image, ImageDraw, ImageFilter
repo = sys.argv[1] if len(sys.argv) > 1 else '.'
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(repo, 'launch')
os.makedirs(out, exist_ok=True)
icon = Image.open(os.path.join(repo, 'src/assets/intro/plain.png')).convert('RGB')
# (css width, css height, device pixel ratio, both orientations?)
SCREENS = [
  # iPads
  (1032, 1376, 2, True), (1024, 1366, 2, True), (834, 1210, 2, True), (834, 1194, 2, True), (820, 1180, 2, True),
  (834, 1112, 2, True), (810, 1080, 2, True), (768, 1024, 2, True), (744, 1133, 2, True),
  # iPhones (upright)
  (440, 956, 3, False), (420, 912, 3, False), (402, 874, 3, False), (430, 932, 3, False), (393, 852, 3, False),
  (428, 926, 3, False), (390, 844, 3, False), (414, 896, 3, False), (375, 812, 3, False), (414, 896, 2, False),
  (414, 736, 3, False), (375, 667, 2, False),
]
BG = (11, 11, 14)
def rounded(img, r):
    k = 4
    W, H = img.size
    m = Image.new('L', (W * k, H * k), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, W * k - 1, H * k - 1), radius=r * k, fill=255)
    return m.resize((W, H), Image.LANCZOS)
links = []
total = 0
for (w, h, d, both) in SCREENS:
    for land in ([False, True] if both else [False]):
        cw, ch = (h, w) if land else (w, h)
        PW, PH = cw * d, ch * d
        side = round(min(cw, ch) * 0.24) * d
        ic = icon.resize((side, side), Image.LANCZOS)
        mask = rounded(ic, round(side * 0.225))
        im = Image.new('RGB', (PW, PH), BG)
        im.paste(ic, ((PW - side) // 2, (PH - side) // 2), mask)
        im = im.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        name = f'launch-{cw}x{ch}@{d}x.png'
        p = os.path.join(out, name)
        im.save(p, optimize=True)
        total += os.path.getsize(p)
        links.append((w, h, d, 'landscape' if land else 'portrait', name))
for (w, h, d, o, n) in links:
    print(f'<link rel="apple-touch-startup-image" media="screen and (device-width: {w}px) and (device-height: {h}px) '
          f'and (-webkit-device-pixel-ratio: {d}) and (orientation: {o})" href="launch/{n}">')
print(len(links), 'images', total // 1024, 'KB', file=sys.stderr)
