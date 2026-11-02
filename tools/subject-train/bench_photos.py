# The photo-to-page bench's photos (decisions 76-82, 99, 101; plan v4): about 900 Open Images photos from the validation and
# test splits (the train split stays free), with every object outlined, for measuring Marker Studio's photo-to-page
# builder in the cloud. Nothing here trains anything; the photos (CC BY 2.0) and outlines (CC BY 4.0) are used for
# measuring only and never go into the app or its repo.
#
# It reads what steps 2-3 already left in work\ (candidates.csv's held-out rows, the Open Images tables in
# work\lists-oi, classes.json), checks each photo's outlines and boxes, picks photos by kind, splits them into TUNE /
# HELD / FINAL by a hash of the photo's id, downloads each photo as Open Images serves it (at most 1024 px on its long
# side) and its outline images unchanged, and writes one folder:
#   bench-photos\<set>\<id>.jpg, bench-photos\<set>\<id>-<k>.png (one per outline), bench-photos\index.csv
# Restartable (a photo already there is skipped). No graphics card. Copy the bench-photos folder to the Mac (Documents/
# Claude outputs) when it says it's done.
#
#   python bench_photos.py [--count]      (--count: only say how many photos each kind has, download nothing)
import csv, hashlib, io, json, sys, threading, time, zipfile
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
from common import CFG, WORK, KIT, log, fail, download, gb_free, read_r3_list

OUT = KIT / 'bench-photos'
LISTS = WORK / 'lists-oi'
SETS = ('TUNE', 'HELD', 'FINAL')
KINDS = ('pets', 'animals', 'birds', 'plants', 'food', 'objects', 'people')
B = CFG.get('bench', {})
PER_SET = B.get('per_kind_per_set', 43)          # (7 kinds x 43 = ~300 a set, where a kind has that many)
FLOOR = B.get('floor_per_set', 14)               # (a kind with fewer than this a set is reported and left out)
Q_MIN = B.get('min_outline_quality', 0.9)
RIVAL = CFG['held']['rival']                      # (step 4's: an un-outlined box half the outlined subject's size)


def table(name, url):
    """An Open Images table: where step 2 left it (work\\lists-oi, or work\\lists, where round 1 kept them), else
    downloaded into work\\lists-oi."""
    for d in (LISTS, WORK / 'lists'):
        if (d / name).exists():
            return d / name
    if not url:
        fail('%s is missing and the kit has no address for it. Send Claude this message.' % name)
    log('Downloading %s' % name)
    LISTS.mkdir(parents=True, exist_ok=True)
    return download(url, LISTS / name)


def h(iid):
    return hashlib.sha256(('bench1:' + iid).encode()).hexdigest()


def seg_table(split):
    """Every outline of the split: per photo, [(mask file, class, PredictedIoU, box (x0, x1, y0, y1))]."""
    p = table('%s-seg.csv' % split, CFG['urls']['seg_csv'].format(split=split))
    out = defaultdict(list)
    with open(p, encoding='utf-8') as f:
        for r in csv.DictReader(f):
            try:
                q = float(r['PredictedIoU'])
            except (TypeError, ValueError):
                q = None
            try:
                b = (float(r['BoxXMin']), float(r['BoxXMax']), float(r['BoxYMin']), float(r['BoxYMax']))
            except (TypeError, ValueError):
                b = (0.0, 0.0, 0.0, 0.0)
            out[r['ImageID']].append((r['MaskPath'], r['LabelName'], q, b))
    return out


def box_table(split, want):
    """The split's boxes for the photos in want: per photo, [(class, box (x0, x1, y0, y1), group-of, depiction, inside)]."""
    p = table('%s-bbox.csv' % split, CFG['urls'].get('bbox_csv', {}).get(split))
    out = defaultdict(list)
    with open(p, encoding='utf-8') as f:
        for r in csv.DictReader(f):
            if r['ImageID'] not in want:
                continue
            try:
                b = (float(r['XMin']), float(r['XMax']), float(r['YMin']), float(r['YMax']))
            except (TypeError, ValueError):
                continue
            out[r['ImageID']].append((r['LabelName'], b, r.get('IsGroupOf') == '1', r.get('IsDepiction') == '1',
                                      r.get('IsInside') == '1'))
    return out


def area(b):
    return max(0.0, b[1] - b[0]) * max(0.0, b[3] - b[2])


def outside(b, mb):
    """A box mostly outside every outline's box: not the outlined object, a part of it or its parent class (Dog's
    Carnivore and Mammal boxes sit on the same dog). s4_lib.outside's rule."""
    a = max(1e-9, area(b))
    for o in mb:
        ix = max(0, min(b[1], o[1]) - max(b[0], o[0]))
        iy = max(0, min(b[3], o[3]) - max(b[2], o[2]))
        if ix * iy >= 0.5 * a:
            return False
    return True


