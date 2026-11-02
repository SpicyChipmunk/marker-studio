# Round 6's stand-in (never shipped): adds to a mock.py Open Images folder (after a round-5 stand-in run) the TRAIN-split
# photos 4c-prep-round6 must handle, each with its expected fate, then (--check) compares work\round6 with them.
# Usage: mock_round6.py <kit> <mock folder> <TRACER-TE0 weights> <work>          (write the photos; once)
#        mock_round6.py <kit> <mock folder> <TRACER-TE0 weights> <work> --check  (after 4c-prep-round6)
import sys, io, csv, json, zipfile, hashlib, random, pathlib
import numpy as np, torch
from PIL import Image
kit, base, w, work = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), sys.argv[3], pathlib.Path(sys.argv[4])
EXP = base / 'round6-expect.json'
if '--check' in sys.argv:
    exp = json.load(open(EXP))
    r6 = work / 'round6'
    rd = lambda n: [l.strip() for l in open(r6 / 'lists' / (n + '.txt')) if l.strip()]
    got = {'people_train': set(rd('people_train')), 'people_p3': set(rd('people_p3')), 'small': set(rd('small'))}
    bad = 0
    for iid, fate in exp.items():
        where = [k for k, v in got.items() if iid in v]
        want = [fate] if fate in got else []
        if where != want:
            print('WRONG', iid, fate, where)
            bad += 1
    crops = list(csv.DictReader(open(r6 / 'crops.csv')))
    cp = {c['id'] for c in crops}
    assert not cp & set(k for k, v in exp.items() if v.startswith('people')), 'a crop from a people photo'
    assert all(i[0] in '34' for i in cp), 'a crop from outside the slice used'
    assert not any((r6 / 'prep' / (i + '.npz')).exists() for i in exp if i[0] == '5'), 'prefix 5 was downloaded'
    for k, v in exp.items():
        if v in got:
            assert (r6 / 'full640' / (k + '.jpg')).exists(), 'no 640 copy ' + k
            assert Image.open(r6 / 'full640' / (k + '.jpg')).size == (640, 640)
    print('round 6 stand-in: %d photos, %d wrong; crops %d from %d photos' % (len(exp), bad, len(crops), len(cp)))
    sys.exit(1 if bad else 0)

sys.path.insert(0, str(kit))
from tracer import TRACER, cfg
import skimage, skimage.io
D = pathlib.Path(skimage.__file__).parent / 'data'
NAMES = sorted({'Cat', 'Coffee cup', 'Rocket', 'Motorcycle', 'Ball', 'Horse', 'Person', 'Clothing', 'Tree', 'Car'})
mids = {n: '/m/%05x' % (i + 1) for i, n in enumerate(NAMES)}
net = TRACER(cfg)
net.load_state_dict({k.replace('module.', '', 1): v for k, v in torch.load(w, map_location='cpu', weights_only=True).items()})
net.eval()


def rgb(f):
    im = skimage.io.imread(D / f)
    im = np.stack([im] * 3, -1) if im.ndim == 2 else im[..., :3]
    return im if im.dtype == np.uint8 else (im / im.max() * 255).astype(np.uint8)


def stock(a):
    x = torch.from_numpy((np.asarray(Image.fromarray(a).resize((320, 320), Image.BILINEAR), np.float32) / 255 - [0.485, 0.456, 0.406]) /
                         [0.229, 0.224, 0.225]).float().permute(2, 0, 1)[None]
    with torch.no_grad():
        y = net(x)[0][0, 0].numpy()
    return np.asarray(Image.fromarray((y * 255).astype(np.uint8)).resize((a.shape[1], a.shape[0]), Image.BILINEAR)) >= 128


seg, info, boxes, zips, exp = [], [], [], {}, {}
used = [r['id'] for r in csv.DictReader(open(work / 'candidates.csv')) if r['split'] == 'train' and r['id'][0] in '012']


def new_id(name, ch):
    k = 0
    while True:
        h = hashlib.sha1(('r6' + name + str(k)).encode()).hexdigest()[:16]
        if h[0] == ch:
            return h
        k += 1


