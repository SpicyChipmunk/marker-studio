# Step 2 (round 2): download Open Images' lists (class names, the masks' tables, each photo's licence and author, and
# the validation/test box tables), then choose the photos:
#   training pool   Open Images' train split (config train_top_up_zips of its 16 mask files): every usable photo with
#                   no person, body-part or clothing outline (config "exclude")
#   held-out pool   the validation and test splits: every usable photo (the checks are chosen from it in step 4)
# "Usable": an info row, upright, CC BY 2.0, and good masks (Open Images' own quality score; skipped for a split that
# has no usable scores). Writes work/candidates.csv and results/step2-counts.txt (the counts Claude asks for).
import csv, hashlib, json, statistics
from collections import Counter, defaultdict
from common import CFG, WORK, RESULTS, log, fail, download, head_size, mark_done, round2_safe

csv.field_size_limit(1 << 30)
if CFG.get('round', 2) >= 5:
    # (FINDINGS-AR D3: candidates.csv, which training reads, would be rewritten)
    fail('2-lists is not part of round %d: it would rewrite the tables training reads. Nothing has been changed. '
         'Close this window.' % CFG['round'])
if CFG.get('round', 2) >= 3:
    round2_safe()          # (before anything else: round 2's results are kept apart once)
U = CFG['urls']
lists = WORK / 'lists-oi'
lists.mkdir(exist_ok=True)
old = WORK / 'lists'          # (round 1 kept Open Images' tables here: reused, not downloaded again)
OUT = []                      # the counts, written to results/step2-counts.txt


def say(*a):
    msg = ' '.join(str(x) for x in a)
    OUT.append(msg)
    log(msg)


def fetch(url, name, big_ok=False, optional=False):
    for d in (lists, old):
        if (d / name).exists():
            return d / name
    dest = lists / name
    try:
        n = head_size(url)
    except Exception as e:
        if optional:
            say('(not available: %s, %s; carrying on without it)' % (name, e))
            return None
        fail('cannot reach %s (%s)' % (url, e))
    mb = (n or 0) / 1e6
    log('Downloading %s (%s MB)' % (name, round(mb, 1) if n else 'size unknown'))
    if mb > 300 and not big_ok:
        a = input('   That is %.0f MB. Type y and press Enter to go ahead: ' % mb)
        if a.strip().lower() != 'y':
            fail('stopped before downloading ' + name)
    download(url, dest)
    return dest


cl = fetch(U['classes'], 'classes.csv')
names = {}
with open(cl, encoding='utf-8') as f:
    for row in csv.reader(f):
        if len(row) >= 2 and row[0].startswith('/m/'):
            names[row[0]] = row[1]
low = {}
for m, d in names.items():
    low.setdefault(d.lower(), []).append(m)
group_of, unknown = {}, []
for g, ns in CFG['groups'].items():
    for n in ns:
        if n.lower() not in low:
            unknown.append(n)
        for m in low.get(n.lower(), []):
            group_of.setdefault(m, g)
excl, ex_unknown = set(), []
for n in CFG['exclude']:
    if n.lower() not in low:
        ex_unknown.append(n)
    excl.update(low.get(n.lower(), []))
person = {m for n in CFG['whole_person'] for m in low.get(n.lower(), [])}
say('Classes: %d | everyday-subject classes %d | people, body-part and clothing classes %d' % (len(names), len(group_of), len(excl)))
if unknown:
    say('(subject names not among Open Images classes, ignored: %s)' % ', '.join(unknown))
if ex_unknown:
    say('(people/clothing names not among Open Images classes, ignored: %s)' % ', '.join(ex_unknown))
json.dump({'exclude': sorted(excl), 'person': sorted(person), 'group_of': group_of, 'names': names},
          open(WORK / 'classes.json', 'w', encoding='utf-8'))

BINS = [0.005, 0.01, 0.02, 0.05, 0.1, 0.3, 1.01]