def kind_of(c, person):
    if c['person'] == '1':
        return 'people'
    g = c['group']
    return {'insects': 'animals', 'other': 'objects'}.get(g, g) if g in set(KINDS) | {'insects', 'other'} else 'objects'


def choose():
    cl = json.load(open(WORK / 'classes.json', encoding='utf-8'))
    names, person = cl['names'], set(cl['person'])
    low = defaultdict(list)
    for m, d in names.items():
        low[d.lower()].append(m)
    backg = {m for n in CFG['background'] for m in low.get(n.lower(), [])}
    excl = set(cl['exclude'])
    trained = set(read_r3_list('train'))
    with open(WORK / 'candidates.csv', encoding='utf-8') as f:
        held = [c for c in csv.DictReader(f) if c['kind'] == 'held' and c['split'] in ('validation', 'test')]
    log('Held-out photos to look at (validation and test splits): %d' % len(held))
    rows, cnt = [], Counter()
    for split in ('validation', 'test'):
        mine = [c for c in held if c['split'] == split]
        if not mine:
            continue
        seg = seg_table(split)
        bx = box_table(split, {c['id'] for c in mine})
        # (decision 101: Open Images' validation and test outlines were drawn by hand, "near-perfect", and carry no
        # quality score: PredictedIoU is 0.00000 throughout. A split with no score has no score gate, as in step 2)
        scored = any(q for ms in seg.values() for _, _, q, _ in ms)
        if not scored:
            log('%s: no outline quality scores (hand-drawn outlines): that check is skipped for this split' % split)
        for c in mine:
            iid = c['id']
            if iid in trained:
                cnt['in round 3\'s training list'] += 1
                continue
            ms = seg.get(iid, [])
            if not ms:
                cnt['no outlines in the table'] += 1
                continue
            if scored and any(q is None or q < Q_MIN for _, _, q, _ in ms):
                cnt['an outline under quality %.2f' % Q_MIN] += 1
                continue
            boxes = bx.get(iid)
            if not boxes:
                cnt['no boxes in the table'] += 1
                continue
            if any(dep for _, _, _, dep, _ in boxes):
                cnt['a drawing or picture of something (depiction box)'] += 1
                continue
            if any(gr and lab not in backg for lab, _, gr, _, _ in boxes):
                cnt['a box for a group of things'] += 1
                continue
            labs = {lab for _, lab, _, _ in ms}
            mb = [b for _, _, _, b in ms if area(b) > 0]
            own = area((min(o[0] for o in mb), max(o[1] for o in mb), min(o[2] for o in mb), max(o[3] for o in mb))) if mb else 0
            # (Focus also needs: nothing big left un-outlined, and no un-outlined person in a photo that isn't of people;
            # both by where the box is, as step 4's rival rule: a box outside the outlined boxes, whatever its label)
            rival = any(not ins and lab not in backg and outside(b, mb) and area(b) >= RIVAL * own
                        for lab, b, _, _, ins in boxes)
            stray_person = c['person'] != '1' and any(lab in person and outside(b, mb) for lab, b, _, _, _ in boxes)
            k = kind_of(c, person)
            rows.append({'id': iid, 'split': split, 'kind': k, 'group': c['group'], 'label': c['label'], 'focus_ok': int(not (rival or stray_person)),
                         'masks': ';'.join('%s|%s|%.3f' % (mp, names.get(lab, lab), q) for mp, lab, q, _ in ms),
                         'people_parts': int(bool(labs & excl)), 'credit': '%s, "%s", %s (%s)' % (
                             c.get('Author', ''), c.get('Title', ''), c.get('License', ''), c.get('OriginalLandingURL', ''))})
            cnt['usable'] += 1
    log('Checks: ' + '; '.join('%s %d' % kv for kv in cnt.most_common()))
    by = defaultdict(list)
    for r in rows:
        by[r['kind']].append(r)
    picked, report = [], []
    for k in KINDS:
        # (a photo's set by its own hash's value, so a change to the checks or the numbers never moves a photo from
        # one set to another; then the first PER_SET of each set by hash)
        rs = sorted(by.get(k, []), key=lambda r: h(r['id']))
        per = {s: [r for r in rs if SETS[int(h(r['id'])[:8], 16) % 3] == s] for s in SETS}
        n_set = min(PER_SET, min(len(v) for v in per.values()))
        if n_set < FLOOR:
            report.append('%s: %d usable, under %d a set: left out' % (k, len(rs), FLOOR))
            continue
        mine = []
        for s_ in SETS:
            for r in per[s_][:n_set]:
                r['set'] = s_
                mine.append(r)
        picked += mine
        report.append('%s: %d usable, %d a set (Focus-ready %d of %d)' % (
            k, len(rs), n_set, sum(r['focus_ok'] for r in mine), len(mine)))
    for line in report:
        log('   ' + line)
    log('Picked: %d photos (%s)' % (len(picked), ', '.join('%s %d' % (s, sum(r['set'] == s for r in picked)) for s in SETS)))
    return picked, report


