# A small stand-in for Open Images, served from a local folder, to test the kit end to end (never shipped): scikit-image's
# public sample photos made into "photos" at Open Images' own paths, for the train, validation and test splits:
#   big subjects    crops of the sample photos, outlined by stock TRACER's own map (some loosened, to disagree)
#   small subjects  a subject cut out and pasted at 1-5% of the frame onto a texture (grass, gravel, brick, moon)
#   people          the astronaut, outlined whole (Person) or only her clothes (Clothing: a partial label to leave out)
#   scenery         a texture with one tiny outline (< 0.3%)
# plus each split's info table, the validation/test box tables (some with an un-outlined big box, some with a person box
# but no outline), and the masks' zip files. Usage: mock.py <kit> <folder> <TRACER weights>
import sys, os, io, csv, zipfile, hashlib, shutil, random, pathlib
import numpy as np, torch
from PIL import Image
kit, base, w = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), sys.argv[3]
sys.path.insert(0, str(kit))
os.environ.setdefault('MS_KIT_WORK', str(base / '_work'))
from tracer import TRACER, cfg
import skimage, skimage.io
D = pathlib.Path(skimage.__file__).parent / 'data'
BIG = [('chelsea.png', 'Cat'), ('coffee.png', 'Coffee cup'), ('rocket.jpg', 'Rocket'), ('motorcycle_left.png', 'Motorcycle'),
       ('color.png', 'Ball'), ('horse.png', 'Horse')]
TEX = ['grass.png', 'gravel.png', 'brick.png', 'moon.png']
NAMES = sorted({b[1] for b in BIG} | {'Person', 'Clothing', 'Tree', 'Car'})
mids = {n: '/m/%05x' % (i + 1) for i, n in enumerate(NAMES)}
net = TRACER(cfg)
sd = {k.replace('module.', '', 1): v for k, v in torch.load(w, map_location='cpu', weights_only=True).items()}
net.load_state_dict(sd)
net.eval()


def rgb(f):
    im = skimage.io.imread(D / f)
    im = np.stack([im] * 3, -1) if im.ndim == 2 else im[..., :3]
    if im.dtype != np.uint8:
        im = (im / im.max() * 255).astype(np.uint8)
    return im


def stock(a):
    x = torch.from_numpy((np.asarray(Image.fromarray(a).resize((320, 320), Image.BILINEAR), np.float32) / 255 - [0.485, 0.456, 0.406]) /
                         [0.229, 0.224, 0.225]).float().permute(2, 0, 1)[None]
    with torch.no_grad():
        y = net(x)[0][0, 0].numpy()
    return np.asarray(Image.fromarray((y * 255).astype(np.uint8)).resize((a.shape[1], a.shape[0]), Image.BILINEAR)) >= 128