def add(iid, a, masks, extra=(), q='0.9', rot='0', lic='https://creativecommons.org/licenses/by/2.0/', fate='out'):
    h, ww = a.shape[:2]
    for n, (cls, m) in enumerate(masks):
        mp = '%s_%s_r6%d_mask.png' % (iid, mids[cls][3:], n)
        b = io.BytesIO()
        Image.fromarray((m * 255).astype(np.uint8)).save(b, 'PNG')
        zips.setdefault(iid[0], []).append((mp, b.getvalue()))
        ys, xs = np.nonzero(m)
        bx = (xs.min() / ww, (xs.max() + 1) / ww, ys.min() / h, (ys.max() + 1) / h)
        seg.append([mp, iid, mids[cls], 'x'] + list(bx) + [q, ''])
        boxes.append([iid, 'x', mids[cls], '1'] + list(bx))
    for cls, *bx in extra:
        boxes.append([iid, 'x', mids[cls], '1'] + list(bx))
    info.append([iid, 'train', 'http://example/%s.jpg' % iid, 'http://example/%s' % iid, lic, 'http://example/u',
                 'Author %s' % iid[:4], 'Title %s' % iid[:4], '1', 'x', '', rot])
    d = base / 's3' / 'train'
    d.mkdir(parents=True, exist_ok=True)
    Image.fromarray(a).save(d / (iid + '.jpg'), quality=92)
    exp[iid] = fate