def zfile(cache, split, ch):
    k = (split, ch)
    if k not in cache:
        zp = WORK / 'masks' / ('%s-masks-%s.zip' % k)
        if not zp.exists():
            log('Downloading %s (outline images, a few MB)' % zp.name)
            download(CFG['urls']['seg_zip'].format(split=split, c=ch), zp)
        zf = zipfile.ZipFile(zp)
        cache[k] = (zf, {n.rsplit('/', 1)[-1]: n for n in zf.namelist()})
    return cache[k]


TL = threading.local()


def fetch(r):
    """One photo and its outline images, as Open Images serves them (no re-encoding)."""
    d = OUT / r['set']
    jpg = d / (r['id'] + '.jpg')
    masks = r['masks'].split(';')
    if jpg.exists() and all((d / ('%s-%d.png' % (r['id'], k))).exists() for k in range(len(masks))):
        return 'kept'
    tmp = d / (r['id'] + '.jpg.part')
    try:
        download(CFG['urls']['photo'].format(split=r['split'], id=r['id']), tmp, tries=4, quiet=True)
        with Image.open(tmp) as im:
            im.load()
            W, H = im.size
            ori = im.getexif().get(274, 1)
            icc = 1 if im.info.get('icc_profile') else 0
        if ori not in (0, 1):          # (a photo the browser would turn by its EXIF tag: its outlines wouldn't line up)
            return 'turned by its EXIF tag'
        # (one ZipFile per zip per thread, opened once: a ZipFile isn't safe to read from two threads at once)
        if not hasattr(TL, 'zips'):
            TL.zips = {}
        zf, where = zfile(TL.zips, r['split'], r['id'][0])
        outs = []
        for k, m in enumerate(masks):
            mp = m.split('|')[0]
            data = zf.read(where[mp])
            with Image.open(io.BytesIO(data)) as mi:
                mw, mh = mi.size
            if abs(mw / mh - W / H) > 0.02 * (W / H):
                return 'shape'
            outs.append(data)
        for k, data in enumerate(outs):
            (d / ('%s-%d.png' % (r['id'], k))).write_bytes(data)
        tmp.replace(jpg)
        r['w'], r['h'], r['icc'] = W, H, icc
        return 'ok'
    except KeyError as e:
        return 'outline not in its zip (%s)' % str(e)[:40]
    except Exception as e:
        return 'error: %s' % str(e)[:60]
    finally:
        try:
            tmp.unlink()
        except OSError:
            pass


if __name__ == '__main__':
    for p in (WORK / 'candidates.csv', WORK / 'classes.json'):
        if not p.exists():
            fail('%s is missing (from step 2). Send Claude this message.' % p)
    picked, report = choose()
    if '--count' in sys.argv:
        sys.exit(0)
    if gb_free() < 2:
        fail('under 2 GB free on this drive: free some space and run this again.')
    for s in SETS:
        (OUT / s).mkdir(parents=True, exist_ok=True)
    cache = {}
    for sp, ch in sorted({(r['split'], r['id'][0]) for r in picked}):          # (each outline zip once, before the threads)
        zfile(cache, sp, ch)
    t0, res = time.time(), Counter()
    with ThreadPoolExecutor(8) as ex:
        for i, out in enumerate(ex.map(fetch, picked)):
            res['ok' if out in ('ok', 'kept') else out] += 1
            if (i + 1) % 100 == 0 or i + 1 == len(picked):
                log('%d of %d (%s), %.0f min' % (i + 1, len(picked), ', '.join('%s %d' % kv for kv in res.most_common()),
                                                (time.time() - t0) / 60))
    have = [r for r in picked if (OUT / r['set'] / (r['id'] + '.jpg')).exists()]
    for r in have:
        if 'w' not in r:
            with Image.open(OUT / r['set'] / (r['id'] + '.jpg')) as im:
                r['w'], r['h'] = im.size
                r['icc'] = 1 if im.info.get('icc_profile') else 0
    cols = ['id', 'set', 'kind', 'group', 'label', 'split', 'w', 'h', 'icc', 'focus_ok', 'people_parts', 'masks', 'credit']
    with open(OUT / 'index.csv', 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore')
        w.writeheader()
        w.writerows(have)
    (OUT / 'counts.txt').write_text('\n'.join(report + ['photos: %d' % len(have)]) + '\n', encoding='utf-8')
    log('Done: %d photos in bench-photos (%.0f MB). Copy the whole bench-photos folder to the Mac (Documents/Claude outputs) '
        'and tell Claude.' % (len(have), sum(p.stat().st_size for p in OUT.rglob('*') if p.is_file()) / 1e6))