def binname(a):
    lo = 0
    for b in BINS:
        if a < b:
            return '%g-%g%%' % (lo * 100, min(b, 1) * 100)
        lo = b
    return '>100%'


def hist(vals):
    c = Counter(binname(a) for a in vals)
    return ', '.join('%s %d' % (binname(b - 1e-9), c.get(binname(b - 1e-9), 0)) for b in BINS)


def read_boxes(split):
    """The split's box table: per photo, its boxes (class, area, x0, x1, y0, y1)."""
    url = U.get('bbox_csv', {}).get(split)
    if not url:
        return None
    p = fetch(url, split + '-bbox.csv', optional=True)
    if p is None:
        return None
    out = defaultdict(list)
    with open(p, encoding='utf-8') as f:
        for r in csv.DictReader(f):
            try:
                x0, x1, y0, y1 = float(r['XMin']), float(r['XMax']), float(r['YMin']), float(r['YMax'])
            except (KeyError, ValueError):
                continue
            out[r['ImageID']].append((r['LabelName'], (x1 - x0) * (y1 - y0), x0, x1, y0, y1))
    say('%s box table: %d boxes on %d photos' % (split, sum(len(v) for v in out.values()), len(out)))
    return out


def read_split(split, kind, prefixes=None):
    seg = fetch(U['seg_csv'].format(split=split), split + '-seg.csv', big_ok=(split == 'train'))
    info = fetch(U['info_csv'][split], split + '-info.csv', big_ok=(split == 'train'))
    masks = defaultdict(list)
    pious = []
    with open(seg, encoding='utf-8') as f:
        for r in csv.DictReader(f):
            if prefixes and r['ImageID'][0] not in prefixes:
                continue
            piou = r.get('PredictedIoU') or ''
            try:
                pv = float(piou)
                pv = None if pv != pv else pv
            except ValueError:
                pv = None
            if pv is not None and len(pious) < 200000:
                pious.append(pv)
            try:
                bx = (float(r['BoxXMin']), float(r['BoxXMax']), float(r['BoxYMin']), float(r['BoxYMax']))
            except ValueError:
                bx = (0, 0, 0, 0)
            masks[r['ImageID']].append((r['MaskPath'], r['LabelName'], pv, (bx[1] - bx[0]) * (bx[3] - bx[2]), bx))
    total = sum(len(v) for v in masks.values())
    good_share = sum(1 for v in pious if v >= CFG['min_predicted_iou']) / max(1, len(pious))
    use_iou = len(pious) > 0.1 * total and good_share >= 0.05
    if pious:
        q = sorted(pious)
        say('%s: %d masks on %d photos; quality score on %d%% of masks (min %.2f, median %.2f, max %.2f; %.0f%% at least %.2f)%s' % (
            split, total, len(masks), round(100 * len(pious) / max(1, total)), q[0], statistics.median(q), q[-1], 100 * good_share,
            CFG['min_predicted_iou'], '' if use_iou else ' — too few usable scores: that filter is skipped for this split'))
    else:
        say('%s: %d masks on %d photos; no quality score: that filter is skipped' % (split, total, len(masks)))
    need = ('ImageID', 'OriginalURL', 'OriginalLandingURL', 'License', 'Author', 'AuthorProfileURL', 'Title', 'Rotation')
    meta, lic, rot = {}, Counter(), Counter()
    with open(info, encoding='utf-8-sig') as f:
        rd = csv.DictReader(f)
        miss = [c for c in need if c not in (rd.fieldnames or [])]
        if miss:
            fail('%s has no %s columns (it has: %s).' % (info.name, ', '.join(miss), ', '.join(rd.fieldnames or [])))
        for r in rd:
            if r['ImageID'] in masks:
                meta[r['ImageID']] = {k: r.get(k, '') for k in need}
                lic[r['License']] += 1
                rot[r['Rotation']] += 1
    say('   licences seen: ' + '; '.join('%s %d' % kv for kv in lic.most_common(4)))
    say('   rotation values seen: ' + '; '.join('%r %d' % kv for kv in rot.most_common(4)))
    boxes = read_boxes(split) if kind == 'held' else None
    cnt, out = Counter(), []
    allgood_fail = largest_ok = 0
    for iid, ms in masks.items():
        cnt['photos'] += 1
        m = meta.get(iid)
        if not m:
            cnt['no info row'] += 1
            continue
        if m['Rotation'] not in ('', 'nan', '0', '0.0'):
            cnt['turned'] += 1
            continue
        if 'creativecommons.org/licenses/by/2.0' not in m['License']:
            cnt['not CC BY 2.0'] += 1
            continue
        big = max(ms, key=lambda x: x[3])
        # (people and clothing are looked for in every outline, low-quality ones included, before any are dropped)
        labs = {x[1] for x in ms}
        loose = 0
        if use_iou:
            bad = [x for x in ms if x[2] is None or x[2] < CFG['min_predicted_iou']]
            if bad:
                allgood_fail += 1
                big_ok = big[2] is not None and big[2] >= CFG['min_predicted_iou']
                if big_ok:
                    largest_ok += 1
                # (round 3: a training photo whose largest outline is good is kept with its good outlines only; step 4's
                # agreement with stock decides whether it is trained on, and it is never a check photo)
                if not (big_ok and kind == 'train' and CFG.get('loose_quality')):
                    cnt['a mask under the quality score'] += 1
                    continue
                ms = [x for x in ms if x not in bad]
                loose = 1
                cnt['kept: a smaller outline under the quality score (good outlines only)'] += 1
        cnt['usable'] += 1
        has_ex = bool(labs & excl)
        has_person = bool(labs & person)
        bx = boxes.get(iid, []) if boxes is not None else []
        if kind == 'train' and has_ex:
            cnt['left out: people/clothing'] += 1
            continue
        if kind == 'held' and has_ex and not has_person:
            cnt['left out: people/clothing'] += 1
            continue
        mlabs = labs
        people_box = any(b[0] in excl for b in bx)
        bigbox = [b for b in bx if b[1] > CFG['held'].get('unmasked_box', 0.02) and b[0] not in mlabs]
        out.append({'split': split, 'id': iid, 'kind': kind, 'excl': int(has_ex), 'person': int(has_person), 'loose': loose,
                    'group': group_of.get(big[1], 'other'), 'label': names.get(big[1], big[1]), 'nmasks': len(ms),
                    'maxmaskbox': round(big[3], 5), 'masks': ';'.join('%s|%s' % (x[0], x[1]) for x in ms),
                    'hasboxes': int(boxes is not None and iid in boxes), 'maxbox': round(max([b[1] for b in bx] or [0]), 5),
                    'peoplebox': int(people_box),
                    'bigboxes': ';'.join('%.4f,%.4f,%.4f,%.4f' % b[2:] for b in bigbox[:8]),
                    **{k: m[k] for k in need if k != 'ImageID'}})
    say('   %s photos: %s' % (split, ', '.join('%s %d' % kv for kv in cnt.items())))
    if use_iou:
        say('   (of those failing the quality score, %d have their largest mask good%s)' % (
            largest_ok, ': kept for training with their good outlines only, if nothing else leaves them out' if kind == 'train' and CFG.get('loose_quality') else ': a looser rule would keep them'))
    return out