astro = rgb('astronaut.png')
pm = stock(astro)
TEX = [np.asarray(Image.fromarray(rgb(t)).resize((480, 360))) for t in ('grass.png', 'gravel.png', 'brick.png', 'moon.png')]
cat = rgb('chelsea.png')
cm = stock(cat)
ys, xs = np.nonzero(cm)
cat, cm = cat[ys.min():ys.max() + 1, xs.min():xs.max() + 1], cm[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def person(v, flip=False):
    r = random.Random('p%d' % v)
    s = r.uniform(0.8, 1.0)
    h, ww = int(512 * s), int(512 * s)
    y0, x0 = r.randint(0, 512 - h), r.randint(0, 512 - ww)
    a, m = astro[y0:y0 + h, x0:x0 + ww], pm[y0:y0 + h, x0:x0 + ww]
    return (np.ascontiguousarray(a[:, ::-1]), np.ascontiguousarray(m[:, ::-1])) if flip else (np.ascontiguousarray(a), m)


def paste(v, share, tex=0):
    r = random.Random('s%d' % v)
    a = TEX[tex % 4].copy()
    k = (share * 480 * 360 / cm.sum()) ** 0.5
    hh, cw = max(4, int(cat.shape[0] * k)), max(4, int(cat.shape[1] * k))
    c2 = np.asarray(Image.fromarray(cat).resize((cw, hh)))
    m2 = np.asarray(Image.fromarray((cm * 255).astype(np.uint8)).resize((cw, hh))) >= 128
    y0, x0 = r.randint(0, 360 - hh), r.randint(0, 480 - cw)
    a[y0:y0 + hh, x0:x0 + cw][m2] = c2[m2]
    M = np.zeros((360, 480), bool)
    M[y0:y0 + hh, x0:x0 + cw] = m2
    return a, M


# the people set (IDs 0-2): 16 good, and every way out
for v in range(16):
    a, m = person(v, v % 2)
    add(new_id('pok%d' % v, '012'[v % 3]), a, [('Person', m)], fate='people_train')
a, m = person(20)
cl = np.zeros_like(m)
cl[:60, :60] = True
add(new_id('pcl', '0'), a, [('Person', m), ('Clothing', cl & ~m | cl)], fate='out: another outline outside')
a = TEX[1].copy()
sm = np.asarray(Image.fromarray(astro).resize((70, 70)))
sM = np.asarray(Image.fromarray((pm * 255).astype(np.uint8)).resize((70, 70))) >= 128
a[100:170, 200:270][sM] = sm[sM]
M = np.zeros((360, 480), bool)
M[100:170, 200:270] = sM
add(new_id('psmall', '1'), a, [('Person', M)], fate='out: small')
def left_person(tex):
    a = TEX[tex].copy()
    sm = np.asarray(Image.fromarray(astro).resize((200, 200)))
    sM = np.asarray(Image.fromarray((pm * 255).astype(np.uint8)).resize((200, 200))) >= 128
    a[150:350, 10:210][sM] = sm[sM]
    M = np.zeros((360, 480), bool)
    M[150:350, 10:210] = sM
    return a, M


a, m = left_person(2)
add(new_id('pstray', '2'), a, [('Person', m)], extra=[('Person', 0.7, 0.85, 0.3, 0.6)], fate='out: stray person box')
a, m = left_person(3)
add(new_id('prival', '0'), a, [('Person', m)], extra=[('Car', 0.5, 1.0, 0.0, 1.0)], fate='out: rival')
a, m = left_person(0)
add(new_id('pleft', '1'), a, [('Person', m)], extra=[('Clothing', 0.1, 0.3, 0.5, 0.9)], fate='people_train')
a, m = person(23)
add(new_id('plowq', '1'), a, [('Person', m)], q='0.5', fate='out: quality')
a, m = person(24)
add(new_id('pnoq', '2'), a, [('Person', m)], q='', fate='out: no score')
a, m = person(25)
add(new_id('prot', '0'), a, [('Person', m)], rot='90', fate='out: turned')
a, m = person(26)
add(new_id('plic', '1'), a, [('Person', m)], lic='https://creativecommons.org/licenses/by-nc/2.0/', fate='out: licence')
# a photo round 2-5 already used (a training photo), given a person outline: never a round-6 photo
u = used[0]
a0 = np.asarray(Image.open(base / 's3' / 'train' / (u + '.jpg')).convert('RGB'))
um = np.zeros(a0.shape[:2], bool)
um[: a0.shape[0] // 2, : a0.shape[1] // 2] = True
seg.append(['%s_%s_r6u_mask.png' % (u, mids['Person'][3:]), u, mids['Person'], 'x', 0, .5, 0, .5, '0.9', ''])
b = io.BytesIO()
Image.fromarray((um * 255).astype(np.uint8)).save(b, 'PNG')
zips.setdefault(u[0], []).append(('%s_%s_r6u_mask.png' % (u, mids['Person'][3:]), b.getvalue()))
exp[u] = 'out: used before'
# the fresh slice, IDs 3: small subjects (8 good and every way out), people (3), other photos for crops (6)
for v in range(8):
    a, M = paste(v, 0.012 + 0.004 * v, v)
    add(new_id('sok%d' % v, '3'), a, [('Cat', M)], fate='small')
a, M = paste(10, 0.03)
add(new_id('spb', '3'), a, [('Cat', M)], extra=[('Person', 0.7, 0.95, 0.4, 0.95)], fate='out: person box')
a, M = paste(11, 0.03)
add(new_id('sriv', '3'), a, [('Cat', M)], extra=[('Car', 0.0, 0.5, 0.0, 0.5)], fate='out: rival')
a, M = paste(12, 0.065)
add(new_id('sbig', '3'), a, [('Cat', M)], fate='out: 6% not small')
for v in range(3):
    a, m = person(40 + v, v % 2)
    add(new_id('p3ok%d' % v, '3'), a, [('Person', m)], fate='people_p3')
for v in range(6):
    a, M = paste(30 + v, 0.15, v)
    add(new_id('oth%d' % v, '3'), a, [('Cat', M)], fate='other')
# IDs 4: more small subjects (used only if 3 leaves too few after the detector); IDs 5 never needed
for v in range(5):
    a, M = paste(50 + v, 0.02 + 0.005 * v, v + 1)
    add(new_id('s4ok%d' % v, '4'), a, [('Cat', M)], fate='small')
for v in range(3):
    a, M = paste(60 + v, 0.02, v)
    add(new_id('s5ok%d' % v, '5'), a, [('Cat', M)], fate='out: prefix 5 not needed')

d5 = base / 'openimages/v5'
with open(d5 / 'train-annotations-object-segmentation.csv', 'a', newline='') as fh:
    csv.writer(fh).writerows(seg)
with open(base / 'openimages/2018_04/train/train-annotations-bbox.csv', 'a', newline='') as fh:
    csv.writer(fh).writerows([b + ['0', '0', '0', '0', '0'] for b in boxes])
with open(base / 'openimages/2018_04/train/train-images-boxable-with-rotation.csv', 'a', newline='') as fh:
    csv.writer(fh).writerows(info)
for ch, items in zips.items():
    p = d5 / 'train-masks' / ('train-masks-%s.zip' % ch)
    old = []
    if p.exists():
        with zipfile.ZipFile(p) as z:
            old = [(n, z.read(n)) for n in z.namelist()]
    with zipfile.ZipFile(p, 'w') as z:
        for n, b in old + items:
            z.writestr(n, b)
json.dump(exp, open(EXP, 'w'), indent=1)
print('round 6 stand-in: %d photos added' % len(info))
