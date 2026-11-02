# Step 3: download the masks' zip files the chosen photos need, then each photo; make each one small at once
# (config "side" × "side", the way the model sees photos: squashed, not cropped), keep its masks at that size, and
# delete the full-size photo. Restartable: a photo already prepared is skipped. Writes work/prep/<id>.npz.
import csv, io, threading, zipfile, time
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image
from common import CFG, WORK, log, fail, download, head_size, mark_done, gb_free

U, SIDE = CFG['urls'], CFG['side']
prep = WORK / 'prep'
prep.mkdir(exist_ok=True)
zdir = WORK / 'masks'
zdir.mkdir(exist_ok=True)
tmp = WORK / 'tmp'
tmp.mkdir(exist_ok=True)
with open(WORK / 'candidates.csv', encoding='utf-8') as f:
    cands = list(csv.DictReader(f))
todo = [c for c in cands if not (prep / (c['id'] + '.npz')).exists() and not (prep / (c['id'] + '.skip')).exists()]
log('Photos chosen: %d; still to prepare: %d' % (len(cands), len(todo)))
if todo and gb_free() < CFG.get('min_free_gb_s3', 8):
    fail('only %.0f GB free on this drive: at least %d GB is needed to prepare %d more photos. Free some space (the mask zip files in '
         'work\\masks are needed only while this step runs) and run this step again.' % (gb_free(), CFG.get('min_free_gb_s3', 8), len(todo)))
# the masks' zip files
zips = sorted({(c['split'], c['id'][0]) for c in todo})
missing = [(s, ch) for s, ch in zips if not (zdir / ('%s-masks-%s.zip' % (s, ch))).exists()]
if missing:
    sizes = []
    for s, ch in missing:
        try:
            sizes.append(head_size(U['seg_zip'].format(split=s, c=ch)) or 0)
        except Exception as e:
            fail('cannot reach the masks for %s/%s (%s)' % (s, ch, e))
    tot = sum(sizes) / 1e9
    log('Mask files to download: %d, %.1f GB in all' % (len(missing), tot))
    if tot > 3:
        if input('   Type y and press Enter to go ahead: ').strip().lower() != 'y':
            fail('stopped before the mask downloads')
    for (s, ch), n in zip(missing, sizes):
        log('Downloading %s-masks-%s.zip (%.0f MB)' % (s, ch, n / 1e6))
        download(U['seg_zip'].format(split=s, c=ch), zdir / ('%s-masks-%s.zip' % (s, ch)))
local = threading.local()


def zfile(split, ch):
    zs = getattr(local, 'zs', None)
    if zs is None:
        zs = local.zs = {}
    k = (split, ch)
    if k not in zs:
        zf = zipfile.ZipFile(zdir / ('%s-masks-%s.zip' % k))
        # (by file name, wherever it sits in the zip)
        zs[k] = (zf, {n.rsplit('/', 1)[-1]: n for n in zf.namelist()})
    return zs[k]


def one(c):
    iid, split = c['id'], c['split']
    out = prep / (iid + '.npz')
    jpg = tmp / (iid + '.jpg')
    try:
        download(U['photo'].format(split=split, id=iid), jpg, tries=4, quiet=True)
    except Exception as e:
        (prep / (iid + '.skip')).write_text('photo: %s' % e)
        return 'nophoto'
    try:
        im = Image.open(jpg)
        im.load()
        im = im.convert('RGB')          # (pixels as stored: the masks are drawn on them; EXIF turning not applied)
        W, H = im.size
        z, where = zfile(split, iid[0])
        ms, labs = [], []
        for part in c['masks'].split(';'):
            path, lab = part.split('|')
            with z.open(where[path]) as f:
                m = Image.open(io.BytesIO(f.read()))
                m.load()
            mw, mh = m.size
            if abs(mw / mh - W / H) > 0.02 * (W / H):
                (prep / (iid + '.skip')).write_text('mask shape %dx%d vs photo %dx%d' % (mw, mh, W, H))
                return 'shape'
            m = np.asarray(m.convert('L').resize((SIDE, SIDE), Image.BILINEAR)) >= 128
            ms.append(np.packbits(m))
            labs.append(lab)
        small = im.resize((SIDE, SIDE), Image.BICUBIC)
        b = io.BytesIO()
        small.save(b, 'JPEG', quality=95)
        np.savez(out.with_suffix('.tmp.npz'), jpg=np.frombuffer(b.getvalue(), np.uint8), masks=np.stack(ms), labels=np.array(labs),
                 size=np.array([W, H]))
        out.with_suffix('.tmp.npz').replace(out)
        return 'ok'
    except KeyError:
        (prep / (iid + '.skip')).write_text('mask not in zip')
        return 'nomask'
    except Exception as e:
        (prep / (iid + '.skip')).write_text('error: %s' % e)
        return 'error'
    finally:
        try:
            jpg.unlink()
        except FileNotFoundError:
            pass


t0, n, res = time.time(), 0, {}
with ThreadPoolExecutor(16) as ex:
    for fut in as_completed([ex.submit(one, c) for c in todo]):
        r = fut.result()
        res[r] = res.get(r, 0) + 1
        n += 1
        if n % 250 == 0 or n == len(todo):
            el = time.time() - t0
            log('%d of %d (%s) — about %.0f min left' % (n, len(todo), ', '.join('%s %d' % kv for kv in sorted(res.items())),
                                                       el / n * (len(todo) - n) / 60))
ok = len(list(prep.glob('*.npz')))
log('Prepared photos: %d' % ok)
if ok < 0.5 * len(cands):
    fail('fewer than half the photos could be prepared; see the .skip files in work/prep for why.')
mark_done('s3')
log('Step 3 done. The mask zip files in work/masks can be deleted now if you need the space. Next: 4-label.')
