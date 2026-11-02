# The photo-to-page bench: each photo's Open Images outlines at the guide's size (GW x GH, nearest), for pp-bench.mjs's
# measures, with each object's area, inscribed radius (the largest circle inside it, guide pixels: an object is measured at
# a Detail step only if that step's narrowest section fits inside it) and whether it touches the photo's edge.
#
#   python3 -I scripts/bench/pp_masks.py <bench-photos folder> <cache folder>
#
# Writes <cache>/masks/<id>-<k>.bits.gz (packed bits, row-major) and <cache>/masks/<id>.json. Restartable.
import csv, gzip, json, os, sys, time
import numpy as np
from PIL import Image
from scipy import ndimage


def main():
    photos, cache = sys.argv[1], sys.argv[2]
    rows = {r['id']: r for r in csv.DictReader(open(os.path.join(photos, 'index.csv'), encoding='utf-8'))}
    out = os.path.join(cache, 'masks')
    os.makedirs(out, exist_ok=True)
    pdir = os.path.join(cache, 'prep')
    t0, n = time.time(), 0
    for f in sorted(os.listdir(pdir)):
        if not f.endswith('.json') or f.startswith('_'):
            continue
        iid = f[:-5]
        dst = os.path.join(out, iid + '.json')
        if os.path.exists(dst) or iid not in rows:
            continue
        meta = json.load(open(os.path.join(pdir, f)))
        GW, GH = meta['GW'], meta['GH']
        r = rows[iid]
        objs = []
        for k, m in enumerate(r['masks'].split(';')):
            label = m.split('|')[1] if '|' in m else ''
            with Image.open(os.path.join(photos, r['set'], '%s-%d.png' % (iid, k))) as im:
                a = np.asarray(im.convert('L').resize((GW, GH), Image.NEAREST)) >= 128
            if not a.any():
                continue
            with gzip.open(os.path.join(out, '%s-%d.bits.gz' % (iid, k)), 'wb') as g:
                g.write(np.packbits(a.ravel()).tobytes())
            border = bool(a[0].any() or a[-1].any() or a[:, 0].any() or a[:, -1].any())
            objs.append({'k': k, 'label': label, 'area': int(a.sum()),
                         'r_in': float(ndimage.distance_transform_edt(np.pad(a, 1))[1:-1, 1:-1].max()), 'border': border})
        json.dump({'GW': GW, 'GH': GH, 'objs': objs}, open(dst + '.tmp', 'w'))
        os.replace(dst + '.tmp', dst)
        n += 1
    print('pp_masks: %d photos, %.1f min' % (n, (time.time() - t0) / 60))


if __name__ == '__main__':
    main()