SPL = ('train', 'validation', 'test')
rows = {s: [] for s in SPL}
info = {s: [] for s in SPL}
boxes = {s: [] for s in SPL}
zips = {}
cut = {}
for f, cls in BIG:
    im = rgb(f)
    m = stock(im)
    if m.mean() > 0.02:
        ys, xs = np.nonzero(m)
        cut[cls] = (im[ys.min():ys.max() + 1, xs.min():xs.max() + 1], m[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
n = 0


def add(split, iid, a, masks, extra_boxes=()):
    """One photo: a (H, W, 3), masks [(class, bool H × W)]; boxes for each mask and any extra (class, x0, x1, y0, y1)."""
    global n
    n += 1
    h, ww = a.shape[:2]
    for cls, m in masks:
        mp = '%s_%s_%d_mask.png' % (iid, mids[cls][3:], len(rows[split]))
        b = io.BytesIO()
        Image.fromarray((m * 255).astype(np.uint8)).save(b, 'PNG')
        zips.setdefault((split, iid[0]), []).append((mp, b.getvalue()))
        ys, xs = np.nonzero(m) if m.any() else (np.array([0]), np.array([0]))
        bx = (xs.min() / ww, (xs.max() + 1) / ww, ys.min() / h, (ys.max() + 1) / h)
        rows[split].append([mp, iid, mids[cls], 'x'] + list(bx) + ['0.9', ''])
        boxes[split].append([iid, 'x', mids[cls], '1'] + list(bx))
    for cls, *bx in extra_boxes:
        boxes[split].append([iid, 'x', mids[cls], '1'] + list(bx))
    info[split].append([iid, split, 'http://example/%s.jpg' % iid, 'http://example/%s' % iid, 'https://creativecommons.org/licenses/by/2.0/',
                        'http://example/u', 'Author %s' % iid[:4], 'Title %s' % iid[:4], '1', 'x', '', '0'])
    d = base / 's3' / split
    d.mkdir(parents=True, exist_ok=True)
    Image.fromarray(a).save(d / (iid + '.jpg'), quality=92)


per = {'train': 14, 'validation': 6, 'test': 8}
for split in SPL:
    for f, cls in BIG:
        im = rgb(f)
        H, W = im.shape[:2]
        for v in range(per[split]):
            r = random.Random(split + f + str(v))
            s = r.uniform(0.75, 1.0)
            h, ww = int(H * s), int(W * s)
            y0, x0 = r.randint(0, H - h), r.randint(0, W - ww)
            a = np.ascontiguousarray(im[y0:y0 + h, x0:x0 + ww][:, ::-1] if v % 2 else im[y0:y0 + h, x0:x0 + ww])
            m = stock(a)
            if m.mean() < 0.02:
                continue
            if v % 5 == 0:
                t = torch.from_numpy(m.astype(np.float32))[None, None]
                m = (torch.nn.functional.max_pool2d(t, 41, 1, 20)[0, 0] > 0).numpy()
            iid = hashlib.sha1((split + f + str(v)).encode()).hexdigest()[:16]
            extra = [('Car', 0.0, 0.3, 0.0, 0.3)] if (split != 'train' and v == 3) else []
            add(split, iid, a, [(cls, m)], extra)
    # small subjects pasted on textures
    for v in range(per[split] * 4):
        r = random.Random(split + 'small' + str(v))
        cls = r.choice(sorted(cut))
        c, cm = cut[cls]
        bg = rgb(TEX[v % len(TEX)])
        bg = np.asarray(Image.fromarray(bg).resize((480, 360)))
        sh = r.uniform(0.012, 0.045)
        k = (sh * 480 * 360 / cm.sum()) ** 0.5
        hh, cw = max(4, int(c.shape[0] * k)), max(4, int(c.shape[1] * k))
        c2 = np.asarray(Image.fromarray(c).resize((cw, hh)))
        m2 = np.asarray(Image.fromarray((cm * 255).astype(np.uint8)).resize((cw, hh))) >= 128
        y0, x0 = r.randint(0, 360 - hh), r.randint(0, 480 - cw)
        a = bg.copy()
        a[y0:y0 + hh, x0:x0 + cw][m2] = c2[m2]
        M = np.zeros((360, 480), bool)
        M[y0:y0 + hh, x0:x0 + cw] = m2
        extra = [('Person', 0.7, 0.95, 0.4, 0.95)] if v % 7 == 1 else ([('Car', 0.0, 0.5, 0.0, 0.5)] if v % 7 == 2 else [])
        add(split, hashlib.sha1((split + 'small' + str(v)).encode()).hexdigest()[:16], a, [(cls, M)], extra)
    # people: whole, or only the clothes outlined
    im = rgb('astronaut.png')
    for v in range(per[split]):
        r = random.Random(split + 'p' + str(v))
        a = np.ascontiguousarray(im[:, ::-1] if v % 2 else im)
        m = stock(a)
        iid = hashlib.sha1((split + 'person' + str(v)).encode()).hexdigest()[:16]
        if v % 3 == 0:
            cl = m.copy()
            cl[:a.shape[0] // 2] = False
            add(split, iid, a, [('Clothing', cl)])
        else:
            add(split, iid, a, [('Person', m)])
    # scenery: a texture with one tiny outline; and one with a person box but no outline (hidden people)
    for v in range(per[split] * 2):
        r = random.Random(split + 'scen' + str(v))
        bg = np.asarray(Image.fromarray(rgb(TEX[v % len(TEX)])).resize((480, 360)))
        a = np.ascontiguousarray(bg[:, ::-1] if v % 2 else bg)
        M = np.zeros((360, 480), bool)
        y0, x0 = r.randint(0, 340), r.randint(0, 460)
        M[y0:y0 + 12, x0:x0 + 12] = True
        iid = hashlib.sha1((split + 'scenery' + str(v)).encode()).hexdigest()[:16]
        extra = [('Person', 0.6, 0.7, 0.5, 0.9)] if (split != 'train' and v == 5) else []
        add(split, iid, a, [('Tree', M)], extra)
(base / 'openimages/v7').mkdir(parents=True, exist_ok=True)
with open(base / 'openimages/v7/oidv7-class-descriptions-boxable.csv', 'w', newline='') as fh:
    wr = csv.writer(fh)
    wr.writerow(['LabelName', 'DisplayName'])
    for nm, m in mids.items():
        wr.writerow([m, nm])
d5 = base / 'openimages/v5'
d5.mkdir(parents=True, exist_ok=True)
for split in SPL:
    with open(d5 / ('%s-annotations-object-segmentation.csv' % split), 'w', newline='') as fh:
        wr = csv.writer(fh)
        wr.writerow(['MaskPath', 'ImageID', 'LabelName', 'BoxID', 'BoxXMin', 'BoxXMax', 'BoxYMin', 'BoxYMax', 'PredictedIoU', 'Clicks'])
        wr.writerows(rows[split])
    bp = d5 / ('%s-annotations-bbox.csv' % split) if split != 'train' else base / 'openimages/2018_04/train/train-annotations-bbox.csv'
    bp.parent.mkdir(parents=True, exist_ok=True)
    with open(bp, 'w', newline='') as fh:
        wr = csv.writer(fh)
        wr.writerow(['ImageID', 'Source', 'LabelName', 'Confidence', 'XMin', 'XMax', 'YMin', 'YMax', 'IsOccluded', 'IsTruncated',
                     'IsGroupOf', 'IsDepiction', 'IsInside'])
        wr.writerows([b + ['0', '0', '0', '0', '0'] for b in boxes[split]])
    di = base / 'openimages/2018_04' / split
    di.mkdir(parents=True, exist_ok=True)
    nm = 'train-images-boxable-with-rotation.csv' if split == 'train' else '%s-images-with-rotation.csv' % split
    with open(di / nm, 'w', newline='') as fh:
        wr = csv.writer(fh)
        wr.writerow(['ImageID', 'Subset', 'OriginalURL', 'OriginalLandingURL', 'License', 'AuthorProfileURL', 'Author', 'Title',
                     'OriginalSize', 'OriginalMD5', 'Thumbnail300KURL', 'Rotation'])
        wr.writerows(info[split])
    dz = d5 / ('%s-masks' % split)
    dz.mkdir(parents=True, exist_ok=True)
    for c in '0123456789abcdef':
        with zipfile.ZipFile(dz / ('%s-masks-%s.zip' % (split, c)), 'w') as z:
            for mp, data in zips.get((split, c), []):
                z.writestr(mp, data)
g = base / 'gh/Karel911/TRACER/releases/download/v1.0'
g.mkdir(parents=True, exist_ok=True)
shutil.copy(w, g / 'TRACER-Efficient-0.pth')
print('mock photos', n, {s: len(info[s]) for s in SPL})