pool = []
for sp in CFG['splits']:
    pool += read_split(sp, 'held')
held = [c for c in pool if c['kind'] == 'held']
pre = '0123456789abcdef'[:CFG['train_top_up_zips']]
say('Training photos from Open Images\' train split: IDs starting with %s (%d of its 16 mask files)' % (', '.join(pre), len(pre)))
train = read_split('train', 'train', set(pre))
if len(held) < CFG.get('held_min', 5000):
    # (the validation and test photos couldn't be used: the checks come from a quarter of the train photos instead,
    # kept apart from training by their ID, and without the box tables' check)
    key = lambda c: hashlib.sha1(c['id'].encode()).hexdigest()
    moved = [c for c in train if int(key(c)[:2], 16) < 64]
    for c in moved:
        c['kind'] = 'held'
    train = [c for c in train if c['kind'] == 'train']
    held += moved
    say('NOTE: only %d usable validation/test photos: the checks use %d train-split photos instead (kept apart from training, '
        'without the box check). Tell Claude.' % (len(pool), len(moved)))
say('')
say('Training pool (no people/clothing): %d photos (of them kept by the looser quality rule: %d)' % (len(train), sum(c['loose'] for c in train)))
say('   largest outline\'s box, share of the photo: ' + hist([c['maxmaskbox'] for c in train]))
one = [c for c in train if c['nmasks'] == 1]
say('   photos with exactly one outline: %d; by its box: %s' % (len(one), hist([c['maxmaskbox'] for c in one])))
say('   outlines per photo: ' + ', '.join('%s %d' % kv for kv in sorted(Counter(min(c['nmasks'], 6) for c in train).items())) + ' (6 = 6 or more)')
g = Counter(c['group'] for c in train)
say('   by kind: ' + ', '.join('%s %d' % kv for kv in sorted(g.items())))
gs = Counter(c['group'] for c in one if 0.01 <= c['maxmaskbox'] < 0.08)
say('   one outline with a 1-8% box, by kind: ' + ', '.join('%s %d' % kv for kv in sorted(gs.items())))
say('   top classes (largest outline): ' + ', '.join('%s %d' % kv for kv in Counter(c['label'] for c in train).most_common(30)))
say('')
say('Held-out pool (validation + test): %d photos' % len(held))
hb = [c for c in held if c['hasboxes']]
say('   with box rows: %d; without: %d' % (len(hb), len(held) - len(hb)))
pp = [c for c in held if c['person']]
say('   with a whole-person outline: %d (people-set candidates before step 4\'s check)' % len(pp))
hidden = [c for c in held if not c['excl'] and c['peoplebox']]
say('   people in the box table but not outlined (left out of the checks): %d' % len(hidden))
hs = [c for c in held if not c['excl'] and not c['peoplebox'] and c['nmasks'] == 1 and 0.01 <= c['maxmaskbox'] < 0.08]
say('   one outline with a 1-8%% box (small-subject candidates): %d; of those every box under 6%%: %d' % (
    len(hs), sum(1 for c in hs if c['maxbox'] <= CFG['held'].get('small_max_box', 0.06))))
say('      by kind: ' + ', '.join('%s %d' % kv for kv in sorted(Counter(c['group'] for c in hs).items())))
sc = [c for c in held if not c['excl'] and not c['peoplebox'] and c['maxmaskbox'] < 0.01]
say('   largest outline\'s box under 1%% (scenery candidates; step 4 measures the outlines): %d' % len(sc))
say('   top classes (largest outline): ' + ', '.join('%s %d' % kv for kv in Counter(c['label'] for c in held).most_common(30)))
# (held-out photos with people in the box table but not outlined are left out: a check would count the person)
chosen = train + [c for c in held if c['excl'] or not c['peoplebox']]
done_n = sum(1 for c in chosen if (WORK / 'prep' / (c['id'] + '.npz')).exists())
say('')
say('Photos chosen: %d (training %d, held-out %d); already prepared from round 1: %d; to download: %d (about %.0f min at round 1\'s pace)' % (
    len(chosen), len(train), len(chosen) - len(train), done_n, len(chosen) - done_n, (len(chosen) - done_n) / 3000))
with open(WORK / 'candidates.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=list(chosen[0].keys()))
    w.writeheader()
    w.writerows(chosen)
(RESULTS / 'step2-counts.txt').write_text('\n'.join(OUT) + '\n', encoding='utf-8')
mark_done('s2')
log('Step 2 done. Send Claude the file results\\step2-counts.txt (or its lines above), then wait for the go-ahead before step 3.')
